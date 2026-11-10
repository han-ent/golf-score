import type { CSSProperties } from 'react';

import { scorecardPlayerLabel, type ScorecardPlayer, type ScorecardRoundView } from './domain/scorecard';
import './scorecard.css';

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
  function holeView(holeNumber: number) {
    return roundView.holes.find((hole) => hole.holeNumber === holeNumber);
  }

  return (
    <section className="scorecard-section" aria-labelledby="scorecard-title">
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
            <div className="scorecard-row player-scorecard-row" key={`scorecard-row-${player.id}`}>
              <span className="scorecard-row-label player-label" style={playerStyle(playerIndex)} title={displayPlayerName(player, playerIndex)}>
                <span className="clip">{scorecardPlayerLabel(player, playerIndex)}</span>
              </span>
              {visibleHoleNumbers.map((scorecardHoleNumber) => {
                const cell = holeView(scorecardHoleNumber)?.cells.find((candidate) => candidate.playerId === player.id);
                const parts = (cell?.sub ?? '').split(' · ').filter(Boolean);

                return (
                  <button
                    className={scorecardHoleNumber === selectedHoleNumber ? 'scorecard-cell score-cell active' : 'scorecard-cell score-cell'}
                    key={`${player.id}-${scorecardHoleNumber}`}
                    type="button"
                    onClick={() => onSelectHole(scorecardHoleNumber)}
                    aria-label={`${displayPlayerName(player, playerIndex)} ${scorecardHoleNumber}번 홀 ${cell?.main ?? '미입력'} ${cell?.sub ?? ''}`.trim()}
                  >
                    <strong>{cell?.main ?? '—'}</strong>
                    <span className="score-sub">
                      {parts.length ? parts.map((part) => <em key={part}>{part}</em>) : <em aria-hidden="true"> </em>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
