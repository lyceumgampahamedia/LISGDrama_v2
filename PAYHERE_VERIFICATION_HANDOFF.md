# PayHere Verification Handoff — Garu Katanayaka Ticketing

## Merchant integration

| Item | Value |
|---|---|
| Integration type | PayHere Hosted Checkout API, one-time LKR payments |
| Production booking URL | `https://lyceumgampahamedia.github.io/LISGDrama_v2/` |
| Approved hostname requested | `lyceumgampahamedia.github.io` |
| Live checkout action | `https://www.payhere.lk/pay/checkout` |
| Server notification URL | `https://asia-south1-katanayaka-booking-v2.cloudfunctions.net/payhereNotify` |
| Return URL | Same booking origin with `payment=return` and an opaque session ID |
| Cancel URL | Same booking origin with `payment=cancelled` and an opaque session ID |
| Currency | LKR |
| Backend | Firebase Cloud Functions v2 and Firestore |
| Customer authentication | Firebase Authentication with Google |

If a different custom hostname will be used for production, replace the URL/hostname above and issue a Merchant Secret for that exact approved domain before verification.

## Checkout flow

1. The customer signs in with a verified Google account and selects one to eight available seats.
2. A callable Firebase Function validates the customer fields, recalculates the amount from the server seat-price map and transactionally holds the seats for fifteen minutes.
3. The Function creates the PayHere order hash using the live Merchant Secret held in Google Secret Manager.
4. The React checkout posts the signed order directly to PayHere Live. Card information is entered only on PayHere's hosted page.
5. PayHere posts the result to the public notification Function.
6. The Function verifies the checksum, merchant, order, amount, currency, reference, payment session and seat ownership before confirming the reservation.
7. A verified success confirms the seats and queues one email receipt. The browser return URL is informational only.

## Security and reconciliation controls

- The Merchant Secret is not present in the source ZIP, frontend bundle or GitHub repository.
- PayHere is the only party receiving card number, CVV and expiry data.
- Direct browser writes to reservations, payment sessions, payment events and seat records are denied by Firestore rules.
- Customer callable Functions require Firebase Authentication and App Check.
- Payment callbacks are idempotent using a deterministic event ID.
- Amount and currency are compared with the Firestore payment session.
- Late successes and chargebacks are retained for staff review instead of silently reallocating seats.
- Audit logs and payment event documents provide a reconciliation trail.

## Source review map

| File | Purpose |
|---|---|
| `src/config.js` | Fixed PayHere Live endpoint and public application configuration |
| `src/services/checkoutHandoff.js` | Strict live-endpoint allowlist and form handoff |
| `src/checkout/CheckoutApp.jsx` | Customer order review and redirect |
| `functions/src/index.ts` | Order creation, server callback verification and seat confirmation |
| `functions/src/payhere.ts` | PayHere amount, hash, signature and status helpers |
| `firestore.rules` | Client access controls |
| `PAYHERE_REVIEW_CHECKLIST.md` | Security and acceptance checklist |

Live Merchant credentials will be configured directly in Firebase Secret Manager after domain approval and will not be supplied in source code.
