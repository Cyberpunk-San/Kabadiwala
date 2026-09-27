// src/hooks/useCollectorLocation.ts — where the kabadiwala is right now, for distance sorting.
// Live GPS first; if that's denied or times out, the location saved in their profile; else the default city.
import { useQuery } from "@tanstack/react-query";

import { config } from "../constants/config";
import { getCurrentCoordinates } from "../services/location/gpsService";
import { useAuthStore } from "../store/authStore";

export type LocationSource = "gps" | "saved" | "default";

const GPS_TIMEOUT_MS = 8000;

async function gpsOrNull() {
  const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), GPS_TIMEOUT_MS));
  return (await Promise.race([getCurrentCoordinates(), timeout])) ?? null;
}

export function useCollectorLocation() {
  const collector = useAuthStore((s) => s.collector ?? s.household ?? s.company);
  // One GPS fix shared by every screen; refreshed every 5 minutes.
  const gps = useQuery({ queryKey: ["gps-fix"], queryFn: gpsOrNull, staleTime: 5 * 60_000, retry: false });

  if (gps.data) return { lat: gps.data.latitude, lon: gps.data.longitude, source: "gps" as LocationSource, locating: false };
  const locating = gps.isLoading;
  if (collector?.latitude != null && collector?.longitude != null) {
    return { lat: collector.latitude, lon: collector.longitude, source: "saved" as LocationSource, locating };
  }
  return { lat: config.defaultLatitude, lon: config.defaultLongitude, source: "default" as LocationSource, locating };
}
