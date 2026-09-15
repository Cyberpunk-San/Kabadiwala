export const currency = (amount: number) => `₹${Math.round(amount).toLocaleString("en-IN")}`;

export const relativeDate = (date: string) => {
  const ageMs = Date.now() - new Date(date).getTime();
  const ageHours = Math.max(0, Math.round(ageMs / 3_600_000));
  return ageHours < 1 ? "Just now" : `${ageHours}h ago`;
};
