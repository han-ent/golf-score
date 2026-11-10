import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';

import { ScorecardNineGrid } from './ScorecardGrid';
import { StatList } from './StatList';
import { buildScorecardView, displayPlayerName, relativeScoreLabel, type ScorecardRound } from './domain/scorecard';
import { formatFinishedRoundWhen, formatPenaltyHoleSummary, type FinishedRoundRecord } from './domain/scorecardHistory';
import { reviewStatsFor } from './domain/reviewStats';

const playerTones = ['#1e3d32', '#8d7344', '#3e5c4e', '#6d5a38'] as const;
const penaltyLinePattern = /^(?:(.+?)\s+)?(OB|해저드)\s+(\d+)회\s*$/;

type HistoryRoundSheetProps = {
  readonly record: FinishedRoundRecord;
  readonly onClose: () => void;
  readonly onDelete: () => void;
};

export function HistoryRoundSheet({ record, onClose, onDelete }: HistoryRoundSheetProps) {
  const title = record.courseName.trim() || record.roundName.trim() || '지난 라운드';
  const card = record.card;
  const view = card ? buildScorecardView(card) : null;
  const frontHoles = view ? view.holes.filter((hole) => hole.holeNumber <= 9).map((hole) => hole.holeNumber) : [];
  const backHoles = view ? view.holes.filter((hole) => hole.holeNumber >= 10).map((hole) => hole.holeNumber) : [];
  const penaltySummary = card ? formatPenaltyHoleSummary(card) : '';
  const notes = card ? freeformMemos(card) : [];
  const sheet = (
    <div className="sheet-backdrop">
      <div className="sheet history-sheet" role="dialog" aria-modal="true" aria-labelledby="history-view-title">
        <div className="history-viewer-bar">
          <h2 id="history-view-title" className="clip">{title}</h2>
          <button className="text-button" type="button" onClick={onClose}>닫기</button>
        </div>
        <div className="sheet-body">
          <p className="history-meta">{formatFinishedRoundWhen(record.finishedAt)} · 읽기 전용입니다. 지금 라운드는 바뀌지 않습니다.</p>
          {record.roundName.trim() && record.courseName.trim() ? <p className="history-meta">{record.roundName.trim()}</p> : null}
          <div className="history-totals">
            {(view ? view.reviews : []).map((review, index) => (
              <div className="stat-line" key={review.playerId}>
                <span className="clip">{playerName(record, card, review.playerId, index)}</span>
                <b>{review.completedHoles ? `${review.totalStrokes}타 ${relativeScoreLabel(review.totalRelative)}` : '—'}</b>
              </div>
            ))}
            {view ? null : record.players.map((player) => (
              <div className="stat-line" key={player.playerId}>
                <span className="clip">{player.playerName || '플레이어'}</span>
                <b>{player.totalStrokes}타 {relativeScoreLabel(player.totalRelative)}</b>
              </div>
            ))}
          </div>
          {view && card ? (
            <div className="history-scorecard">
              {frontHoles.length ? (
                <section>
                  <p className="detail-label">전반</p>
                  <ScorecardNineGrid
                    holeNumbers={frontHoles}
                    players={view.players}
                    roundView={view}
                    displayPlayerName={(player, index) => playerName(record, card, player.id, index)}
                    playerStyle={playerStyle}
                    subtotalLabel="OUT"
                    ariaLabel="전반 스코어카드"
                  />
                </section>
              ) : null}
              {backHoles.length ? (
                <section>
                  <p className="detail-label">후반</p>
                  <ScorecardNineGrid
                    holeNumbers={backHoles}
                    players={view.players}
                    roundView={view}
                    displayPlayerName={(player, index) => playerName(record, card, player.id, index)}
                    playerStyle={playerStyle}
                    subtotalLabel="IN"
                    ariaLabel="후반 스코어카드"
                  />
                </section>
              ) : null}
              <div className="history-grand-total">
                {view.players.map((player, index) => {
                  const review = view.reviews[index];
                  const out = nineTotal(view, frontHoles, player.id);
                  const inn = nineTotal(view, backHoles, player.id);
                  const total = review?.completedHoles ? `${review.totalStrokes}타 ${relativeScoreLabel(review.totalRelative)}` : '—';
                  return (
                    <p key={player.id}>
                      {playerName(record, card, player.id, index)} OUT {out}{backHoles.length ? ` · IN ${inn}` : ''} · 합계 {total}
                    </p>
                  );
                })}
              </div>
              {penaltySummary ? <p className="history-meta">{penaltySummary}</p> : null}
              {notes.length ? (
                <div>
                  {notes.map((note) => <p className="history-meta" key={note.holeNumber}>{note.holeNumber}번 {note.text}</p>)}
                </div>
              ) : null}
            </div>
          ) : <p className="history-meta">이 기록은 합계만 남아 있습니다. 홀별 온·퍼트는 이후에 마친 라운드부터 볼 수 있습니다.</p>}
          {view ? (
            <div>
              <h3>라운드 리뷰</h3>
              {view.reviews.map((review) => (
                <StatList
                  key={review.playerId}
                  listId={`history-view-${record.id}-${review.playerId}`}
                  label={`${review.playerName || '플레이어'} 기록`}
                  rows={reviewStatsFor(review).map((stat) => ({
                    id: stat.id,
                    label: stat.label,
                    display: stat.display,
                    formula: stat.formula,
                    explanation: stat.explanation,
                  }))}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="sheet-actions">
          <button className="danger-button" type="button" onClick={onDelete}>이 기록 삭제</button>
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}

function playerStyle(index: number): CSSProperties {
  return { '--player-tone': playerTones[index % playerTones.length] } as CSSProperties;
}

function playerName(record: FinishedRoundRecord, card: ScorecardRound | undefined, playerId: string, index: number): string {
  const saved = record.players.find((player) => player.playerId === playerId);
  if (saved?.playerName.trim()) {
    return saved.playerName.trim();
  }
  const player = card?.players[index];
  return player ? displayPlayerName(player, index) : `${index + 1}번`;
}

function nineTotal(view: ReturnType<typeof buildScorecardView>, holeNumbers: readonly number[], playerId: string): string {
  let sum = 0;
  let any = false;
  for (const holeNumber of holeNumbers) {
    const hole = view.holes.find((candidate) => candidate.holeNumber === holeNumber);
    const cell = hole?.cells.find((candidate) => candidate.playerId === playerId);
    if (!hole || !cell || cell.main === '—' || cell.main === '') continue;
    const relative = Number(cell.main);
    if (!Number.isFinite(relative)) continue;
    sum += hole.par + relative;
    any = true;
  }
  return any ? `${sum}` : '—';
}

function freeformMemos(card: ScorecardRound): readonly { readonly holeNumber: number; readonly text: string }[] {
  return card.holes.flatMap((hole) => {
    const text = hole.memo.split('\n').map((line) => line.trim()).filter((line) => line && !penaltyLinePattern.test(line)).join(' ');
    return text ? [{ holeNumber: hole.holeNumber, text }] : [];
  });
}
