# Garu Katanayaka Booking System — PayHere Live Verification Edition

This is the production-candidate React + Vite ticketing project prepared for PayHere domain and integration verification. It preserves the existing `katanayaka-booking-v2` Firebase project, Firestore seat data, Google sign-in, App Check, admin tools, email-receipt queue, ticket-sales breakdowns and original event media.

The checkout is intentionally locked to PayHere Live:

```text
https://www.payhere.lk/pay/checkout
```

Read `PAYHERE_LIVE_SETUP.md` before deployment. Send `PAYHERE_VERIFICATION_HANDOFF.md` with the hosted verification URL to PayHere. Use `PAYHERE_REVIEW_CHECKLIST.md` for the final technical review and `VERIFICATION_RESULTS.md` for the local build/test record.

## Important: the ZIP contains no live credentials

The live Merchant ID and domain-specific Merchant Secret must be entered into Firebase Secret Manager by an authorised administrator. They must never be added to React, Vite, GitHub, `.env.local`, screenshots or this ZIP.

This code cannot process a live payment until PayHere approves the production domain and the live secrets are configured. PayHere verifies the deployed HTTPS site, not only a source-code ZIP.

## Payment architecture

- Firebase recalculates the selected-seat total and signs every order server-side.
- React posts the signed fields directly to PayHere's hosted checkout.
- Customers enter card details only on PayHere; this project never receives or stores them.
- The public `payhereNotify` Cloud Function verifies the Merchant ID, checksum, order, amount, currency, status and seat ownership.
- A browser return URL is never accepted as proof of payment.
- Successful notifications confirm seats transactionally and queue one receipt email.
- Duplicate notifications are idempotent; failed/cancelled payments release only that reservation's seats.
- Chargebacks and late success notifications are retained for staff review.

## Technology

- React 19 and Vite 8
- Firebase JavaScript SDK 12
- Firebase Authentication, Firestore, App Check and Cloud Functions v2
- TypeScript Functions on Node.js 22
- PayHere hosted Checkout API
- GitHub Pages deployment through GitHub Actions

## Original media retained

```text
images/BG.png
images/Logo.svg
images/Asset1.png
images/TLogo.png
```

Vite imports and fingerprints these files, and the build also copies stable `images/` URLs. Do not recreate the obsolete `assets/images/` directory. GitHub Pages filenames are case-sensitive.

## Local source check

Install Node.js 22 LTS, extract the ZIP, and run these commands from the project folder:

```bat
npm install
cd functions
npm install
cd ..
npm run verify
npm run dev
```

Open the Vite address, normally `http://localhost:5173/`. The admin and checkout pages are `/admin.html` and `/checkout.html`. Local verification can validate UI and Firebase behavior, but PayHere Live requires an approved public HTTPS domain and a public notification URL.

## Deployment summary

1. Ask PayHere to approve the production hostname under the merchant account's Integrations section.
2. Set `PAYHERE_LIVE_MERCHANT_ID` and `PAYHERE_LIVE_MERCHANT_SECRET` in Firebase Secret Manager.
3. Deploy Functions, Firestore rules and indexes.
4. Upload the source to GitHub, excluding generated/dependency/private files, and let the included workflow build GitHub Pages.
5. Give PayHere the deployed site URL and `PAYHERE_VERIFICATION_HANDOFF.md`.
6. Complete the checklist before opening sales.

Exact commands and checks are in `PAYHERE_LIVE_SETUP.md`.

## Files not to upload to GitHub

```text
node_modules/
functions/node_modules/
dist/
functions/lib/
.env.local
.firebase/
firebase-debug*.log
service-account*.json
```

The supplied `.gitignore` already excludes them. The downloadable ZIP also excludes them.

## Existing features retained

- 600 seats per show across Blocks A, B and C.
- Two shows with independent live Firestore availability.
- Maximum eight seats per checkout and a fifteen-minute payment hold.
- Public and admin sold/total breakdowns for every tier and show.
- Google customer sign-in and `admin: true` custom-claim staff access.
- Admin direct walk-in booking, cancellation and audit logs.
- Firestore rules blocking browser writes to protected booking/payment collections.
- Bilingual interface and original event assets.

## Main folders

```text
images/                    Original event media
src/public/                Public booking interface
src/checkout/              PayHere order review and live redirect
src/admin/                 Staff dashboard and walk-in booking
src/services/              Firebase and checkout handoff services
functions/src/index.ts     Trusted booking/payment backend
functions/src/payhere.ts   PayHere hashing, parsing and status helpers
functions/scripts/         Admin/migration/verification scripts
tests/                     Seat and availability tests
.github/workflows/         GitHub Pages deployment
```
