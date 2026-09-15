import { config } from "../../constants/config";
import type { MaterialPrediction, RecyclerOffer } from "../../types/domain";

export const demoOffers: RecyclerOffer[] = [
  { id: "eco-cycle", recyclerName: "EcoCycle Recyclers", verified: true, rating: 4.8, listedPricePerKg: 612, pickupCost: 180, handlingCost: 70, platformFee: 120, distanceKm: 2.4, paymentReliability: 98 },
  { id: "green-loop", recyclerName: "GreenLoop Metals", verified: true, rating: 4.6, listedPricePerKg: 620, pickupCost: 450, handlingCost: 90, platformFee: 120, distanceKm: 7.8, paymentReliability: 95 },
  { id: "urban-recover", recyclerName: "Urban Recover", verified: true, rating: 4.4, listedPricePerKg: 596, pickupCost: 95, handlingCost: 60, platformFee: 120, distanceKm: 1.1, paymentReliability: 90 }
];

export function netEarnings(offer: RecyclerOffer, weightKg: number) {
  return Math.max(0, offer.listedPricePerKg * weightKg - offer.pickupCost - offer.handlingCost - offer.platformFee);
}

function getMockPrediction(): MaterialPrediction {
  return {
    material: "Copper cable",
    category: "Cable",
    quality: "medium",
    hazard: false,
    confidence: 0.91
  };
}

export async function analyseMaterial(imageUri: string): Promise<MaterialPrediction> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.aiVisionApiKey) {
    headers["X-API-Key"] = config.aiVisionApiKey;
    headers["Authorization"] = `Bearer ${config.aiVisionApiKey}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.apiTimeoutMs);

    const response = await fetch(config.aiVisionApiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ imageUri }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (config.useMockFallbacks) {
        return getMockPrediction();
      }
      throw new Error(`AI analysis could not be completed (status ${response.status}).`);
    }
    return (await response.json()) as MaterialPrediction;
  } catch (error) {
    if (config.useMockFallbacks) {
      return getMockPrediction();
    }
    throw error;
  }
}

export async function getOffers(): Promise<RecyclerOffer[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.aiVisionApiKey) {
    headers["Authorization"] = `Bearer ${config.aiVisionApiKey}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.apiTimeoutMs);

    const response = await fetch(`${config.apiBaseUrl}/v1/marketplace/offers`, {
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (config.useMockFallbacks) return demoOffers;
      throw new Error("Offers are unavailable.");
    }
    return (await response.json()) as RecyclerOffer[];
  } catch (error) {
    if (config.useMockFallbacks) {
      return demoOffers;
    }
    throw error;
  }
}
