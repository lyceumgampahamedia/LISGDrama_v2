# PayHere Live Integration Review Checklist

## Configuration

- [ ] PayHere has approved the exact production hostname.
- [ ] The live Merchant Secret belongs to that approved hostname.
- [ ] `PAYHERE_LIVE_MERCHANT_ID` exists only in Firebase Secret Manager.
- [ ] `PAYHERE_LIVE_MERCHANT_SECRET` exists only in Firebase Secret Manager.
- [ ] No `.env.local`, debug token, service account, SMTP password or gateway secret is committed.
- [ ] Frontend checkout, allowlist and CSP use only `https://www.payhere.lk/pay/checkout`.
- [ ] The public notification URL is `https://asia-south1-katanayaka-booking-v2.cloudfunctions.net/payhereNotify`.
- [ ] The final hostname is authorised in Firebase Authentication and App Check.

## Payment integrity

- [ ] Firebase recalculates totals from its own seat-price map.
- [ ] Checkout hashes are created only in Cloud Functions.
- [ ] PayHere notifications are verified with the documented uppercase MD5 checksum.
- [ ] Merchant ID, order ID, amount, currency, reference and session are checked.
- [ ] Seat ownership is rechecked inside the success transaction.
- [ ] Return/cancel URLs never mark a reservation paid.
- [ ] Duplicate callbacks cannot create a second booking or receipt.
- [ ] Failed/cancelled payments release only seats owned by their reservation.
- [ ] Chargebacks and late successful payments enter manual review when required.

## Firebase and operations

- [ ] App Check enforcement remains active for browser callable Functions and Firestore.
- [ ] Google Authentication identifies customers and verified email is required.
- [ ] The `admin: true` custom claim protects staff actions.
- [ ] Firestore rules prevent direct client writes to booking/payment collections.
- [ ] Trigger Email reports `delivery.state: SUCCESS` for a verified test receipt.
- [ ] Firebase logs are monitored during PayHere verification.
- [ ] Staff know how to reconcile `paymentEvents`, `paymentSessions` and `reservations`.

## Acceptance tests

- [ ] Production-domain redirect reaches PayHere Live.
- [ ] PayHere-approved successful test transaction.
- [ ] Cancelled payment.
- [ ] Failed payment, if PayHere supplies a supported test method.
- [ ] Pending payment followed by success, if supported.
- [ ] Invalid checksum rejected.
- [ ] Wrong Merchant ID rejected.
- [ ] Modified amount or currency rejected.
- [ ] Duplicate callback creates one receipt.
- [ ] Expired session cannot book a reallocated seat.
- [ ] Two users cannot hold the same seat.
- [ ] Public/admin Block A, B and C totals update after confirmation.
- [ ] Receipt reaches the customer's verified Google email.

Any successful callback received after a session becomes inactive is stored for manual review and cannot overwrite a seat belonging to another reservation.
