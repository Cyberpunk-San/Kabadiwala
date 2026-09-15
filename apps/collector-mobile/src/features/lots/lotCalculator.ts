import type { RecyclerOffer } from "../../types/domain";

export function calculateNetEarnings(offer: RecyclerOffer, weightKg: number) {
  const gross = offer.listedPricePerKg * weightKg;
  const costs = offer.pickupCost + offer.handlingCost + offer.platformFee;
  return { gross, costs, net: Math.max(0, gross - costs) };
}

export function sortOffersByNetEarnings(offers: RecyclerOffer[], weightKg: number) {
  return [...offers].sort((a, b) => calculateNetEarnings(b, weightKg).net - calculateNetEarnings(a, weightKg).net);
}
