import { useEffect, useRef, useState } from "react";
import { SEAT_BY_ID } from "../config.js";
import { createConfirmedReservation } from "../services/bookingApi.js";

export default function WalkInDialog({ open, onClose, onCreated }) {
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) setError("");
  }, [open]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const rawSeats = String(data.get("seatIds") || "").toUpperCase().trim();
    const seatIds = [...new Set(rawSeats.split(/[\s,;]+/).filter(Boolean))];
    const name = String(data.get("name") || "").trim();
    const contact = String(data.get("contact") || "").replace(/[\s-]/g, "");
    const idNumber = String(data.get("idNumber") || "").trim();

    if (!seatIds.length || seatIds.length > 8) return setError("Enter between 1 and 8 seat IDs.");
    if (seatIds.some((id) => !SEAT_BY_ID.has(id))) return setError("One or more seat IDs are invalid. Use values such as LA001 or RB024.");
    if (name.length < 2 || name.length > 80) return setError("Enter a valid customer name.");
    if (!/^(?:\+94\d{9}|0\d{9})$/.test(contact)) return setError("Enter a valid Sri Lankan contact number.");
    if (idNumber.length > 20) return setError("The ID number is too long.");

    setBusy(true);
    try {
      const result = await createConfirmedReservation({
        showId: String(data.get("showId")),
        seatIds,
        customer: { name, contact, ...(idNumber ? { idNumber } : {}) },
      });
      formRef.current?.reset();
      onCreated(result.data);
      onClose();
    } catch (submissionError) {
      console.error("Walk-in booking error", submissionError);
      const code = String(submissionError?.code || "");
      setError(code.includes("already-exists")
        ? "One or more selected seats are already reserved or booked."
        : "The confirmed booking could not be created. Check the function deployment and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="walk-in-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <form ref={formRef} className="reservation-form walk-in-form" onSubmit={submit}>
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>×</button>
        <p className="eyebrow">Staff entry</p>
        <h2 id="walk-in-title">Confirm a walk-in booking</h2>
        <p className="form-intro">Use this when a customer books and pays directly without creating a tentative reservation first.</p>
        <label><span>Show</span><select name="showId" required><option value="show1">Afternoon show — 3:30 PM</option><option value="show2">Evening show — 6:30 PM</option></select></label>
        <label><span>Seat numbers</span><input name="seatIds" type="text" autoComplete="off" placeholder="LA001, LA002" required /><small>Enter 1–8 exact seat IDs separated by commas or spaces.</small></label>
        <label><span>Customer name</span><input name="name" type="text" autoComplete="name" minLength="2" maxLength="80" required /></label>
        <label><span>Sri Lankan contact number</span><input name="contact" type="tel" inputMode="tel" autoComplete="tel" placeholder="07X XXX XXXX" maxLength="15" required /></label>
        <label><span>NIC / ID number (optional)</span><input name="idNumber" type="text" autoComplete="off" maxLength="20" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="walk-in-summary"><span>These seats will be marked</span><strong>Confirmed</strong></div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Checking seats…" : "Confirm booking"}</button>
        </div>
      </form>
    </dialog>
  );
}
