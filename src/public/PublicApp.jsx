import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import castArtworkUrl from "../../images/Asset1.png";
import logoUrl from "../../images/Logo.svg";
import {
  ALL_SEATS,
  COPY,
  MAX_SEATS,
  SEAT_BY_ID,
  SHOWS,
  TOTAL_SEATS,
} from "../config.js";
import useShowSeatRecords from "../hooks/useShowSeatRecords.js";
import { clearCheckoutHandoff, saveCheckoutHandoff, checkoutPageUrl } from "../services/checkoutHandoff.js";
import { auth } from "../services/firebase.js";
import { createPaymentSession, getPaymentStatus } from "../services/bookingApi.js";
import { activeSeatStatus, summarizeSeatRecords } from "../services/seatAvailability.js";
import TierSalesBreakdown from "../components/TierSalesBreakdown.jsx";
import BookingDialog from "./components/BookingDialog.jsx";
import SeatMap from "./components/SeatMap.jsx";
import SelectionPanel from "./components/SelectionPanel.jsx";
import SuccessDialog from "./components/SuccessDialog.jsx";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const seatOrder = new Map(ALL_SEATS.map((seat, index) => [seat.id, index]));
const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function googleSignInMessage(error) {
  const code = String(error?.code || "");
  if (code.includes("unauthorized-domain")) return "Google sign-in is not enabled for this website address. Add this hostname to Firebase Authentication → Settings → Authorized domains.";
  if (code.includes("operation-not-allowed")) return "Google sign-in is disabled in Firebase. Enable Google under Authentication → Sign-in method.";
  if (code.includes("popup-blocked")) return "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.";
  if (code.includes("popup-closed-by-user")) return "The Google sign-in window was closed before sign-in finished.";
  if (code.includes("invalid-api-key")) return "The Firebase Web API key in src/config.js is invalid.";
  return "Google sign-in could not be completed. Check the browser console for the Firebase error code.";
}

