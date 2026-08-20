import { SEAT_BY_ID, TIER_IDS } from "../config.js";

export function activeSeatStatus(record, now = Date.now()) {
  if (!record?.status) return "available";
  const expiresAt = record.expiresAt?.toMillis?.();
  if (record.status === "reserved" && expiresAt && expiresAt <= now) return "available";
  return record.status === "booked" ? "booked" : "reserved";
}

export function summarizeSeatRecords(records, totalSeats, now = Date.now()) {
  let sold = 0;
  let held = 0;
  const soldByTier = Object.fromEntries(TIER_IDS.map((tier) => [tier, 0]));
  const heldByTier = Object.fromEntries(TIER_IDS.map((tier) => [tier, 0]));

  for (const [seatId, record] of records) {
    const status = activeSeatStatus(record, now);
    const tier = SEAT_BY_ID.get(seatId)?.block.tier;
    if (status === "booked") {
      sold += 1;
      if (tier) soldByTier[tier] += 1;
    }
    if (status === "reserved") {
      held += 1;
      if (tier) heldByTier[tier] += 1;
    }
  }

  return {
    sold,
    held,
    soldByTier,
    heldByTier,
    available: Math.max(0, totalSeats - sold - held),
  };
}
