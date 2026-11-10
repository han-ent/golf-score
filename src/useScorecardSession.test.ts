import { describe, expect, it } from 'vitest';

import { applyHoleScoreMutation, createDefaultScorecardRound } from './domain/scorecard';
import { scorecardHistoryStorageKey } from './domain/scorecardHistory';
import { saveScorecardRound, scorecardActiveRoundStorageKey, serializeScorecardRound, type StorageLike } from './domain/scorecardStorage';
import { createInitialScorecardRoundSessionState } from './useScorecardSession';

class MemoryStorage implements StorageLike {
  readonly calls: string[] = [];
  private readonly values = new Map<string, string>();

  constructor(initialValues: Record<string, string> = {}) {
    Object.entries(initialValues).forEach(([key, value]) => this.values.set(key, value));
  }

  getItem(key: string): string | null {
    this.calls.push(`get:${key}`);
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.calls.push(`set:${key}`);
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.calls.push(`remove:${key}`);
    this.values.delete(key);
  }
}

describe('scorecard session initialization', () => {
  it('loads a saved scorecard round from the new local key', () => {
    const savedRound = applyHoleScoreMutation(createDefaultScorecardRound({ id: 'saved-round' }), 1, 'player-1', {
      strokes: 4,
      entryMode: 'on-putt',
      onGreenShots: 2,
      putts: 2,
    });
    const labeledRound = { ...savedRound, roundName: '저장 라운드', courseName: '동코스' };
    const storage = new MemoryStorage();
    expect(saveScorecardRound(storage, labeledRound)).toBe(true);
    storage.calls.length = 0;

    const state = createInitialScorecardRoundSessionState(storage, '2026-06-27T01:00:00.000Z');

    expect(state.storageStatus).toBe('loaded');
    expect(state.round.id).toBe('saved-round');
    expect(state.round.roundName).toBe('저장 라운드');
    expect(state.round.courseName).toBe('동코스');
    expect(state.round.players).toHaveLength(1);
    expect(storage.calls).toEqual([`get:${scorecardActiveRoundStorageKey}`, `get:${scorecardHistoryStorageKey}`]);
  });

  it('starts a blank 1-player round when only stale legacy payloads exist', () => {
    const staleRound = createDefaultScorecardRound({ id: 'stale-old-round', playerCount: 4 });
    const storage = new MemoryStorage({
      'golf-bet-ledger:active-round:v3': serializeScorecardRound(staleRound),
      'korean-caddie:preset-distances:v1': JSON.stringify({ presets: [{ name: '캐디 프리셋' }] }),
    });

    const state = createInitialScorecardRoundSessionState(storage, '2026-06-27T02:00:00.000Z');

    expect(state.storageStatus).toBe('default');
    expect(state.round.id).not.toBe('stale-old-round');
    expect(state.round.players).toEqual([{ id: 'player-1', name: '' }]);
    expect(state.round.holes.every((hole) => hole.scores.length === 0 && hole.memo === '')).toBe(true);
  });
});
