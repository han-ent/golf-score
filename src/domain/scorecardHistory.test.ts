import { describe, expect, it } from 'vitest';

import { applyHoleScoreMutation, buildScorecardView, createDefaultScorecardRound } from './scorecard';
import type { StorageLike } from './scorecardStorage';
import { appendScorecardHistory, clearScorecardHistory, compareStats, createFinishedRoundRecord, firstPlayerPeers, loadScorecardHistory, removeScorecardHistoryRecord, statValueFromHistory, summarizeScorecardHistory } from './scorecardHistory';
import { scorecardActiveRoundStorageKey } from './scorecardStorage';
import { reviewStatsFor } from './reviewStats';

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
    expect(record?.players[0]?.stats?.girRate).toBe(50);
    expect(record?.players[0]?.stats?.strokesPerHole).toBe(4.5);
  });

  it('keeps history saved before extended stats and compares only fields those rounds have', () => {
    const storage = new MemoryStorage();
    storage.setItem('fungolf-scorecard:history:v1', JSON.stringify({
      version: 1,
      rounds: [{
        id: 'old-round',
        finishedAt: '2026-05-01T00:00:00.000Z',
        roundName: '',
        courseName: '동코스',
        players: [{ playerId: 'player-1', playerName: '영석', totalStrokes: 90, totalRelative: 18, completedHoles: 18, girRate: 20 }],
      }],
    }));

    const loaded = loadScorecardHistory(storage);
    expect(loaded[0]?.players[0]?.stats).toBeUndefined();
    expect(statValueFromHistory(loaded[0]!.players[0]!, 'girRate')).toBe(20);
    expect(statValueFromHistory(loaded[0]!.players[0]!, 'strokesPerHole')).toBe(5);
    expect(statValueFromHistory(loaded[0]!.players[0]!, 'scrambling')).toBeNull();

    let round = createDefaultScorecardRound();
    round = { ...round, players: [{ id: 'player-1', name: '영석' }] };
    round = applyHoleScoreMutation(round, 1, 'player-1', { strokes: 4, entryMode: 'on-putt', onGreenShots: 2, putts: 2 });
    const comparisons = compareStats(reviewStatsFor(buildScorecardView(round).reviews[0]!), firstPlayerPeers(loaded));
    expect(comparisons.find((comparison) => comparison.id === 'girRate')).toMatchObject({ current: 100, average: 20, samples: 1 });
    expect(comparisons.find((comparison) => comparison.id === 'scrambling')).toMatchObject({ average: null, samples: 0 });
    expect(loaded[0]?.card).toBeUndefined();
  });

  it('keeps a hole-by-hole card on new history and deletes history without the active round', () => {
    let round = createDefaultScorecardRound({ now: '2026-08-01T00:00:00.000Z' });
    round = { ...round, courseName: '남코스', players: [{ id: 'player-1', name: '영석' }] };
    round = applyHoleScoreMutation(round, 1, 'player-1', { strokes: 6, entryMode: 'on-putt', onGreenShots: 2, putts: 2 });
    const record = createFinishedRoundRecord(round, '2026-08-01T04:00:00.000Z');
    const storage = new MemoryStorage();
    storage.setItem(scorecardActiveRoundStorageKey, 'active-round-must-stay');
    expect(appendScorecardHistory(storage, record!)).toBe(true);
    const loaded = loadScorecardHistory(storage);
    expect(loaded[0]?.card?.courseName).toBe('남코스');
    expect(loaded[0]?.card?.holes[0]?.scores[0]).toMatchObject({ onGreenShots: 2, putts: 2, strokes: 4 });

    const removed = removeScorecardHistoryRecord(storage, 'missing');
    expect(removed).toHaveLength(1);
    expect(removeScorecardHistoryRecord(storage, record!.id)).toEqual([]);
    expect(storage.getItem(scorecardActiveRoundStorageKey)).toBe('active-round-must-stay');

    expect(appendScorecardHistory(storage, record!)).toBe(true);
    expect(clearScorecardHistory(storage)).toBe(true);
    expect(loadScorecardHistory(storage)).toEqual([]);
    expect(storage.getItem(scorecardActiveRoundStorageKey)).toBe('active-round-must-stay');
  });
});
