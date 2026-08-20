import { BLOCKS, formatLkr, seatsForBlock } from "../../config.js";

function SeatButton({ seat, status, language, t, onToggle }) {
  const unavailable = status === "reserved" || status === "booked";

  return (
    <button
      type="button"
      className={`seat tier-${seat.block.tier.toLowerCase()} ${status}`}
      role="gridcell"
      disabled={unavailable}
      aria-selected={status === "selected"}
      aria-label={`${t("seat")} ${seat.id}, ${t("row")} ${seat.row}, ${formatLkr(seat.block.price, language)}, ${t(status)}`}
      title={`${seat.id} — ${t(status)}`}
      onClick={() => onToggle(seat.id)}
    >
      {seat.id.slice(2)}
    </button>
  );
}

function SeatBlock({ block, records, selected, getStatus, language, t, onToggle }) {
  const seats = seatsForBlock(block);
  const rows = [];

  for (let index = 0; index < seats.length; index += block.columns) {
    rows.push(seats.slice(index, index + block.columns));
  }

  return (
    <section className={`seat-block tier-${block.tier.toLowerCase()}`} aria-label={`${t("block")} ${block.tier}`}>
      <header className="block-heading">
        <div>
          <span className="block-eyebrow">{block.side === "left" ? t("left") : t("right")}</span>
          <h3>{t("block")} {block.tier}</h3>
        </div>
        <strong>{formatLkr(block.price, language)}</strong>
      </header>
      <div className="seat-rows" role="grid">
        {rows.map((rowSeats) => (
          <div className="seat-row" style={{ "--columns": block.columns }} role="row" key={rowSeats[0].row}>
            <span className="row-label" role="rowheader">{rowSeats[0].row}</span>
            {rowSeats.map((seat) => (
              <SeatButton
                key={seat.id}
                seat={seat}
                status={selected.has(seat.id) ? "selected" : getStatus(records.get(seat.id))}
                language={language}
                t={t}
                onToggle={onToggle}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function SeatMap({ records, selected, getStatus, language, t, onToggle }) {
  return (
    <div className="seat-map">
      {["left", "right"].map((side) => (
        <div className={`wing wing-${side}`} key={side}>
          {BLOCKS.filter((block) => block.side === side).map((block) => (
            <SeatBlock
              key={block.id}
              block={block}
              records={records}
              selected={selected}
              getStatus={getStatus}
              language={language}
              t={t}
              onToggle={onToggle}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
