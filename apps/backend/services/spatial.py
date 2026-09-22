import math
from typing import List, Dict, Any
from models.domain import GeoLocation, RecyclerOffer

# Known Recyclers with PostGIS coordinates in Indian scrap clusters
REGISTERED_RECYCLERS = [
    {
        "id": "eco-cycle",
        "recycler_name": "EcoCycle Recyclers Pvt Ltd",
        "cpcb_license": "CPCB/EW/MH/2023/8812",
        "rating": 4.8,
        "base_listed_price": {"Copper cable": 625, "Server boards": 520, "Aluminium": 148, "default": 100},
        "pickup_base_cost": 180,
        "handling_cost": 70,
        "platform_fee": 120,
        "payment_reliability": 98,
        "latitude": 18.6320,
        "longitude": 73.8540,
        "cluster": "Bhosari MIDC, Pune"
    },
    {
        "id": "green-loop",
        "recycler_name": "GreenLoop Smelters & Refining",
        "cpcb_license": "CPCB/EW/MH/2022/4109",
        "rating": 4.6,
        "base_listed_price": {"Copper cable": 635, "Server boards": 505, "Aluminium": 144, "default": 95},
        "pickup_base_cost": 450,
        "handling_cost": 90,
        "platform_fee": 120,
        "payment_reliability": 95,
        "latitude": 18.6810,
        "longitude": 73.8920,
        "cluster": "Chakan Industrial Zone, Pune"
    },
    {
        "id": "urban-recover",
        "recycler_name": "Urban Recover Hub",
        "cpcb_license": "CPCB/EW/MH/2024/1102",
        "rating": 4.4,
        "base_listed_price": {"Copper cable": 605, "Server boards": 490, "Aluminium": 140, "default": 90},
        "pickup_base_cost": 95,
        "handling_cost": 60,
        "platform_fee": 120,
        "payment_reliability": 91,
        "latitude": 18.6210,
        "longitude": 73.8410,
        "cluster": "Pimpri Scrap Yard, Pune"
    },
    {
        "id": "maha-e-metals",
        "recycler_name": "Maharashtra E-Metals Authorized Disassembler",
        "cpcb_license": "MPCB/EW-REG/2021/045",
        "rating": 4.9,
        "base_listed_price": {"Copper cable": 640, "Server boards": 530, "Aluminium": 150, "default": 110},
        "pickup_base_cost": 320,
        "handling_cost": 80,
        "platform_fee": 120,
        "payment_reliability": 99,
        "latitude": 18.5900,
        "longitude": 73.7850,
        "cluster": "Hinjawadi Tech Corridor, Pune"
    }
]

def generate_postgis_sql_query(lat: float, lon: float, radius_meters: int = 25000) -> str:
    """
    Returns the exact PostgreSQL / PostGIS spatial SQL query for audit and production deployment.
    Uses ST_DWithin on geography(Point, 4326) and ST_Distance for indexing.
    """
    return f"""
    SELECT 
        id, 
        recycler_name, 
        cpcb_license,
        rating,
        ST_Distance(
            geom, 
            ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326)::geography
        ) / 1000.0 AS distance_km
    FROM recyclers
    WHERE ST_DWithin(
        geom, 
        ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326)::geography, 
        {radius_meters}
    )
    AND is_active = TRUE
    ORDER BY distance_km ASC;
    """.strip()

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates geodesic distance in kilometers between two GPS points."""
    R = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 1)

def match_recyclers_spatially(
    collector_lat: float,
    collector_lon: float,
    material: str,
    weight_kg: float = 35.0,
    max_radius_km: float = 30.0
) -> List[RecyclerOffer]:
    """
    Executes spatial search to find, score, and rank nearby verified recyclers
    optimizing for Net Earnings (listed price * weight - pickup cost - handling - fee).
    """
    offers: List[RecyclerOffer] = []

    for r in REGISTERED_RECYCLERS:
        dist_km = calculate_haversine_distance(collector_lat, collector_lon, r["latitude"], r["longitude"])
        if dist_km <= max_radius_km:
            listed_price = r["base_listed_price"].get(material, r["base_listed_price"]["default"])
            
            # Distance-adjusted pickup cost (₹15/km past base 2km)
            variable_pickup = max(0.0, (dist_km - 2.0) * 15.0)
            total_pickup = r["pickup_base_cost"] + variable_pickup
            handling = r["handling_cost"]
            platform = r["platform_fee"]
            
            gross = listed_price * weight_kg
            net = max(0.0, gross - total_pickup - handling - platform)

            offers.append(RecyclerOffer(
                id=r["id"],
                recycler_name=r["recycler_name"],
                verified=True,
                cpcb_license=r["cpcb_license"],
                rating=r["rating"],
                listed_price_per_kg=float(listed_price),
                pickup_cost=round(total_pickup, 1),
                handling_cost=float(handling),
                platform_fee=float(platform),
                distance_km=dist_km,
                payment_reliability=r["payment_reliability"],
                net_earnings=round(net, 1),
                location=GeoLocation(
                    latitude=r["latitude"],
                    longitude=r["longitude"],
                    cluster_name=r["cluster"]
                )
            ))

    # Rank by net earnings descending (Highest Take-Home First)
    offers.sort(key=lambda x: x.net_earnings, reverse=True)
    return offers
