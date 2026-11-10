// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyHoleScoreMutation, createDefaultScorecardRound } from './domain/scorecard';
import { appendScorecardHistory, createFinishedRoundRecord, removeScorecardHistoryRecords, type FinishedRoundRecord } from './domain/scorecardHistory';
import { scorecardActiveRoundStorageKey, type StorageLike } from './domain/scorecardStorage';
import { historySelectHoldMs, PastRoundList } from './PastRoundList';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('past round multi-select', () => {
  it('enters selection on a long press, toggles without opening, deletes the selection, and leaves the active round', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    storage.setItem(scorecardActiveRoundStorageKey, 'active-round-must-stay');
    const records = [finished('남', '01'), finished('동', '02'), finished('서', '03')];
    const opened: string[] = [];
    const view = await renderList(records, storage, opened);

    hold(card('남'));
    expect(document.body.textContent).toContain('1개 선택');
    expect(card('남').getAttribute('aria-pressed')).toBe('true');
    expect(opened).toEqual([]);

    act(() => card('동').click());
    expect(document.body.textContent).toContain('2개 선택');
    expect(card('동').getAttribute('aria-pressed')).toBe('true');
    expect(opened).toEqual([]);

    act(() => card('남').click());
    expect(document.body.textContent).toContain('1개 선택');
    expect(card('남').getAttribute('aria-pressed')).toBe('false');

    act(() => button('선택 삭제').click());
    expect(document.body.textContent).toContain('선택한 1개 기록을 삭제할까요? 되돌릴 수 없습니다.');
    act(() => button('삭제').click());
    expect(document.body.textContent).not.toContain('동코스');
    expect(document.body.textContent).toContain('남');
    expect(document.body.textContent).toContain('서');
    expect(document.body.textContent).toContain('길게 눌러 여러 개 선택');
    expect(storage.getItem(scorecardActiveRoundStorageKey)).toBe('active-round-must-stay');
    view.unmount();
  });

  it('cancels the long press when the finger moves or the list scrolls', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const view = await renderList([finished('남', '01'), finished('동', '02')], storage, []);
    const target = card('남');
    act(() => {
      target.dispatchEvent(pointer('pointerdown', 10, 10));
      target.dispatchEvent(pointer('pointermove', 40, 10));
    });
    act(() => vi.advanceTimersByTime(historySelectHoldMs));
    expect(document.body.textContent).not.toContain('1개 선택');

    act(() => {
      target.dispatchEvent(pointer('pointerdown', 10, 10));
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => vi.advanceTimersByTime(historySelectHoldMs));
    expect(document.body.textContent).not.toContain('1개 선택');
    view.unmount();
  });
});

function card(course: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button.history-round')].find((button) => button.textContent?.includes(course));
  if (!(found instanceof HTMLButtonElement)) throw new Error(`missing ${course}`);
  return found;
}

function button(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === name);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`missing ${name}`);
  return found;
}

function hold(target: HTMLButtonElement) {
  act(() => target.dispatchEvent(pointer('pointerdown', 8, 8)));
  act(() => vi.advanceTimersByTime(historySelectHoldMs));
  act(() => {
    target.dispatchEvent(pointer('pointerup', 8, 8));
    target.click();
  });
}

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', button: 0 });
}

function finished(courseName: string, day: string): FinishedRoundRecord {
  let round = createDefaultScorecardRound({ now: `2026-09-${day}T00:00:00.000Z` });
  round = { ...round, courseName: `${courseName}코스` };
  round = applyHoleScoreMutation(round, 1, round.players[0]!.id, { strokes: 5, entryMode: 'on-putt', onGreenShots: 3, putts: 2 });
  return createFinishedRoundRecord(round, `2026-09-${day}T04:00:00.000Z`)!;
}

async function renderList(records: readonly FinishedRoundRecord[], storage: MemoryStorage, opened: string[]): Promise<Root> {
  for (const record of records) appendScorecardHistory(storage, record);
  const root = document.createElement('div');
  document.body.append(root);
  const view = createRoot(root);
  await act(async () => {
    view.render(<Harness initial={records} storage={storage} opened={opened} />);
  });
  return view;
}

function Harness({ initial, storage, opened }: { readonly initial: readonly FinishedRoundRecord[]; readonly storage: MemoryStorage; readonly opened: string[] }) {
  const [records, setRecords] = useState(initial);
  const [selection, setSelection] = useState<readonly string[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <PastRoundList
        records={records}
        selecting={selection !== null}
        selectedIds={selection ?? []}
        onOpen={(id) => opened.push(id)}
        onStartSelecting={(id) => setSelection((current) => current?.includes(id) ? current : [...(current ?? []), id])}
        onToggle={(id) => setSelection((current) => {
          const ids = current ?? [];
          return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
        })}
        onSelectAll={() => setSelection(records.map((record) => record.id))}
        onCancelSelection={() => setSelection(null)}
        onAskDelete={() => setConfirm(true)}
      />
      {confirm ? (
        <div role="dialog">
          <p>{`선택한 ${selection?.length ?? 0}개 기록을 삭제할까요? 되돌릴 수 없습니다.`}</p>
          <button type="button" onClick={() => {
            const next = removeScorecardHistoryRecords(storage, selection ?? []) ?? [];
            setRecords(next);
            setSelection(null);
            setConfirm(false);
          }}>삭제</button>
        </div>
      ) : null}
    </>
  );
}
