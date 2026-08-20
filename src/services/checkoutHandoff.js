import { assetUrl } from "../config.js";

const STORAGE_KEY = "katanayaka-payhere-checkout-v2";
const PAYHERE_ENDPOINT = "https://www.payhere.lk/pay/checkout";
const PAYHERE_FIELDS = [
  "merchant_id", "notify_url", "order_id", "items", "currency", "amount", "hash",
  "first_name", "last_name", "email", "phone", "address", "city", "country", "custom_1", "custom_2",
];

function requiredText(value, label) {
  const clean = String(value || "").trim();
  if (!clean) throw new Error(`${label} is missing.`);
  return clean;
}

function sameOriginUrl(value, label) {
  const url = new URL(requiredText(value, label), window.location.href);
  if (url.origin !== window.location.origin) throw new Error(`${label} must use this website.`);
  return url.href;
}

export function saveCheckoutHandoff(session, returnUrl, cancelUrl) {
  const payhere = Object.fromEntries(PAYHERE_FIELDS.map((field) => [field, requiredText(session.payhere?.[field], `PayHere ${field}`)]));
  const handoff = {
    version: 2,
    sessionId: requiredText(session.sessionId, "Payment session"),
    payhere,
    returnUrl: sameOriginUrl(returnUrl, "Return URL"),
    cancelUrl: sameOriginUrl(cancelUrl, "Cancel URL"),
    expiresAtMs: Number(session.expiresAtMs),
  };
  if (!Number.isFinite(handoff.expiresAtMs)) throw new Error("Checkout expiry is invalid.");
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
  return handoff;
}

export function loadCheckoutHandoff() {
  try {
    const handoff = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (handoff?.version !== 2) return null;
    requiredText(handoff.sessionId, "Payment session");
    PAYHERE_FIELDS.forEach((field) => requiredText(handoff.payhere?.[field], `PayHere ${field}`));
    sameOriginUrl(handoff.returnUrl, "Return URL");
    sameOriginUrl(handoff.cancelUrl, "Cancel URL");
    if (!Number.isFinite(Number(handoff.expiresAtMs))) return null;
    return handoff;
  } catch {
    return null;
  }
}

export function clearCheckoutHandoff() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function checkoutPageUrl() {
  return new URL(assetUrl("checkout.html"), window.location.href).href;
}

export function postCheckoutToGateway(gatewayUrl, handoff) {
  const endpoint = new URL(requiredText(gatewayUrl, "PayHere checkout URL"));
  const normalizedEndpoint = `${endpoint.origin}${endpoint.pathname}`.replace(/\/$/, "");
  if (normalizedEndpoint !== PAYHERE_ENDPOINT || endpoint.search || endpoint.hash) throw new Error("The checkout URL must be the official PayHere Live endpoint.");

  const form = document.createElement("form");
  form.method = "POST";
  form.action = endpoint.href;
  const fields = [
    ...PAYHERE_FIELDS.map((name) => [name, handoff.payhere[name]]),
    ["return_url", handoff.returnUrl],
    ["cancel_url", handoff.cancelUrl],
  ];
  fields.forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = requiredText(value, name);
    form.append(input);
  });
  document.body.append(form);
  form.submit();
}
