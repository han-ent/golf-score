import { describe, expect, it } from 'vitest';

import {
  holeInOneScoreInput,
  manualScoreInputFromDraft,
  nextEntryTarget,
  normalizeParDraft,
  normalizeSelectedHoleDraft,
  onPuttScoreInput,
  scoreAfterOnGreenChoice,
  scorecardNavigationState,
} from './useScorecardController';
import { quickScoreForPar } from './domain/scorecard';

describe('scorecard controller pure behavior', () => {
  it('normalizes selected-hole navigation into front/back visible holes', () => {
    expect(scorecardNavigationState('1', 18)).toEqual({ activeNine: 'front', holeNumber: 1, visibleHoleNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9] });
    expect(scorecardNavigationState('12', 18)).toEqual({ activeNine: 'back', holeNumber: 12, visibleHoleNumbers: [10, 11, 12, 13, 14, 15, 16, 17, 18] });
    expect(scorecardNavigationState('99', 12)).toEqual({ activeNine: 'back', holeNumber: 12, visibleHoleNumbers: [10, 11, 12] });
  });

  it('normalizes selected-hole draft text on blur boundaries', () => {
    expect(normalizeSelectedHoleDraft('', 18)).toBe('1');
    expect(normalizeSelectedHoleDraft('abc', 18)).toBe('1');
    expect(normalizeSelectedHoleDraft('0', 18)).toBe('1');
    expect(normalizeSelectedHoleDraft('99', 12)).toBe('12');
    expect(normalizeSelectedHoleDraft('7', 18)).toBe('7');
  });

  it('keeps par draft clearing possible while clamping numeric values', () => {
    expect(normalizeParDraft('')).toBeNull();
    expect(normalizeParDraft('2')).toBe(3);
    expect(normalizeParDraft('4')).toBe(4);
    expect(normalizeParDraft('9')).toBe(5);
  });

  it('builds normalized on/putt, hole-in-one, and manual score inputs', () => {
    expect(onPuttScoreInput(2, 2)).toEqual({ strokes: 4, entryMode: 'on-putt', onGreenShots: 2, putts: 2, puttsAssumed: false });
    expect(onPuttScoreInput(0, 99)).toEqual({ strokes: 10, entryMode: 'on-putt', onGreenShots: 1, putts: 9, puttsAssumed: false });
    expect(holeInOneScoreInput()).toEqual({ strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true });
    expect(manualScoreInputFromDraft('')).toBeNull();
    expect(manualScoreInputFromDraft('99')).toEqual({ strokes: 20, entryMode: 'manual' });
  });

  it('keeps the standard 2-putt default when only 온 is chosen, and preserves a putt the player actually pressed', () => {
    expect(scoreAfterOnGreenChoice(4, undefined)).toEqual({ strokes: 6, entryMode: 'on-putt', onGreenShots: 4, putts: 2, puttsAssumed: true });
    expect(scoreAfterOnGreenChoice(3, { entryMode: 'on-putt', putts: 2, puttsAssumed: true })).toMatchObject({ onGreenShots: 3, putts: 2, puttsAssumed: true });
    expect(scoreAfterOnGreenChoice(5, { entryMode: 'on-putt', putts: 1, puttsAssumed: false })).toMatchObject({ onGreenShots: 5, putts: 1, puttsAssumed: false });
    expect(scoreAfterOnGreenChoice(2, { entryMode: 'on-putt', putts: 3, puttsAssumed: false })).toMatchObject({ putts: 3, puttsAssumed: false, strokes: 5 });
  });

  it('maps one-tap scores to the hole par and keeps explicit next-step math', () => {
    expect(quickScoreForPar(3, 'par')).toEqual({ onGreenShots: 1, putts: 2 });
    expect(quickScoreForPar(3, 'bogey')).toEqual({ onGreenShots: 2, putts: 2 });
    expect(quickScoreForPar(3, 'double')).toEqual({ onGreenShots: 3, putts: 2 });
    expect(quickScoreForPar(4, 'par')).toEqual({ onGreenShots: 2, putts: 2 });
    expect(quickScoreForPar(4, 'bogey')).toEqual({ onGreenShots: 3, putts: 2 });
    expect(quickScoreForPar(4, 'double')).toEqual({ onGreenShots: 4, putts: 2 });
    expect(quickScoreForPar(5, 'par')).toEqual({ onGreenShots: 3, putts: 2 });
    expect(quickScoreForPar(5, 'bogey')).toEqual({ onGreenShots: 4, putts: 2 });
    expect(quickScoreForPar(5, 'double')).toEqual({ onGreenShots: 5, putts: 2 });
    expect(nextEntryTarget({ holeNumber: 1, holeCount: 18, playerIndex: 0, playerCount: 1 })).toEqual({ holeNumber: 2, playerIndex: 0 });
    expect(nextEntryTarget({ holeNumber: 4, holeCount: 18, playerIndex: 0, playerCount: 2 })).toEqual({ holeNumber: 4, playerIndex: 1 });
    expect(nextEntryTarget({ holeNumber: 4, holeCount: 18, playerIndex: 1, playerCount: 2 })).toEqual({ holeNumber: 5, playerIndex: 0 });
    expect(nextEntryTarget({ holeNumber: 18, holeCount: 18, playerIndex: 1, playerCount: 2 })).toEqual({ holeNumber: 18, playerIndex: 1 });
  });
});