export default function PublicApp() {
  const [language, setLanguage] = useState(() => localStorage.getItem("katanayaka-language") === "si" ? "si" : "en");
  const [showId, setShowId] = useState("show1");
  const [selected, setSelected] = useState(new Set());
  const [now, setNow] = useState(Date.now());
  const [user, setUser] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [bookingUser, setBookingUser] = useState(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [payment, setPayment] = useState(null);
  const [toast, setToast] = useState("");
  const [guideVisible, setGuideVisible] = useState(() => sessionStorage.getItem("katanayaka-guide-seen") !== "true");
  const toastTimer = useRef(null);
  const paymentReturnChecked = useRef(false);
  const { recordsByShow, connection } = useShowSeatRecords();
  const records = recordsByShow[showId];

  const t = useCallback((key) => COPY[language][key] ?? COPY.en[key] ?? key, [language]);
  const getStatus = useCallback((record) => activeSeatStatus(record, now), [now]);

  const selectedIds = useMemo(
    () => [...selected].sort((a, b) => seatOrder.get(a) - seatOrder.get(b)),
    [selected],
  );
  const selectionTotal = useMemo(
    () => selectedIds.reduce((sum, id) => sum + SEAT_BY_ID.get(id).block.price, 0),
    [selectedIds],
  );
  const statsByShow = useMemo(
    () => Object.fromEntries(Object.keys(SHOWS).map((id) => [id, summarizeSeatRecords(recordsByShow[id], TOTAL_SEATS, now)])),
    [recordsByShow, now],
  );
  const selectedShowStats = statsByShow[showId];
  const totalSold = Object.values(statsByShow).reduce((sum, stats) => sum + stats.sold, 0);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  }, []);

  const ensureSignedIn = useCallback(async () => {
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser;
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("katanayaka-language", language);
  }, [language]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelected((current) => new Set([...current].filter((seatId) => activeSeatStatus(records.get(seatId), Date.now()) === "available")));
  }, [records]);

  useEffect(() => () => {
    window.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (paymentReturnChecked.current) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session");
    const returnState = params.get("payment");
    if (!sessionId || !params.has("payment")) return;
    paymentReturnChecked.current = true;

    async function checkPayment() {
      try {
        clearCheckoutHandoff();
        await ensureSignedIn();
        let returnedPayment=(await getPaymentStatus({sessionId})).data;
        for (let attempt=0; attempt<10 && returnedPayment.status==="created"; attempt+=1) {
          await delay(1500);
          returnedPayment=(await getPaymentStatus({sessionId})).data;
        }
        if (returnState==="cancelled" && returnedPayment.status!=="paid") {
          if (returnedPayment.status!=="created") window.history.replaceState({},"",window.location.pathname);
          showToast(returnedPayment.status==="created"?"PayHere is processing the cancellation. The hold will release automatically.":"Payment was cancelled. Your held seats were released.");
          return;
        }
        if (returnedPayment.status !== "paid") {
          if (returnedPayment.status!=="created") window.history.replaceState({},"",window.location.pathname);
          showToast(
            returnedPayment.status === "created"
              ? "PayHere is still confirming the payment. Check again shortly."
              : `Payment status: ${returnedPayment.status}. Your seats were not confirmed.`,
          );
          return;
        }
        window.history.replaceState({},"",window.location.pathname);
        setSelected(new Set());
        setPayment(returnedPayment);
      } catch (error) {
        console.error("Payment return", error);
        showToast("Sign in with the same Google account to check this payment.");
      }
    }

    checkPayment();
  }, [ensureSignedIn, showToast]);

  function changeShow(nextShowId) {
    setShowId(nextShowId);
    setSelected(new Set());
  }

  function toggleSeat(seatId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(seatId)) {
        next.delete(seatId);
        return next;
      }
      if (next.size >= MAX_SEATS) {
        showToast(t("limit"));
        return current;
      }
      if (getStatus(records.get(seatId)) === "available") next.add(seatId);
      return next;
    });
  }

  async function openBooking() {
    if (!selectedIds.length) return;
    try {
      const signedInUser = await ensureSignedIn();
      setBookingUser(signedInUser);
      setBookingOpen(true);
    } catch (error) {
      console.error("Google sign-in", error);
      showToast(googleSignInMessage(error));
    }
  }

  async function submitReservation(formData) {
    const name = String(formData.get("name") || "").trim();
    const contact = String(formData.get("contact") || "").replace(/[\s-]/g, "");
    const address = String(formData.get("address") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const idNumber = String(formData.get("idNumber") || "").trim();

    if (name.length < 2 || name.length > 80) throw new Error(t("invalidName"));
    if (!/^(?:\+94\d{9}|0\d{9})$/.test(contact)) throw new Error(t("invalidContact"));
    if (address.length < 5 || address.length > 160) throw new Error(t("invalidAddress"));
    if (city.length < 2 || city.length > 80) throw new Error(t("invalidCity"));
    if (idNumber.length > 20) throw new Error(t("invalidId"));
    try {
      await ensureSignedIn();
      const result = await createPaymentSession({
        showId,
        seatIds: selectedIds,
        customer: { name, contact, address, city, ...(idNumber ? { idNumber } : {}) },
      });
      const session = result.data;
      const base = new URL(window.location.href);
      base.search = "";
      base.hash = "";
      const returnUrl = new URL(base);
      returnUrl.searchParams.set("payment", "return");
      returnUrl.searchParams.set("session", session.sessionId);
      const cancelUrl = new URL(base);
      cancelUrl.searchParams.set("payment", "cancelled");
      cancelUrl.searchParams.set("session", session.sessionId);

      saveCheckoutHandoff(session, returnUrl.href, cancelUrl.href);
      window.location.assign(checkoutPageUrl());
    } catch (error) {
      console.error("Checkout", error);
      const code = String(error?.code || "");
      throw new Error(code.includes("already-exists") ? t("unavailable") : t("genericError"));
    }
  }

  async function toggleAuthentication() {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      if (user) await signOut(auth);
      else await ensureSignedIn();
    } catch (error) {
      console.error("Authentication", error);
      showToast(googleSignInMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function copyReference(reference) {
    try {
      await navigator.clipboard.writeText(reference);
      showToast(t("copied"));
    } catch {
      showToast(`Reference: ${reference}`);
    }
  }

  const connectionText = connection === "live" ? t("live") : connection === "error" ? t("loadError") : t("loading");

  return (
    <>
      <main className={`site-shell ${showId === "show1" ? "show-one" : "show-two"}`}>
        <header className="site-header">
          <a className="brand" href="./" aria-label="Lyceum International School Gampaha">
            <img className="brand-logo" src={logoUrl} alt="Lyceum International School Gampaha logo" />
          </a>
          <div className="header-actions">
            <div className="public-auth"><span>{user?.email || ""}</span><button type="button" disabled={authBusy} onClick={toggleAuthentication}>{authBusy ? t("signingIn") : user ? t("signOut") : t("signInGoogle")}</button></div>
            <div className="language-switcher" role="group" aria-label="Language">
              <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
              <button type="button" aria-pressed={language === "si"} onClick={() => setLanguage("si")}>සිං</button>
            </div>
          </div>
        </header>

        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow">{t("kicker")}</p>
            <h1 id="page-title">{t("title")}</h1>
            <p className="event-meta"><time dateTime="2026-09-03">{t("eventDate")}</time><span aria-hidden="true">•</span><span>{t("venue")}</span></p>
          </div>
          <img className="cast-artwork" src={castArtworkUrl} alt="Garu Katanayaka cast artwork" />
          <div className={`connection-pill ${connection}`} role="status"><i aria-hidden="true" /><span>{connectionText}</span></div>
        </section>

        {guideVisible && (
          <aside className="guide-card" aria-labelledby="guide-title">
            <strong className="guide-number" aria-hidden="true">1—2—3</strong>
            <div><h2 id="guide-title">{t("guideTitle")}</h2><p>{t("guideText")}</p></div>
            <button className="icon-button" type="button" aria-label="Dismiss instructions" onClick={() => { setGuideVisible(false); sessionStorage.setItem("katanayaka-guide-seen", "true"); }}>×</button>
          </aside>
        )}

        <section className="show-picker" aria-labelledby="show-title">
          <div className="section-heading">
            <div><span className="step">01</span><h2 id="show-title">{t("chooseShow")}</h2></div>
            <div className="availability-summary">
              <p><strong>{selectedShowStats.available}</strong> / {TOTAL_SEATS} {t("availableCount")}</p>
              <p><strong>{selectedShowStats.sold}</strong> {t("soldCount")}</p>
            </div>
          </div>
          <div className="show-options" role="radiogroup" aria-labelledby="show-title">
            {Object.entries(SHOWS).map(([id, show], index) => (
              <button className="show-option" type="button" role="radio" aria-checked={showId === id} key={id} onClick={() => changeShow(id)}>
                <span>{t(index === 0 ? "afternoonShow" : "eveningShow")}</span>
                <strong>{show.time}</strong>
                <time dateTime={show.startsAt}>{t("eventDate")}</time>
              </button>
            ))}
          </div>
          <TierSalesBreakdown statsByShow={statsByShow} title={t("soldByBlock")} blockLabel={t("block")} className="public-tier-sales" />
          <p className="total-sold-strip"><span>{t("totalSold")}</span><strong>{totalSold} / {TOTAL_SEATS * Object.keys(SHOWS).length}</strong></p>
        </section>

        <aside className="notice-card"><span className="notice-icon" aria-hidden="true">15</span><div><h2>{t("holdTitle")}</h2><p>{t("holdText")}</p></div></aside>

        <section className={`account-card ${user ? "signed-in" : "signed-out"}`} aria-labelledby="account-title">
          <div className="google-mark" aria-hidden="true">G</div>
          <div className="account-copy">
            <span>{t("accountTitle")}</span>
            <h2 id="account-title">{user ? `${t("signedInAs")} ${user.displayName || user.email}` : t("signedOut")}</h2>
            {user?.email && user.displayName ? <p>{user.email}</p> : null}
          </div>
          <button type="button" disabled={authBusy} onClick={toggleAuthentication}>{authBusy ? t("signingIn") : user ? t("signOut") : t("signInGoogle")}</button>
        </section>

        <div className="booking-layout">
          <section className="map-card" aria-labelledby="map-title">
            <div className="map-toolbar">
              <div><span className="step">02</span><h2 id="map-title">{t("chooseSeats")}</h2></div>
              <div className="legend" aria-label="Seat status legend">
                <span><i className="available" aria-hidden="true" /><b>{t("available")}</b></span>
                <span><i className="selected" aria-hidden="true" /><b>{t("selected")}</b></span>
                <span><i className="reserved" aria-hidden="true" /><b>{t("reserved")}</b></span>
                <span><i className="booked" aria-hidden="true" /><b>{t("booked")}</b></span>
              </div>
            </div>
            <div className="stage"><span>{t("stage")}</span></div>
            <p className="scroll-hint">↔ <span>{t("swipe")}</span></p>
            <div className="seat-map-scroll" tabIndex="0" aria-label="Scrollable seating plan">
              <SeatMap records={records} selected={selected} getStatus={getStatus} language={language} t={t} onToggle={toggleSeat} />
            </div>
          </section>

          <aside className="booking-sidebar">
            <section className="selection-card" aria-labelledby="selection-title">
              <div className="selection-heading"><span className="step">03</span><h2 id="selection-title">{t("selection")}</h2></div>
              <SelectionPanel ids={selectedIds} total={selectionTotal} language={language} t={t} onRemove={toggleSeat} onClear={() => setSelected(new Set())} onContinue={openBooking} />
            </section>
            <section className="contact-card" aria-labelledby="contact-title">
              <h2 id="contact-title">{t("help")}</h2>
              <a className="location-button" href="https://maps.app.goo.gl/yVu36FgHAEJABUc9A" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">⌖</span><span>{t("directions")}</span></a>
              <div className="phone-links"><a href="tel:+94760983221"><small>{t("call")}</small>076 098 3221</a><a href="tel:+94334928842"><small>{t("call")}</small>033 492 8842</a></div>
            </section>
            <a className="staff-link" href="./admin.html">🔒 <span>{t("staff")}</span></a>
          </aside>
        </div>

        <footer><p>© 2026 {t("school")}</p><p>Zeus Hall · Gampaha</p></footer>
      </main>

      <BookingDialog open={bookingOpen} user={bookingUser} ids={selectedIds} total={selectionTotal} language={language} t={t} onClose={() => setBookingOpen(false)} onSubmit={submitReservation} />
      <SuccessDialog payment={payment} language={language} t={t} onClose={() => setPayment(null)} onCopy={copyReference} />
      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
