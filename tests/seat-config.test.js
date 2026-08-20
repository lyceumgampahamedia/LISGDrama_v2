import assert from "node:assert/strict";
import test from "node:test";
import { ALL_SEATS, BLOCKS, SEAT_BY_ID, TIER_TOTALS, TOTAL_SEATS, seatsForBlock } from "../src/config.js";

test("the configured auditorium contains 600 unique seats", () => {
  assert.equal(TOTAL_SEATS, 600);
  assert.equal(ALL_SEATS.length, 600);
  assert.equal(new Set(ALL_SEATS.map((seat) => seat.id)).size, 600);
  assert.equal(SEAT_BY_ID.size, 600);
});

test("every block produces its declared number of seats", () => {
  for (const block of BLOCKS) {
    assert.equal(seatsForBlock(block).length, block.total);
    assert.equal(block.total % block.columns, 0);
  }
});

test("seat identifiers retain the legacy media-ready layout prefixes", () => {
  assert.ok(SEAT_BY_ID.has("LA001"));
  assert.ok(SEAT_BY_ID.has("RA104"));
  assert.ok(SEAT_BY_ID.has("LB096"));
  assert.ok(SEAT_BY_ID.has("RC104"));
});

test("ticket prices are controlled by the configured tier", () => {
  assert.equal(SEAT_BY_ID.get("LA001").block.price, 2000);
  assert.equal(SEAT_BY_ID.get("LB001").block.price, 1500);
  assert.equal(SEAT_BY_ID.get("LC001").block.price, 1000);
});

test("each public sales tier contains 200 seats per show", () => {
  assert.deepEqual(TIER_TOTALS, { A: 200, B: 200, C: 200 });
});
