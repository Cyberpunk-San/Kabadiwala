import uuid
from datetime import datetime
from typing import List, Dict, Optional
from models.domain import LotResponse, LotCreate, LotStatus, GeoLocation

class InMemoryDataStore:
    def __init__(self):
        self.lots: Dict[str, LotResponse] = {}
        self.handover_receipts: List[Dict] = []
        self.aggregator_pools: List[Dict] = []
        self._seed_demo_data()

    def _seed_demo_data(self):
        demo_lots = [
            {
                "id": "lot_demo_copper_01",
                "material": "Copper cable",
                "quality": "medium",
                "weight_kg": 35.0,
                "status": "PICKUP_SCHEDULED",
                "collector_id": "CLT-4218",
                "collector_name": "Ramesh Kumar",
                "location": GeoLocation(latitude=18.6279, longitude=73.8488, cluster_name="Bhosari MIDC, Pune"),
                "created_at": "2026-03-20T10:30:00",
                "expected_net_earnings": 18450.0,
                "sync_state": "SYNCED",
                "epr_certificate_id": "EPR-CPCB-2026-A19F"
            },
            {
                "id": "lot_demo_server_02",
                "material": "Server boards",
                "quality": "high",
                "weight_kg": 22.5,
                "status": "AVAILABLE",
                "collector_id": "CLT-4218",
                "collector_name": "Ramesh Kumar",
                "location": GeoLocation(latitude=18.6279, longitude=73.8488, cluster_name="Bhosari MIDC, Pune"),
                "created_at": "2026-03-21T14:15:00",
                "expected_net_earnings": 11475.0,
                "sync_state": "SYNCED",
                "epr_certificate_id": None
            },
            {
                "id": "lot_demo_battery_03",
                "material": "Lithium-ion batteries",
                "quality": "high",
                "weight_kg": 18.0,
                "status": "IDENTIFIED",
                "collector_id": "CLT-9921",
                "collector_name": "Santosh Patil",
                "location": GeoLocation(latitude=18.6310, longitude=73.8510, cluster_name="Bhosari MIDC, Pune"),
                "created_at": "2026-03-22T08:00:00",
                "expected_net_earnings": 5040.0,
                "sync_state": "SYNCED",
                "epr_certificate_id": None
            }
        ]

        for item in demo_lots:
            self.lots[item["id"]] = LotResponse(**item)

    def create_lot(self, data: LotCreate) -> LotResponse:
        lot_id = f"lot_{datetime.now().strftime('%y%m%d')}_{uuid.uuid4().hex[:6]}"
        now = datetime.now().isoformat()
        lot = LotResponse(
            id=lot_id,
            material=data.material,
            quality=data.quality,
            weight_kg=data.weight_kg,
            status="AVAILABLE",
            collector_id=data.collector_id,
            collector_name=data.collector_name,
            location=data.location or GeoLocation(latitude=18.6279, longitude=73.8488, cluster_name="Bhosari MIDC, Pune"),
            image_uri=data.image_uri,
            created_at=now,
            expected_net_earnings=data.expected_net_earnings,
            sync_state="SYNCED"
        )
        self.lots[lot_id] = lot
        return lot

    def list_lots(self, status: Optional[str] = None) -> List[LotResponse]:
        items = list(self.lots.values())
        if status:
            items = [l for l in items if l.status == status]
        items.sort(key=lambda x: x.created_at, reverse=True)
        return items

    def get_lot(self, lot_id: str) -> Optional[LotResponse]:
        return self.lots.get(lot_id)

    def update_status(self, lot_id: str, status: LotStatus) -> Optional[LotResponse]:
        lot = self.lots.get(lot_id)
        if lot:
            updated = lot.model_copy(update={"status": status})
            self.lots[lot_id] = updated
            return updated
        return None

store = InMemoryDataStore()
