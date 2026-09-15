import * as Location from "expo-location";

export async function getCurrentCoordinates() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") return undefined;
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: location.coords.latitude, longitude: location.coords.longitude };
}
