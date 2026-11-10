import { describe, expect, it } from 'vitest';

import {
  applyHoleMemoMutation,
  applyHolePenaltyMutation,
  applyHoleScoreMutation,
  applyPlayerCountMutation,
  buildScorecardView,
  createDefaultScorecardRound,
  displayPlayerName,
  relativeScoreLabel,
  scorecardPlayerLabel,
  visibleScoreTypeCounts,
} from './scorecard';

describe('simple scorecard domain', () => {
  it('creates a blank 1-player scorecard by default', () => {
    const round = createDefaultScorecardRound({ now: '2026-06-27T00:00:00.000Z' });

    expect(round.players).toEqual([{ id: 'player-1', name: '' }]);
    expect(round.roundName).toBe('');
    expect(round.courseName).toBe('');
    expect(round.settings.holeCount).toBe(18);
    expect(round.holes).toHaveLength(18);
    expect(round.holes[0]).toMatchObject({ holeNumber: 1, par: 4, memo: '', scores: [] });
  });

  it('supports 1 to 4 players and prunes inactive score rows when downsized', () => {
    const fourPlayerRound = applyPlayerCountMutation(createDefaultScorecardRound(), 4, '2026-06-27T01:00:00.000Z');
    const scoredRound = applyHoleScoreMutation(fourPlayerRound, 1, 'player-4', {
      strokes: 5,
      entryMode: 'on-putt',
      onGreenShots: 3,
      putts: 2,
    });
    const onePlayerRound = applyPlayerCountMutation(scoredRound, 1, '2026-06-27T01:01:00.000Z');

    expect(fourPlayerRound.players).toHaveLength(4);
    expect(onePlayerRound.players).toHaveLength(1);
    expect(onePlayerRound.holes[0]?.scores).toEqual([]);
  });

  it('formats relative score labels with par as 0', () => {
    expect(relativeScoreLabel(0)).toBe('0');
    expect(relativeScoreLabel(-2)).toBe('-2');
    expect(relativeScoreLabel(3)).toBe('+3');
  });

  it('builds shared cell view with relative main text and on/putt sub text', () => {
    const round = applyHoleScoreMutation(createDefaultScorecardRound(), 1, 'player-1', {
      strokes: 4,
      entryMode: 'on-putt',
      onGreenShots: 2,
      putts: 2,
    });

    const view = buildScorecardView(round);
    expect(view.holes[0]?.cells[0]).toMatchObject({ main: '0', sub: '온 2 · 펏 2' });
    expect(view.holes[0]?.cells[0]).not.toHaveProperty('strokes');
    expect(view.holes[0]?.cells[0]).not.toHaveProperty('relative');
    expect(view.reviews[0]).toMatchObject({ completedHoles: 1, totalStrokes: 4, totalRelative: 0, averageOnGreenShots: 2, averagePutts: 2 });
  });

  it('keeps direct-stroke fallback out of the scorecard annotation slot', () => {
    const round = applyHoleScoreMutation(createDefaultScorecardRound(), 1, 'player-1', {
      strokes: 7,
      entryMode: 'manual',
    });

    const view = buildScorecardView(round);

    expect(view.holes[0]?.cells[0]).toMatchObject({ main: '+3', sub: '' });
    expect(view.holes[0]?.cells[0]).not.toHaveProperty('strokes');
    expect(view.holes[0]?.cells[0]).not.toHaveProperty('relative');
  });

  it('calculates simple review counts, front/back totals, 3-putt count, and memo highlights', () => {
    let round = applyPlayerCountMutation(createDefaultScorecardRound(), 2);
    round = applyHoleScoreMutation(round, 1, 'player-1', { strokes: 3, entryMode: 'on-putt', onGreenShots: 1, putts: 2 });
    round = applyHoleScoreMutation(round, 10, 'player-1', { strokes: 7, entryMode: 'on-putt', onGreenShots: 3, putts: 4 });
    round = applyHoleMemoMutation(round, 10, '후반 첫 홀 드라이버 우측, 4펏');

    const review = buildScorecardView(round).reviews[0];
    expect(review).toMatchObject({ completedHoles: 2, totalRelative: 2, frontRelative: -1, backRelative: 3, threePuttCount: 1 });
    expect(review?.scoreTypeCounts.birdie).toBe(1);
    expect(review?.scoreTypeCounts.tripleOrWorse).toBe(1);
    expect(buildScorecardView(round).memoHighlights).toEqual([{ holeNumber: 10, memo: '후반 첫 홀 드라이버 우측, 4펏' }]);
  });

  it('uses display labels without mutating blank stored names', () => {
    const round = createDefaultScorecardRound();
    expect(round.players[0]?.name).toBe('');
    expect(displayPlayerName(round.players[0]!, 0)).toBe('1번 플레이어');
    expect(scorecardPlayerLabel(round.players[0]!, 0)).toBe('1번');
  });

  it('counts greens in regulation, par saves, one-putts, and hides zero score categories', () => {
    let round = createDefaultScorecardRound();
    round = applyHoleScoreMutation(round, 1, 'player-1', { strokes: 4, entryMode: 'on-putt', onGreenShots: 2, putts: 2, puttsAssumed: false });
    round = applyHoleScoreMutation(round, 2, 'player-1', { strokes: 4, entryMode: 'on-putt', onGreenShots: 3, putts: 1, puttsAssumed: false });
    round = applyHoleScoreMutation(round, 3, 'player-1', { strokes: 6, entryMode: 'on-putt', onGreenShots: 3, putts: 3, puttsAssumed: false });
    round = applyHolePenaltyMutation(round, 3, 'player-1', 'ob');

    const review = buildScorecardView(round).reviews[0];
    expect(review).toMatchObject({
      girHits: 1,
      girOpportunities: 3,
      girRate: 33.3,
      parSaves: 1,
      parSaveOpportunities: 2,
      parSaveRate: 50,
      onePuttCount: 1,
      threePuttCount: 1,
      lostStrokeHoles: [{ holeNumber: 3, label: 'OB' }],
    });
    expect(visibleScoreTypeCounts(review!.scoreTypeCounts).map((entry) => entry.key)).toEqual(['par', 'doubleBogey']);
    expect(round.holes[0]?.scores[0]).toMatchObject({ putts: 2, puttsAssumed: false });
  });
});
