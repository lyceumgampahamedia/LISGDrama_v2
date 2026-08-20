import { useEffect, useRef } from "react";
import { SHOWS, formatLkr } from "../../config.js";

export default function SuccessDialog({ payment, language, t, onClose, onCopy }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (payment && !dialog.open) dialog.showModal();
    if (!payment && dialog.open) dialog.close();
  }, [payment]);

  if (!payment) return <dialog ref={dialogRef} className="modal" />;

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="success-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="confirmation-card">
        <span className="success-mark" aria-hidden="true">✓</span>
        <h2 id="success-title">{t("successTitle")}</h2>
        <p>{t("successBody")}</p>
        <div className="reference-box"><span>{t("reference")}</span><strong>{payment.reference}</strong></div>
        <dl>
          <div><dt>{t("show")}</dt><dd>{SHOWS[payment.showId]?.time || payment.showId}</dd></div>
          <div><dt>{t("seats")}</dt><dd>{payment.seatIds.join(", ")}</dd></div>
          <div><dt>{t("total")}</dt><dd>{formatLkr(payment.amount, language)}</dd></div>
        </dl>
        <button className="secondary-button" type="button" onClick={() => onCopy(payment.reference)}>{t("copyReference")}</button>
        <button className="primary-button" type="button" onClick={onClose}>{t("close")}</button>
      </div>
    </dialog>
  );
}
