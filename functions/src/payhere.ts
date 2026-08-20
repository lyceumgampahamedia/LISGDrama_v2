import {createHash, timingSafeEqual} from "node:crypto";

export type PayHereStatus = "paid" | "pending" | "cancelled" | "failed" | "chargeback";

const STATUS_BY_CODE: Readonly<Record<string, PayHereStatus>> = Object.freeze({
  "2": "paid",
  "0": "pending",
  "-1": "cancelled",
  "-2": "failed",
  "-3": "chargeback",
});

function md5Upper(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex").toUpperCase();
}

export function formatPayHereAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid PayHere amount.");
  return amount.toFixed(2);
}

export function createPayHereCheckoutHash(
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
  merchantSecret: string,
) {
  return md5Upper(`${merchantId}${orderId}${amount}${currency}${md5Upper(merchantSecret)}`);
}

export function createPayHereNotificationHash(
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
  statusCode: string,
  merchantSecret: string,
) {
  return md5Upper(`${merchantId}${orderId}${amount}${currency}${statusCode}${md5Upper(merchantSecret)}`);
}

export function signaturesMatch(supplied: string, expected: string) {
  const left = Buffer.from(supplied.trim().toUpperCase(), "utf8");
  const right = Buffer.from(expected.trim().toUpperCase(), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function payHereStatus(statusCode: string): PayHereStatus | null {
  return STATUS_BY_CODE[statusCode] || null;
}

export function parsePayHereFormBody(body: unknown): Record<string, string> {
  if (typeof body === "string") return Object.fromEntries(new URLSearchParams(body));
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "")]));
}
