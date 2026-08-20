import assert from "node:assert/strict";
import test from "node:test";
import { activeSeatStatus, summarizeSeatRecords } from "../src/services/seatAvailability.js";

function timestamp(milliseconds) {
  return { toMillis: () => milliseconds };
}

test("only booked seats count as sold", () => {
  const now = 2_000;
  const records = new Map([
    ["LA001", { status: "booked" }],
    ["LB001", { status: "booked" }],
    ["LC001", { status: "reserved", expiresAt: timestamp(3_000) }],
    ["LC002", { status: "reserved", expiresAt: timestamp(1_000) }],
  ]);

  assert.deepEqual(summarizeSeatRecords(records, 600, now), {
    sold: 2,
    held: 1,
    soldByTier: { A: 1, B: 1, C: 0 },
    heldByTier: { A: 0, B: 0, C: 1 },
    available: 597,
  });
});

test("expired temporary holds become available", () => {
  assert.equal(activeSeatStatus({ status: "reserved", expiresAt: timestamp(1_000) }, 2_000), "available");
  assert.equal(activeSeatStatus({ status: "reserved", expiresAt: timestamp(3_000) }, 2_000), "reserved");
  assert.equal(activeSeatStatus({ status: "booked" }, 2_000), "booked");
});
