import { SHOWS, TIER_IDS, TIER_TOTALS } from "../config.js";

export default function TierSalesBreakdown({ statsByShow, title, blockLabel = "Block", className = "" }) {
  return (
    <div className={`tier-sales-breakdown ${className}`.trim()}>
      <h3>{title}</h3>
      <div className="tier-show-grid">
        {Object.entries(SHOWS).map(([showId, show]) => (
          <article className="tier-show-card" key={showId}>
            <header><span>Show</span><strong>{show.time}</strong></header>
            <ul>
              {TIER_IDS.map((tier) => (
                <li key={tier}>
                  <span>{blockLabel} {tier}</span>
                  <strong>{statsByShow[showId]?.soldByTier?.[tier] || 0}<small> / {TIER_TOTALS[tier]}</small></strong>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
