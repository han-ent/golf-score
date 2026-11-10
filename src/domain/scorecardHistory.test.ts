import { describe, expect, it } from 'vitest';

import { applyHoleScoreMutation, createDefaultScorecardRound } from './scorecard';
import type { StorageLike } from './scorecardStorage';
import { appendScorecardHistory, createFinishedRoundRecord, loadScorecardHistory, summarizeScorecardHistory } from './scorecardHistory';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe('scorecard history', () => {
  it('stores a finished round and summarizes average score plus GIR trend', () => {
    let round = createDefaultScorecardRound({ now: '2026-07-01T00:00:00.000Z' });
    round = { ...round, courseName: '남코스' };
    round = applyHoleScoreMutation(round, 1, 'player-1', { strokes: 4, entryMode: 'on-putt', onGreenShots: 2, putts: 2 });
    round = applyHoleScoreMutation(round, 2, 'player-1', { strokes: 5, entryMode: 'on-putt', onGreenShots: 3, putts: 2 });
    const record = createFinishedRoundRecord(round, '2026-07-01T04:00:00.000Z');
    expect(record?.players[0]).toMatchObject({ totalStrokes: 9, totalRelative: 1, girRate: 50 });

    const storage = new MemoryStorage();
    expect(appendScorecardHistory(storage, record!)).toBe(true);
    const loaded = loadScorecardHistory(storage);
    expect(loaded).toHaveLength(1);
    expect(summarizeScorecardHistory(loaded)).toMatchObject({ rounds: 1, averageStrokes: 9, averageRelative: 1, girRates: [50] });
    expect(createFinishedRoundRecord(createDefaultScorecardRound(), '2026-07-02T00:00:00.000Z')).toBeNull();
  });
});
