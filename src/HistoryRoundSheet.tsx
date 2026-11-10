import { createPortal } from 'react-dom';

import { StatList } from './StatList';
import { buildScorecardView, displayPlayerName, relativeScoreLabel, type ScorecardRound } from './domain/scorecard';
import { formatFinishedRoundWhen, type FinishedRoundRecord } from './domain/scorecardHistory';
import { reviewStatsFor } from './domain/reviewStats';

type HistoryRoundSheetProps = {
  readonly record: FinishedRoundRecord;
  readonly onClose: () => void;
  readonly onDelete: () => void;
};

export function HistoryRoundSheet({ record, onClose, onDelete }: HistoryRoundSheetProps) {
  const title = record.courseName.trim() || record.roundName.trim() || '지난 라운드';
  const card = record.card;
  const view = card ? buildScorecardView(card) : null;
  const sheet = (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="history-view-title">
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
          {view ? view.holes.map((hole) => (
            <article className="history-hole" key={hole.holeNumber}>
              <div className="stat-line">
                <strong>{hole.holeNumber}번 홀</strong>
                <span>파 {hole.par}</span>
              </div>
              {hole.cells.map((cell, index) => (
                <p key={cell.playerId}>
                  {playerName(record, card, cell.playerId, index)} {cell.main} {cell.sub} {cell.badge}
                </p>
              ))}
              {hole.memo.trim() ? <p>{hole.memo.trim()}</p> : null}
            </article>
          )) : <p className="history-meta">이 기록은 합계만 남아 있습니다. 홀별 온·퍼트는 이후에 마친 라운드부터 볼 수 있습니다.</p>}
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

function playerName(record: FinishedRoundRecord, card: ScorecardRound | undefined, playerId: string, index: number): string {
  const saved = record.players.find((player) => player.playerId === playerId);
  if (saved?.playerName.trim()) {
    return saved.playerName.trim();
  }
  const player = card?.players[index];
  return player ? displayPlayerName(player, index) : `${index + 1}번`;
}
