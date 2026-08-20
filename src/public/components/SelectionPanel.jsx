import { formatLkr } from "../../config.js";

export default function SelectionPanel({ ids, total, language, t, onRemove, onClear, onContinue }) {
  if (!ids.length) {
    return (
      <div className="empty-selection">
        <span aria-hidden="true">+</span>
        <p>{t("emptySelection")}</p>
        <small>{t("maxSeats")}</small>
      </div>
    );
  }

  return (
    <>
      <div className="seat-chips">
        {ids.map((id) => (
          <button type="button" key={id} aria-label={`${t("cancel")} ${t("seat")} ${id}`} onClick={() => onRemove(id)}>
            {id} ×
          </button>
        ))}
      </div>
      <p className="selection-count">{ids.length} {t("seats")} · {t("maxSeats")}</p>
      <div className="total-row"><span>{t("total")}</span><strong>{formatLkr(total, language)}</strong></div>
      <button type="button" className="primary-button" onClick={onContinue}>{t("continue")} →</button>
      <button type="button" className="text-button" onClick={onClear}>{t("clear")}</button>
    </>
  );
}
