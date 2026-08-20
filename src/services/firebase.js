import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { APP_CHECK_SITE_KEY, FIREBASE_CONFIG, FUNCTIONS_REGION } from "../config.js";

export const firebaseApp = initializeApp(FIREBASE_CONFIG);

// Use Firebase's debug provider only on local hostnames, including `vite preview`.
// Firebase prints the generated token in the browser console so it can be
// registered in App Check without weakening the deployed site.
const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
if (isLocalhost) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

const hasAppCheckKey = APP_CHECK_SITE_KEY && !APP_CHECK_SITE_KEY.startsWith("REPLACE_");
if (hasAppCheckKey) {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  console.warn("Firebase App Check is not configured. Protected Cloud Functions will reject requests until a valid site key is added.");
}

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);
