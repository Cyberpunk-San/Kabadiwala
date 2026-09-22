import * as Location from "expo-location";

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
}

export interface ScrapCluster {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

export const KNOWN_SCRAP_CLUSTERS: ScrapCluster[] = [
  { id: "pune-bhosari", name: "Bhosari MIDC Cluster", city: "Pune", state: "Maharashtra", latitude: 18.6279, longitude: 73.8488 },
  { id: "mumbai-dharavi", name: "Dharavi Recycling Hub", city: "Mumbai", state: "Maharashtra", latitude: 19.0416, longitude: 72.8553 },
  { id: "delhi-mayapuri", name: "Mayapuri Scrap Market", city: "Delhi", state: "Delhi", latitude: 28.6312, longitude: 77.1256 },
  { id: "bangalore-peenya", name: "Peenya Industrial Area", city: "Bengaluru", state: "Karnataka", latitude: 13.0315, longitude: 77.5144 },
  { id: "delhi-mandoli", name: "Mandoli E-Waste Hub", city: "East Delhi", state: "Delhi", latitude: 28.7082, longitude: 77.3015 }
];

export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function getCurrentCoordinates(): Promise<GeoCoordinates | undefined> {
  try {
    const granted = await requestLocationPermissions();
    if (!granted) return undefined;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude
    };
  } catch (error) {
    console.warn("GPS location error, falling back to default cluster:", error);
    return {
      latitude: 18.6279,
      longitude: 73.8488,
      accuracy: 25
    };
  }
}

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function findNearestCluster(coords: GeoCoordinates): ScrapCluster {
  let nearest = KNOWN_SCRAP_CLUSTERS[0]!;
  let minDistance = Infinity;

  for (const cluster of KNOWN_SCRAP_CLUSTERS) {
    const d = calculateDistanceKm(coords.latitude, coords.longitude, cluster.latitude, cluster.longitude);
    if (d < minDistance) {
      minDistance = d;
      nearest = cluster;
    }
  }

  return nearest;
}

export function isWithinDropoffGeofence(
  collectorCoords: GeoCoordinates,
  destination: { latitude: number; longitude: number },
  radiusMeters = 200
): boolean {
  const distKm = calculateDistanceKm(collectorCoords.latitude, collectorCoords.longitude, destination.latitude, destination.longitude);
  return distKm * 1000 <= radiusMeters;
}

export async function watchCollectorLocation(
  onUpdate: (coords: GeoCoordinates) => void
): Promise<() => void> {
  const granted = await requestLocationPermissions();
  if (!granted) return () => {};

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10000,
      distanceInterval: 15
    },
    (loc) => {
      onUpdate({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        altitude: loc.coords.altitude
      });
    }
  );

  return () => {
    subscription.remove();
  };
}
