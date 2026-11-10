import { describe, expect, it } from 'vitest';

import { buildScorecardView, createDefaultScorecardRound } from './scorecard';
import {
  clearScorecardRound,
  deserializeScorecardRound,
  loadScorecardRound,
  saveScorecardRound,
  scorecardActiveRoundStorageKey,
  serializeScorecardRound,
  type StorageLike,
} from './scorecardStorage';

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

  peek(key: string): string | null {
    return this.values.get(key) ?? null;
  }
}

describe('scorecard local storage', () => {
  it('uses a scorecard-specific v1 active key', () => {
    expect(scorecardActiveRoundStorageKey).toBe('fungolf-scorecard:active-round:v1');
  });

  it('saves and loads only the scorecard payload', () => {
    const storage = new MemoryStorage();
    const round = {
      ...createDefaultScorecardRound({ id: 'round-storage', now: '2026-06-27T00:00:00.000Z' }),
      roundName: '토요일 오전',
      courseName: '남코스 OUT',
    };

    expect(saveScorecardRound(storage, round)).toBe(true);
    expect(storage.peek(scorecardActiveRoundStorageKey)).toContain('round-storage');
    expect(loadScorecardRound(storage)).toMatchObject({ id: 'round-storage', roundName: '토요일 오전', courseName: '남코스 OUT' });
  });

  it('does not restore old betting ledger keys as scorecard data', () => {
    const oldRound = createDefaultScorecardRound({ id: 'old-ledger-like-round' });
    const storage = new MemoryStorage({
      'golf-bet-ledger:active-round:v3': serializeScorecardRound(oldRound),
      'golf-bet-ledger:active-round:v2': serializeScorecardRound(oldRound),
      'korean-caddie:preset-distances:v1': JSON.stringify({ presets: [{ name: '드라이버' }] }),
    });

    expect(loadScorecardRound(storage)).toBeNull();
    expect(storage.calls).toEqual([`get:${scorecardActiveRoundStorageKey}`]);
  });

  it('keeps rounds saved before putt-assumption and penalty fields', () => {
    const legacy = {
      version: 1,
      round: {
        id: 'legacy-round',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        roundName: '예전',
        courseName: '동코스',
        players: [{ id: 'player-1', name: '영석' }],
        settings: { holeCount: 18 },
        holes: [{ holeNumber: 1, par: 4, memo: '예전 메모', scores: [{ playerId: 'player-1', strokes: 5, entryMode: 'on-putt', onGreenShots: 3, putts: 2 }] }],
      },
    };

    const loaded = deserializeScorecardRound(JSON.stringify(legacy));
    expect(loaded?.roundName).toBe('예전');
    expect(loaded?.holes[0]).toMatchObject({ memo: '예전 메모', penalties: [] });
    expect(loaded?.holes[0]?.scores[0]).toMatchObject({ onGreenShots: 3, putts: 2, puttsAssumed: false, strokes: 5 });
    expect(loaded?.holes).toHaveLength(18);
  });

  it('migrates a legacy OB mark into +2 once and does not add it again on reload', () => {
    const legacy = {
      version: 1,
      round: {
        id: 'legacy-ob',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        roundName: '예전',
        courseName: '동코스',
        players: [{ id: 'player-1', name: '영석' }],
        settings: { holeCount: 18 },
        holes: [{
          holeNumber: 1,
          par: 4,
          memo: '',
          scores: [{ playerId: 'player-1', strokes: 4, entryMode: 'on-putt', onGreenShots: 2, putts: 2, puttsAssumed: true }],
          penalties: [{ playerId: 'player-1', ob: true, hazard: false }],
        }],
      },
    };

    const loaded = deserializeScorecardRound(JSON.stringify(legacy));
    expect(loaded?.players[0]?.name).toBe('영석');
    expect(loaded?.holes[0]?.scores[0]).toMatchObject({ strokes: 6, onGreenShots: 2, putts: 2, puttsAssumed: true, includedPenaltyStrokes: 2 });
    expect(buildScorecardView(loaded!).holes[0]?.cells[0]).toMatchObject({ main: '+2', sub: '온 2 · 펏 2', badge: 'OB +2' });

    const reloaded = deserializeScorecardRound(serializeScorecardRound(loaded!));
    expect(reloaded?.holes[0]?.scores[0]?.strokes).toBe(6);
    expect(reloaded?.holes[0]?.scores[0]?.includedPenaltyStrokes).toBe(2);
  });

  it('rejects invalid or mismatched versions', () => {
    expect(deserializeScorecardRound('{broken')).toBeNull();
    expect(deserializeScorecardRound(JSON.stringify({ version: 2, round: createDefaultScorecardRound() }))).toBeNull();
  });

  it('clears only the scorecard active key', () => {
    const storage = new MemoryStorage({ [scorecardActiveRoundStorageKey]: serializeScorecardRound(createDefaultScorecardRound()) });
    expect(clearScorecardRound(storage)).toBe(true);
    expect(storage.peek(scorecardActiveRoundStorageKey)).toBeNull();
  });
});
