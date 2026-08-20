import assert from "node:assert/strict";
import test from "node:test";
import {
  createPayHereCheckoutHash,
  createPayHereNotificationHash,
  formatPayHereAmount,
  parsePayHereFormBody,
  payHereStatus,
  signaturesMatch,
} from "../lib/payhere.js";

const fixture = {
  merchantId: "1211149",
  orderId: "ORDER-123",
  amount: "2500.00",
  currency: "LKR",
  secret: "UnitTestSecret-42",
};

test("PayHere checkout hashes use the documented uppercase MD5 formula", () => {
  assert.equal(
    createPayHereCheckoutHash(fixture.merchantId, fixture.orderId, fixture.amount, fixture.currency, fixture.secret),
    "A5172DB21F955C7498D36EC49B99B43C",
  );
});

test("PayHere notification hashes bind the final status", () => {
  assert.equal(
    createPayHereNotificationHash(fixture.merchantId, fixture.orderId, fixture.amount, fixture.currency, "2", fixture.secret),
    "5C8837B72138141FDAB2EBF32BA2C2FD",
  );
  assert.equal(
    createPayHereNotificationHash(fixture.merchantId, fixture.orderId, fixture.amount, fixture.currency, "-2", fixture.secret),
    "8838F4B54CB0449212F840B08261A0D1",
  );
});

test("signature comparison is case-insensitive but rejects mutations", () => {
  assert.equal(signaturesMatch("5c8837b72138141fdab2ebf32ba2c2fd", "5C8837B72138141FDAB2EBF32BA2C2FD"), true);
  assert.equal(signaturesMatch("5C8837B72138141FDAB2EBF32BA2C2F0", "5C8837B72138141FDAB2EBF32BA2C2FD"), false);
});

test("PayHere form callbacks and all documented status codes are parsed", () => {
  assert.deepEqual(parsePayHereFormBody("order_id=ORDER-123&status_code=2&payhere_amount=2500.00"), {
    order_id: "ORDER-123",
    status_code: "2",
    payhere_amount: "2500.00",
  });
  assert.equal(payHereStatus("2"), "paid");
  assert.equal(payHereStatus("0"), "pending");
  assert.equal(payHereStatus("-1"), "cancelled");
  assert.equal(payHereStatus("-2"), "failed");
  assert.equal(payHereStatus("-3"), "chargeback");
  assert.equal(payHereStatus("99"), null);
});

test("PayHere amounts are always sent with two decimal places", () => {
  assert.equal(formatPayHereAmount(4000), "4000.00");
  assert.equal(formatPayHereAmount(1500.5), "1500.50");
});
