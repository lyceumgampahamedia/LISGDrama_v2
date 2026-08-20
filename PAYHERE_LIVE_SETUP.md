# PayHere Live Setup and Deployment

This edition uses PayHere's hosted Checkout API and is locked to the official live checkout URL. Complete these steps only with the organisation's authorised PayHere and Firebase administrators.

## 1. Obtain domain approval and live credentials

In the PayHere Live merchant portal, open **Integrations**, choose **Add Domain/App**, and request approval for the exact production hostname.

For the current GitHub Pages deployment, the hostname is:

```text
lyceumgampahamedia.github.io
```

The current booking URL is:

```text
https://lyceumgampahamedia.github.io/LISGDrama_v2/
```

If the organisation uses a custom hostname instead, request approval for that hostname and update the verification handoff. A repository path such as `/LISGDrama_v2/` is not a hostname. PayHere issues a Merchant Secret for the approved domain/app, so a new hostname needs its own approved secret.

Obtain the live:

- Merchant ID
- Merchant Secret shown beside the approved production domain/app

Do not place either value in a Vite environment variable or GitHub source. Do not send the Merchant Secret in email or chat.

## 2. Set separate live Firebase secrets

Open Command Prompt in the project root and run:

```bat
npx firebase-tools@latest login
npx firebase-tools@latest functions:secrets:set PAYHERE_LIVE_MERCHANT_ID --project katanayaka-booking-v2
npx firebase-tools@latest functions:secrets:set PAYHERE_LIVE_MERCHANT_SECRET --project katanayaka-booking-v2
```

Each command prompts securely for its value. The code reads these values only inside Cloud Functions. Existing sandbox-named secrets are not used by this live edition.

## 3. Verify the public callback

The live PayHere notification URL is:

```text
https://asia-south1-katanayaka-booking-v2.cloudfunctions.net/payhereNotify
```

It must remain publicly reachable because PayHere calls it server-to-server. It does not trust browser authentication or App Check; it verifies PayHere's checksum and the matching Firestore payment session instead. Do not replace it with localhost or a GitHub Pages URL.

## 4. Deploy the trusted backend

Install backend dependencies and run the complete verification suite:

```bat
cd functions
npm install
cd ..
npm install
npm run verify
```

Then deploy:

```bat
npx firebase-tools@latest deploy --only functions,firestore:rules,firestore:indexes --project katanayaka-booking-v2
```

Deploying this package switches the shared payment Functions to the live credentials. If sandbox and live must operate simultaneously, use a separate Firebase project and separate PayHere credentials.

## 5. Prepare Firebase for the production hostname

In Firebase Console:

1. Authentication -> Settings -> Authorised domains: add the final hostname.
2. App Check -> your Web app: ensure the production hostname is registered for the reCAPTCHA v3 site key.
3. App Check -> APIs: keep enforcement enabled for Firestore and callable Functions after confirming valid tokens are issued on the live site.
4. Firestore: keep the supplied rules and indexes deployed.
5. Extensions: confirm Trigger Email is healthy and its SMTP credentials are configured.

Do not enable the App Check debug provider on the hosted domain. The included code enables it only for `localhost`, `127.0.0.1` and `[::1]`.

## 6. Deploy the frontend

This build has no PayHere endpoint variable. `src/config.js`, the form allowlist and the checkout Content Security Policy all permit only:

```text
https://www.payhere.lk/pay/checkout
```

If the repository still has a `PAYHERE_CHECKOUT_URL` GitHub Actions variable from sandbox testing, delete it to avoid confusion; the live workflow does not read it.

Upload the source files to GitHub while excluding the files listed in `README.md`. Open **Settings -> Pages**, choose **GitHub Actions**, and run the supplied workflow from the `main` branch.

## 7. Give PayHere the verification material

Provide:

- the deployed HTTPS booking URL;
- `PAYHERE_VERIFICATION_HANDOFF.md`;
- a temporary verification account only if PayHere specifically requests one;
- a contact person who can review Firebase logs during the test.

Do not send the Merchant Secret, Gmail App Password, Firebase service-account JSON, App Check debug token or real customer data.

## 8. Production acceptance checks

After PayHere authorises live testing, complete only the transactions they permit. Do not use sandbox test cards on the live endpoint.

For each test confirm:

1. The total shown before redirect equals the selected-seat total.
2. The browser posts to `https://www.payhere.lk/pay/checkout`.
3. A success notification creates a single `paymentEvents` document.
4. The `paymentSessions` document becomes `paid`.
5. The reservation and owned seats become `booked`.
6. Public/admin tier totals update.
7. Exactly one receipt document is queued and the email is delivered.
8. A cancelled or failed attempt releases the held seats.
9. A duplicate notification does not create another booking or receipt.

## 9. Rollback plan

Before opening sales, record the last known-good Git commit and Firebase deployment. If live verification fails, stop public checkout, preserve `paymentEvents`, `paymentSessions`, `reservations` and audit logs, and investigate before retrying. Never mark an order paid from the browser return page.
