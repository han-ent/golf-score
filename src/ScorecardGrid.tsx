import { useEffect, useState, type CSSProperties } from 'react';

import { scorecardPlayerLabel, type ScorecardPlayer, type ScorecardRoundView } from './domain/scorecard';
import './scorecard.css';

function useCompactScorecard(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 671px)');
    const apply = () => setCompact(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
  return compact;
}

function abbreviatePlayer(player: ScorecardPlayer, index: number): string {
  const name = player.name.trim();
  if (!name) return `${index + 1}`;
  return Array.from(name).slice(0, 2).join('');
}

function nineStrokes(roundView: ScorecardRoundView, holeNumbers: readonly number[], playerId: string): string {
  let sum = 0;
  let any = false;
  for (const holeNumber of holeNumbers) {
    const hole = roundView.holes.find((candidate) => candidate.holeNumber === holeNumber);
    const cell = hole?.cells.find((candidate) => candidate.playerId === playerId);
    if (!hole || !cell || cell.main === '—' || cell.main === '') continue;
    const relative = Number(cell.main);
    if (!Number.isFinite(relative)) continue;
    sum += hole.par + relative;
    any = true;
  }
  return any ? `${sum}` : '—';
}

type ScorecardGridProps = {
  readonly activeNine: 'front' | 'back';
  readonly holeCount: number;
  readonly selectedHoleNumber: number;
  readonly visibleHoleNumbers: readonly number[];
  readonly players: readonly ScorecardPlayer[];
  readonly roundView: ScorecardRoundView;
  readonly displayPlayerName: (player: ScorecardPlayer, index: number) => string;
  readonly playerStyle: (index: number) => CSSProperties;
  readonly onSelectHole: (holeNumber: number) => void;
};

export function ScorecardGrid({
  activeNine,
  holeCount,
  selectedHoleNumber,
  visibleHoleNumbers,
  players,
  roundView,
  displayPlayerName,
  playerStyle,
  onSelectHole,
}: ScorecardGridProps) {
  const compact = useCompactScorecard();
  function holeView(holeNumber: number) {
    return roundView.holes.find((hole) => hole.holeNumber === holeNumber);
  }
  const subtotalLabel = activeNine === 'front' ? 'OUT' : 'IN';

  return (
    <section className={compact ? 'scorecard-section compact' : 'scorecard-section'} aria-labelledby="scorecard-title">
      <div className="section-heading compact-heading">
        <h2 id="scorecard-title">스코어카드</h2>
        <div className="scorecard-tabs" role="tablist" aria-label="전반 후반 선택">
          <button className={activeNine === 'front' ? 'scorecard-tab active' : 'scorecard-tab'} type="button" role="tab" aria-selected={activeNine === 'front'} onClick={() => onSelectHole(1)}>
            전반
          </button>
          <button
            className={activeNine === 'back' ? 'scorecard-tab active' : 'scorecard-tab'}
            type="button"
            role="tab"
            aria-selected={activeNine === 'back'}
            onClick={() => onSelectHole(Math.min(10, holeCount))}
            disabled={holeCount < 10}
          >
            후반
          </button>
        </div>
      </div>

      <div className="scorecard-scroll" aria-label="스코어카드" tabIndex={0}>
        <div className="scorecard-matrix">
          <div className="scorecard-row scorecard-header-row">
            <span className="scorecard-row-label">홀</span>
            {visibleHoleNumbers.map((scorecardHoleNumber) => (
              <button
                className={scorecardHoleNumber === selectedHoleNumber ? 'scorecard-cell header-cell active' : 'scorecard-cell header-cell'}
                key={`header-${scorecardHoleNumber}`}
                type="button"
                onClick={() => onSelectHole(scorecardHoleNumber)}
              >
                {scorecardHoleNumber}
              </button>
            ))}
          </div>
          <div className="scorecard-row scorecard-par-row">
            <span className="scorecard-row-label">파</span>
            {visibleHoleNumbers.map((scorecardHoleNumber) => (
              <button
                className={scorecardHoleNumber === selectedHoleNumber ? 'scorecard-cell par-cell active' : 'scorecard-cell par-cell'}
                key={`par-${scorecardHoleNumber}`}
                type="button"
                onClick={() => onSelectHole(scorecardHoleNumber)}
              >
                <span className="sr-only">{scorecardHoleNumber}번 홀 파</span>
                {holeView(scorecardHoleNumber)?.par ?? 4}
              </button>
            ))}
          </div>
          {players.map((player, playerIndex) => (
            <div className="scorecard-player-block" key={`scorecard-row-${player.id}`}>
            <div className="scorecard-row player-scorecard-row">
              <span className="scorecard-row-label player-label" style={playerStyle(playerIndex)} title={displayPlayerName(player, playerIndex)}>
                <span className="clip">{compact ? abbreviatePlayer(player, playerIndex) : scorecardPlayerLabel(player, playerIndex)}</span>
              </span>
              {visibleHoleNumbers.map((scorecardHoleNumber) => {
                const cell = holeView(scorecardHoleNumber)?.cells.find((candidate) => candidate.playerId === player.id);
                const parts = (cell?.sub ?? '').split(' · ').filter(Boolean);

                const penaltyClass = cell?.badge ? ' has-penalty' : '';
                const activeClass = scorecardHoleNumber === selectedHoleNumber ? ' active' : '';
                return (
                  <button
                    className={`scorecard-cell score-cell${activeClass}${penaltyClass}`}
                    key={`${player.id}-${scorecardHoleNumber}`}
                    type="button"
                    onClick={() => onSelectHole(scorecardHoleNumber)}
                    aria-label={`${displayPlayerName(player, playerIndex)} ${scorecardHoleNumber}번 홀 ${cell?.main ?? '미입력'} ${cell?.sub ?? ''} ${cell?.badge ?? ''}`.trim()}
                  >
                    <strong>{cell?.main ?? '—'}</strong>
                    <span className="score-sub">
                      {parts.length ? parts.map((part) => <em key={part}>{part}</em>) : <em aria-hidden="true"> </em>}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="scorecard-subtotal">{compact ? abbreviatePlayer(player, playerIndex) : scorecardPlayerLabel(player, playerIndex)} {subtotalLabel} {nineStrokes(roundView, visibleHoleNumbers, player.id)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
