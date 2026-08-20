import { useEffect, useMemo, useRef, useState } from "react";
import { browserSessionPersistence, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { SEAT_BY_ID, SHOWS, TOTAL_SEATS, formatLkr } from "../config.js";
import useShowSeatRecords from "../hooks/useShowSeatRecords.js";
import { auth, db } from "../services/firebase.js";
import { cancelReservation, confirmPayment } from "../services/bookingApi.js";
import { summarizeSeatRecords } from "../services/seatAvailability.js";
import TierSalesBreakdown from "../components/TierSalesBreakdown.jsx";
import WalkInDialog from "./WalkInDialog.jsx";

function timestampText(value) {
  return value?.toDate?.().toLocaleString("en-LK") || "—";
}

function maskId(value = "") {
  return value ? `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : "—";
}

function totalFor(reservation) {
  return reservation.total ?? reservation.seatIds.reduce((sum, id) => sum + (SEAT_BY_ID.get(id)?.block.price || 0), 0);
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export default function AdminApp() {
  const [view, setView] = useState("loading");
  const [adminEmail, setAdminEmail] = useState("");
  const [reservations, setReservations] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [loginError, setLoginError] = useState("");
  const [adminError, setAdminError] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const { recordsByShow, connection: seatConnection } = useShowSeatRecords(view === "dashboard");

  const visibleReservations = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reservations.filter((item) => (
      (statusFilter === "all" || item.status === statusFilter)
      && (!needle || [item.reference, item.customer?.name, item.customer?.contact, ...(item.seatIds || [])].join(" ").toLowerCase().includes(needle))
    ));
  }, [reservations, search, statusFilter]);

  const counts = useMemo(() => ({
    paymentPending: reservations.filter((item) => item.status === "payment_pending").length,
    reserved: reservations.filter((item) => item.status === "reserved").length,
    booked: reservations.filter((item) => item.status === "booked").length,
    expired: reservations.filter((item) => item.status === "expired").length,
    total: reservations.length,
  }), [reservations]);
  const sales = useMemo(() => {
    const byShow = Object.fromEntries(Object.keys(SHOWS).map((showId) => [
      showId,
      summarizeSeatRecords(recordsByShow[showId], TOTAL_SEATS),
    ]));
    return { byShow, total: Object.values(byShow).reduce((sum, stats) => sum + stats.sold, 0) };
  }, [recordsByShow]);

  function showToast(message) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 4200);
  }

  useEffect(() => {
    let reservationUnsubscribe = () => {};
    let active = true;

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      reservationUnsubscribe();
      reservationUnsubscribe = () => {};
      if (!active) return;
      if (!user) {
        setAdminEmail("");
        setReservations([]);
        setView("login");
        return;
      }

      setView("loading");
      try {
        const token = await user.getIdTokenResult(true);
        if (token.claims.admin !== true) {
          await signOut(auth);
          if (active) setLoginError("This account is not authorised for the staff portal.");
          return;
        }
      } catch {
        await signOut(auth);
        return;
      }

      if (!active) return;
      setAdminEmail(user.email || "");
      setView("dashboard");
      reservationUnsubscribe = onSnapshot(
        query(collection(db, "reservations"), orderBy("createdAt", "desc"), limit(500)),
        (snapshot) => {
          if (!active) return;
          setReservations(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })).filter((item) => Array.isArray(item.seatIds)));
          setAdminError("");
        },
        () => active && setAdminError("Reservations could not be loaded. Check your connection and admin permissions."),
      );
    });

    return () => {
      active = false;
      reservationUnsubscribe();
      authUnsubscribe();
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  async function login(event) {
    event.preventDefault();
    setLoginError("");
    const data = new FormData(event.currentTarget);
    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, String(data.get("email") || "").trim(), String(data.get("password") || ""));
      event.currentTarget.reset();
    } catch {
      setLoginError("Sign-in failed. Check the credentials and admin access.");
    }
  }

  async function runAction(reservation, action) {
    if (action === "cancel" && !window.confirm(`Cancel reservation ${reservation.reference}?`)) return;
    setBusyId(reservation.id);
    setAdminError("");
    try {
      if (action === "confirm") await confirmPayment({ reservationId: reservation.id });
      else await cancelReservation({ reservationId: reservation.id });
    } catch {
      setAdminError("The action could not be completed. Refresh and try again.");
    } finally {
      setBusyId("");
    }
  }

  function exportCsv() {
    const headings = ["Reference", "Show", "Seats", "Name", "Contact", "ID", "Status", "Total", "Created", "Expires"];
    const rows = visibleReservations.map((item) => [
      item.reference,
      SHOWS[item.showId]?.time,
      item.seatIds.join(" "),
      item.customer?.name,
      item.customer?.contact,
      item.customer?.idNumber || "",
      item.status,
      totalFor(item),
      item.createdAt?.toDate?.().toISOString() || "",
      item.expiresAt?.toDate?.().toISOString() || "",
    ]);
    const blob = new Blob([`\uFEFF${[headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `katanayaka-reservations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (view === "loading") {
    return <main className="admin-shell"><section className="admin-loading" role="status">Checking staff access…</section></main>;
  }

  if (view === "login") {
    return (
      <main className="admin-shell">
        <section className="admin-login-card">
          <a href="./" className="back-link">← Public booking page</a>
          <span className="brand-mark" aria-hidden="true">L</span>
          <p className="eyebrow">Authorised staff only</p>
          <h1>Booking staff portal</h1>
          <p>Sign in with a Firebase account that has the server-issued admin claim.</p>
          <form onSubmit={login}>
            <label>Email address<input name="email" type="email" autoComplete="username" required autoFocus /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
            {loginError && <p className="form-error" role="alert">{loginError}</p>}
            <button className="primary-button" type="submit">Sign in securely</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="admin-shell">
        <section>
          <header className="admin-header">
            <div><p className="eyebrow">Garu Katanayaka</p><h1>Reservation dashboard</h1><p>{adminEmail}</p></div>
            <div className="admin-header-actions">
              <button className="walk-in-trigger" type="button" onClick={() => setWalkInOpen(true)}>+ Confirm walk-in booking</button>
              <a href="./">View booking page</a>
              <button type="button" onClick={() => signOut(auth)}>Sign out</button>
            </div>
          </header>
          <section className="ticket-sales-stats" aria-label="Live ticket sales">
            <article><span>Tickets sold — both shows</span><strong>{sales.total} <small>/ {TOTAL_SEATS * Object.keys(SHOWS).length}</small></strong></article>
            <TierSalesBreakdown statsByShow={sales.byShow} title="Confirmed tickets sold by block" className="admin-tier-sales" />
            <p className={`sales-live-status ${seatConnection}`}><i aria-hidden="true" />{seatConnection === "live" ? "Live seat totals" : seatConnection === "error" ? "Seat totals unavailable" : "Loading seat totals…"}</p>
          </section>
          <section className="admin-stats" aria-label="Reservation summary">
            <article><span>Payment pending</span><strong>{counts.paymentPending}</strong></article>
            <article><span>Tentative</span><strong>{counts.reserved}</strong></article>
            <article><span>Confirmed bookings</span><strong>{counts.booked}</strong></article>
            <article><span>Expired</span><strong>{counts.expired}</strong></article>
            <article><span>Total records</span><strong>{counts.total}</strong></article>
          </section>
          <section className="admin-table-card">
            <div className="admin-toolbar">
              <label><span>Search reservations</span><input type="search" placeholder="Reference, name, phone or seat" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="payment_pending">Payment pending</option><option value="reserved">Tentative</option><option value="booked">Confirmed</option><option value="payment_failed">Payment failed</option><option value="chargeback">Chargeback review</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select></label>
              <button className="secondary-button" type="button" onClick={exportCsv}>Export CSV</button>
            </div>
            {adminError && <p className="form-error" role="alert">{adminError}</p>}
            <div className="table-scroll">
              <table>
                <thead><tr><th>Reference</th><th>Customer</th><th>Show & seats</th><th>Status</th><th>Total</th><th>Deadline</th><th>Actions</th></tr></thead>
                <tbody>
                  {!visibleReservations.length && <tr><td colSpan="7" className="empty-table">No matching reservations.</td></tr>}
                  {visibleReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td><strong>{reservation.reference}</strong><small>{timestampText(reservation.createdAt)}</small></td>
                      <td><strong>{reservation.customer?.name || "—"}</strong><a href={`tel:${reservation.customer?.contact || ""}`}>{reservation.customer?.contact || "—"}</a><small>ID {maskId(reservation.customer?.idNumber)}</small></td>
                      <td><strong>{SHOWS[reservation.showId]?.time || reservation.showId}</strong><small>{reservation.seatIds.join(", ")}</small></td>
                      <td><span className={`status-badge ${reservation.status}`}>{reservation.status}</span></td>
                      <td>{formatLkr(totalFor(reservation))}</td>
                      <td>{timestampText(reservation.expiresAt)}</td>
                      <td className="table-actions">
                        {reservation.status === "reserved" && <button className="confirm-action" type="button" disabled={busyId === reservation.id} onClick={() => runAction(reservation, "confirm")}>Confirm payment</button>}
                        {["reserved", "booked", "payment_pending"].includes(reservation.status) && <button className="cancel-action" type="button" disabled={busyId === reservation.id} onClick={() => runAction(reservation, "cancel")}>Cancel</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>
      <WalkInDialog open={walkInOpen} onClose={() => setWalkInOpen(false)} onCreated={(result) => showToast(`Confirmed ${result.reference} — ${result.seatIds.join(", ")}`)} />
      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
