import { useRef } from 'react';

import { relativeScoreLabel } from './domain/scorecard';
import { formatFinishedRoundWhen, type FinishedRoundRecord } from './domain/scorecardHistory';

export const historySelectHoldMs = 500;
const holdMoveSlop = 10;

type PastRoundListProps = {
  readonly records: readonly FinishedRoundRecord[];
  readonly selecting: boolean;
  readonly selectedIds: readonly string[];
  readonly onOpen: (recordId: string) => void;
  readonly onStartSelecting: (recordId: string) => void;
  readonly onToggle: (recordId: string) => void;
  readonly onSelectAll: () => void;
  readonly onCancelSelection: () => void;
  readonly onAskDelete: () => void;
};

export function PastRoundList({
  records,
  selecting,
  selectedIds,
  onOpen,
  onStartSelecting,
  onToggle,
  onSelectAll,
  onCancelSelection,
  onAskDelete,
}: PastRoundListProps) {
  const selected = new Set(selectedIds);
  return (
    <div className="history-list">
      <p className="history-meta">항목을 누르면 그 라운드 스코어카드를 봅니다. 지금 라운드는 바뀌지 않습니다.</p>
      {selecting ? (
        <div className="history-select-bar" role="toolbar" aria-label="지난 기록 선택">
          <p>{selectedIds.length}개 선택</p>
          <div className="history-select-actions">
            <button className="secondary-button" type="button" onClick={onSelectAll}>전체 선택</button>
            <button className="danger-button" type="button" disabled={selectedIds.length === 0} onClick={onAskDelete}>선택 삭제</button>
            <button className="secondary-button" type="button" onClick={onCancelSelection}>취소</button>
          </div>
        </div>
      ) : <p className="history-meta">길게 눌러 여러 개 선택</p>}
      <ol>
        {records.map((record) => (
          <li key={record.id}>
            <HistoryRoundCard
              record={record}
              selecting={selecting}
              selected={selected.has(record.id)}
              onOpen={() => onOpen(record.id)}
              onStartSelecting={() => onStartSelecting(record.id)}
              onToggle={() => onToggle(record.id)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function HistoryRoundCard({
  record,
  selecting,
  selected,
  onOpen,
  onStartSelecting,
  onToggle,
}: {
  readonly record: FinishedRoundRecord;
  readonly selecting: boolean;
  readonly selected: boolean;
  readonly onOpen: () => void;
  readonly onStartSelecting: () => void;
  readonly onToggle: () => void;
}) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const scrollCancel = useRef<(() => void) | null>(null);

  function stopHold() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
    if (scrollCancel.current) {
      window.removeEventListener('scroll', scrollCancel.current, true);
      scrollCancel.current = null;
    }
  }

  return (
    <button
      className={selecting ? `history-round selecting${selected ? ' selected' : ''}` : 'history-round'}
      type="button"
      aria-pressed={selecting ? selected : undefined}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        stopHold();
        origin.current = { x: event.clientX, y: event.clientY };
        const cancel = () => stopHold();
        scrollCancel.current = cancel;
        window.addEventListener('scroll', cancel, true);
        timer.current = window.setTimeout(() => {
          suppressClick.current = true;
          onStartSelecting();
          stopHold();
        }, historySelectHoldMs);
      }}
      onPointerMove={(event) => {
        if (!origin.current) return;
        const dx = event.clientX - origin.current.x;
        const dy = event.clientY - origin.current.y;
        if (dx * dx + dy * dy > holdMoveSlop * holdMoveSlop) stopHold();
      }}
      onPointerUp={stopHold}
      onPointerCancel={stopHold}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        if (selecting) {
          onToggle();
          return;
        }
        onOpen();
      }}
    >
      {selecting ? <span className={selected ? 'history-check checked' : 'history-check'} aria-hidden="true">{selected ? '✓' : ''}</span> : null}
      <span className="history-round-body">
        <span className="history-when">{formatFinishedRoundWhen(record.finishedAt)}</span>
        <strong className="clip">{record.courseName.trim() || record.roundName.trim() || '라운드'}</strong>
        {record.players.map((player) => (
          <span className="stat-line" key={player.playerId}>
            <span className="clip">{player.playerName || '플레이어'}</span>
            <b>{player.totalStrokes}타 {relativeScoreLabel(player.totalRelative)}</b>
          </span>
        ))}
      </span>
    </button>
  );
}
