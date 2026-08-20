# Production-Candidate Verification Results

Verification date: 20 August 2026

## Passed locally

- Seat configuration and availability tests: 7 passed, 0 failed.
- React/Vite production build: passed; 58 modules transformed.
- TypeScript Cloud Functions compilation: passed.
- PayHere checkout hash, notification hash, signature, callback/status and amount-format tests: 5 passed, 0 failed.
- Media build check: `BG.png`, `Logo.svg`, `Asset1.png` and `TLogo.png` were emitted into the production build.
- Endpoint scan: no operational sandbox checkout URL or old frontend endpoint variable remains outside excluded local/generated folders.
- Live endpoint check: built checkout handoff accepts only `https://www.payhere.lk/pay/checkout`.

## Requires external verification

These checks cannot be completed from source code alone:

- PayHere approval of the exact production hostname.
- Configuration of the live, domain-specific Merchant Secret in Firebase Secret Manager.
- Deployment of the live Functions and frontend.
- A PayHere-authorised live acceptance transaction.
- Receipt delivery through the organisation's configured SMTP account.

No live Merchant Secret, SMTP password, App Check debug token, service-account private key or card data is included in the distributable ZIP.
