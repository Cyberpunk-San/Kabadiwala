import type { RecyclerOffer } from "../../types/domain";
import { calculateNetEarnings, sortOffersByNetEarnings } from "./lotCalculator";

const nearbyOffer: RecyclerOffer = {
  id: "nearby",
  recyclerName: "Nearby Recycler",
  verified: true,
  rating: 4.7,
  listedPricePerKg: 100,
  pickupCost: 100,
  handlingCost: 50,
  platformFee: 0,
  distanceKm: 2,
  paymentReliability: 98
};

const higherGrossOffer: RecyclerOffer = {
  ...nearbyOffer,
  id: "far-away",
  recyclerName: "Far Recycler",
  listedPricePerKg: 106,
  pickupCost: 450
};

describe("net-earnings recommendation", () => {
  it("subtracts every collection-side cost from the expected gross value", () => {
    expect(calculateNetEarnings(nearbyOffer, 50)).toEqual({ gross: 5000, costs: 150, net: 4850 });
  });

  it("ranks the nearby buyer above a buyer with a higher listed price when its net earning is better", () => {
    expect(sortOffersByNetEarnings([higherGrossOffer, nearbyOffer], 50).map((offer) => offer.id)).toEqual(["nearby", "far-away"]);
  });
});
