import { useState } from 'react';

export type StatRow = {
  readonly id: string;
  readonly label: string;
  readonly display: string;
  readonly formula: string;
  readonly explanation: string;
  readonly note?: string | null;
};

type StatListProps = {
  readonly rows: readonly StatRow[];
  readonly label: string;
  readonly listId: string;
};

export function StatList({ rows, label, listId }: StatListProps) {
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const openId = pinnedId ?? hoveredId;

  function toggle(id: string) {
    setHoveredId(null);
    setPinnedId((current) => (current === id ? null : id));
  }

  return (
    <div className="stat-list" role="group" aria-label={label}>
      {rows.map((row) => {
        const open = openId === row.id;
        const tipId = `${listId}-${row.id}-tip`;
        return (
          <div
            className="stat-block"
            key={row.id}
            onMouseEnter={() => setHoveredId(row.id)}
            onMouseLeave={() => setHoveredId((current) => (current === row.id ? null : current))}
          >
            <button
              className="stat-line"
              type="button"
              data-stat={row.id}
              aria-expanded={open}
              aria-controls={tipId}
              onClick={() => toggle(row.id)}
              onFocus={() => setHoveredId(row.id)}
              onBlur={() => setHoveredId((current) => (current === row.id ? null : current))}
            >
              <span className="stat-label">{row.label}</span>
              <span className="stat-value">{row.display}</span>
            </button>
            {open ? (
              <div className="stat-tip" id={tipId} role="tooltip">
                <p className="stat-formula">{row.formula}</p>
                <p>{row.explanation}</p>
                {row.note ? <p>{row.note}</p> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
