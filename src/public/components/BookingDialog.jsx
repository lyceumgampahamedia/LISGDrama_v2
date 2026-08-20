import { useEffect, useRef, useState } from "react";
import { formatLkr } from "../../config.js";

export default function BookingDialog({ open, user, ids, total, language, t, onClose, onSubmit }) {
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || !formRef.current) return;
    const name = formRef.current.elements.namedItem("name");
    const email = formRef.current.elements.namedItem("email");
    if (name && !name.value) name.value = user?.displayName || "";
    if (email) email.value = user?.email || "";
    setError("");
  }, [open, user]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSubmit(new FormData(event.currentTarget));
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="booking-dialog-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <form ref={formRef} className="reservation-form" onSubmit={submit}>
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>×</button>
        <p className="eyebrow">{ids.join(" · ")}</p>
        <h2 id="booking-dialog-title">{t("detailsTitle")}</h2>
        <p className="form-intro">{t("detailsIntro")}</p>
        <label><span>Receipt email</span><input name="email" type="email" readOnly /></label>
        <label><span>{t("fullName")}</span><input name="name" type="text" autoComplete="name" minLength="2" maxLength="80" required autoFocus /></label>
        <label><span>{t("contact")}</span><input name="contact" type="tel" inputMode="tel" autoComplete="tel" placeholder="07X XXX XXXX" maxLength="15" required /></label>
        <label><span>{t("address")}</span><input name="address" type="text" autoComplete="street-address" minLength="5" maxLength="160" required /></label>
        <label><span>{t("city")}</span><input name="city" type="text" autoComplete="address-level2" minLength="2" maxLength="80" required /></label>
        <label><span>{t("optionalId")}</span><input name="idNumber" type="text" autoComplete="off" maxLength="20" /></label>
        <p className="privacy-note">{t("privacy")}</p>
        <label className="consent"><input name="consent" type="checkbox" required /><span>{t("consent")}</span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-total"><span>{ids.length} {t("seats")}</span><strong>{formatLkr(total, language)}</strong></div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>{t("cancel")}</button>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? t("reserving") : t("reserveNow")}</button>
        </div>
      </form>
    </dialog>
  );
}
