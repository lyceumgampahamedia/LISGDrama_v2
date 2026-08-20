import { useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from "firebase/auth";
import logoUrl from "../../images/Logo.svg";
import { PAYHERE_CHECKOUT_URL, SHOWS, assetUrl, formatLkr } from "../config.js";
import { cancelPaymentSession, getPaymentStatus } from "../services/bookingApi.js";
import { clearCheckoutHandoff, loadCheckoutHandoff, postCheckoutToGateway } from "../services/checkoutHandoff.js";
import { auth } from "../services/firebase.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function countdown(milliseconds) {
  if (milliseconds <= 0) return "Expired";
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function CheckoutApp() {
  const [handoff] = useState(loadCheckoutHandoff);
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [state, setState] = useState(handoff ? "checking-account" : "missing");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const expiresAtMs = Number(session?.expiresAtMs || handoff?.expiresAtMs || 0);
  const remaining = expiresAtMs - now;
  const canPay = session?.status === "created" && remaining > 0 && Boolean(PAYHERE_CHECKOUT_URL);
  const publicPageUrl = useMemo(() => new URL(assetUrl("index.html"), window.location.href).href, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);
    if (!handoff) return;
    if (!currentUser) {
      setState("sign-in");
      return;
    }
    setState("loading");
    setError("");
    try {
      const result = await getPaymentStatus({ sessionId: handoff.sessionId });
      setSession(result.data);
      setState("ready");
    } catch (checkoutError) {
      console.error("Checkout verification", checkoutError);
      setError("This checkout could not be verified. Sign in with the Google account that created the booking, or return to the seat map.");
      setState("error");
    }
  }), [handoff]);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (signInError) {
      console.error("Checkout sign-in", signInError);
      setError("Google sign-in was not completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function continueToBank() {
    if (!canPay || !handoff) return;
    setBusy(true);
    setError("");
    try {
      postCheckoutToGateway(PAYHERE_CHECKOUT_URL, handoff);
    } catch (gatewayError) {
      console.error("Gateway handoff", gatewayError);
      setBusy(false);
      setError(gatewayError.message || "The secure payment page could not be opened.");
    }
  }

  async function cancelCheckout() {
    if (!handoff || busy) return;
    setBusy(true);
    setError("");
    try {
      if (session?.status === "created") await cancelPaymentSession({ sessionId: handoff.sessionId });
      const destination = handoff.cancelUrl;
      clearCheckoutHandoff();
      window.location.assign(destination);
    } catch (cancelError) {
      console.error("Checkout cancellation", cancelError);
      setError("The booking could not be cancelled yet. Please retry; otherwise the seat hold will expire automatically.");
      setBusy(false);
    }
  }

  if (state === "missing") {
    return (
      <main className="checkout-shell">
        <section className="checkout-card checkout-message">
          <img src={logoUrl} alt="Lyceum International School Gampaha" />
          <span className="checkout-icon" aria-hidden="true">!</span>
          <h1>No active checkout</h1>
          <p>Choose seats on the booking page to create a secure 15-minute payment session.</p>
          <a className="primary-button" href={publicPageUrl}>Return to seat selection</a>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-shell">
      <header className="checkout-header">
        <a href={publicPageUrl}><img src={logoUrl} alt="Lyceum International School Gampaha" /></a>
        <span>Secure PayHere checkout</span>
      </header>
      <section className="checkout-grid">
        <article className="checkout-card checkout-order">
          <p className="eyebrow">Order review</p>
          <h1>Confirm your tickets</h1>
          {state === "checking-account" || state === "loading" ? <p role="status">Verifying your secure payment session…</p> : null}
          {state === "sign-in" ? (
            <div className="checkout-sign-in">
              <p>Sign in with the same Google account used to select these seats.</p>
              <button className="primary-button" type="button" disabled={busy} onClick={signIn}>Continue with Google</button>
            </div>
          ) : null}
          {session ? (
            <dl className="checkout-details">
              <div><dt>Reference</dt><dd>{session.reference}</dd></div>
              <div><dt>Show</dt><dd>{SHOWS[session.showId]?.time || session.showId}</dd></div>
              <div><dt>Seats</dt><dd>{session.seatIds.join(", ")}</dd></div>
              <div><dt>Google account</dt><dd>{user?.email || "—"}</dd></div>
              <div><dt>Total</dt><dd>{formatLkr(session.amount)}</dd></div>
            </dl>
          ) : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {session && session.status !== "created" ? <p className="checkout-status-note">This session is <strong>{session.status}</strong> and cannot start another payment.</p> : null}
          {session?.status === "created" && remaining <= 0 ? <p className="form-error">This seat hold has expired. Return to the seat map to choose again.</p> : null}
        </article>

        <aside className="checkout-card checkout-payment">
          <span className="secure-mark" aria-hidden="true">✓</span>
          <span className="gateway-mode-badge live">PayHere Live</span>
          <h2>Pay securely with PayHere</h2>
          <p>Your total and signed order are created by Firebase. The PayHere Merchant Secret is never stored in this page or GitHub.</p>
          <div className={`checkout-timer ${remaining <= 60_000 ? "urgent" : ""}`}><span>Seat hold remaining</span><strong>{countdown(remaining)}</strong></div>
          <button className="primary-button" type="button" disabled={!canPay || busy} onClick={continueToBank}>{busy ? "Opening PayHere…" : "Continue to PayHere"}</button>
          {session?.status === "created" ? <button className="text-button" type="button" disabled={busy} onClick={cancelCheckout}>Cancel and release seats</button> : <a className="checkout-return-link" href={publicPageUrl}>Return to booking page</a>}
          <small>Seats are confirmed only after Firebase validates PayHere’s signed server notification.</small>
        </aside>
      </section>
    </main>
  );
}
