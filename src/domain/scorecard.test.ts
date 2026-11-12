import { describe, expect, it } from 'vitest';

import {
  applyHoleMemoMutation,
  applyHolePenaltyMutation,
  applyHoleScoreMutation,
  applyHoleSetupMutation,
  applyPlayerCountMutation,
  applyRoundEditorMutation,
  buildScorecardView,
  createDefaultScorecardRound,
  describeHoleScore,
  displayPlayerName,
  relativeScoreLabel,
  scorecardPlayerLabel,
  userTypedHoleMemo,
  visibleScoreTypeCounts,
} from './scorecard';
import { reviewStatsFor } from './reviewStats';

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

  it('keeps auto penalty lines out of memo highlights and in the lost-stroke list', () => {
    let round = createDefaultScorecardRound();
    round = { ...round, players: [{ id: 'player-1', name: 'han' }] };
    round = applyHoleScoreMutation(round, 7, 'player-1', { strokes: 6, entryMode: 'on-putt', onGreenShots: 4, putts: 2 });
    round = applyHolePenaltyMutation(round, 7, 'player-1', 'ob', 1);
    round = applyHoleScoreMutation(round, 15, 'player-1', { strokes: 5, entryMode: 'on-putt', onGreenShots: 3, putts: 2 });
    round = applyHolePenaltyMutation(round, 15, 'player-1', 'hazard', 1);
    const penaltyOnly = buildScorecardView(round);
    expect(penaltyOnly.memoHighlights).toEqual([]);
    expect(userTypedHoleMemo(round.holes[6]?.memo ?? '')).toBe('');
    expect(round.holes[6]?.memo).toContain('OB 1회');
    expect(penaltyOnly.reviews[0]?.lostStrokeHoles).toEqual([
      { holeNumber: 7, label: 'OB 1회' },
      { holeNumber: 15, label: '해저드 1회' },
    ]);

    round = applyHoleMemoMutation(round, 7, `${round.holes[6]?.memo ?? ''}\n핀이 앞`);
    const mixed = buildScorecardView(round);
    expect(mixed.memoHighlights).toEqual([{ holeNumber: 7, memo: '핀이 앞' }]);
    expect(mixed.reviews[0]?.lostStrokeHoles).toEqual([
      { holeNumber: 7, label: 'OB 1회' },
      { holeNumber: 15, label: '해저드 1회' },
    ]);
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
      lostStrokeHoles: [{ holeNumber: 3, label: 'OB 1회' }],
      obCount: 1,
      hazardCount: 0,
    });
    expect(round.holes[2]?.scores[0]?.strokes).toBe(6);
    expect(round.holes[2]?.memo).toContain('OB 1회');
    expect(visibleScoreTypeCounts(review!.scoreTypeCounts).map((entry) => entry.key)).toEqual(['par', 'doubleBogey']);
    expect(round.holes[0]?.scores[0]).toMatchObject({ putts: 2, puttsAssumed: false });
  });

  it('keeps 온 plus putts as the total and records OB as a memo count', () => {
    let round = applyHoleScoreMutation(createDefaultScorecardRound(), 1, 'player-1', { strokes: 6, entryMode: 'on-putt', onGreenShots: 4, putts: 2, puttsAssumed: false });
    round = applyHolePenaltyMutation(round, 1, 'player-1', 'ob', 1);
    expect(round.holes[0]?.scores[0]).toMatchObject({ strokes: 6, onGreenShots: 4, putts: 2 });
    expect(round.holes[0]?.memo).toContain('OB 1회');
    expect(describeHoleScore(4, round.holes[0]?.scores[0], round.holes[0]?.penalties[0])).toMatchObject({
      strokes: 6,
      relativeLabel: '+2',
      badges: ['OB 1회'],
      summary: '4온 + 2펏 = 6타 · 더블 +2 · OB 1회',
    });
    round = applyHolePenaltyMutation(round, 1, 'player-1', 'ob', 1);
    expect(round.holes[0]?.penalties[0]).toMatchObject({ ob: 2 });
    expect(round.holes[0]?.scores[0]?.strokes).toBe(6);
    round = applyHolePenaltyMutation(round, 1, 'player-1', 'ob', -1);
    round = applyHolePenaltyMutation(round, 1, 'player-1', 'ob', -1);
    expect(round.holes[0]?.penalties).toEqual([]);
    expect(round.holes[0]?.scores[0]?.strokes).toBe(6);
    expect(round.holes[0]?.memo).not.toContain('OB');
  });

  it('counts scrambling, birdie rate, par averages, and bounce back from on/putt input', () => {
    let round = createDefaultScorecardRound();
    round = applyHoleScoreMutation(round, 1, 'player-1', { strokes: 5, entryMode: 'on-putt', onGreenShots: 3, putts: 2 });
    round = applyHoleScoreMutation(round, 2, 'player-1', { strokes: 3, entryMode: 'on-putt', onGreenShots: 2, putts: 1 });
    round = applyHoleSetupMutation(round, 3, { par: 3 });
    round = applyHoleScoreMutation(round, 3, 'player-1', { strokes: 3, entryMode: 'on-putt', onGreenShots: 1, putts: 2 });
    round = applyHoleSetupMutation(round, 4, { par: 5 });
    round = applyHoleScoreMutation(round, 4, 'player-1', { strokes: 6, entryMode: 'on-putt', onGreenShots: 4, putts: 2 });

    const review = buildScorecardView(round).reviews[0];
    expect(review).toMatchObject({
      parSaveRate: 0,
      birdieOrBetterRate: 25,
      bogeyAvoidance: 50,
      bounceBackRate: 100,
      par3Average: 3,
      par4Average: 4,
      par5Average: 6,
      puttsPerGir: 1.5,
    });
    const stats = reviewStatsFor(review!);
    const scrambling = stats.find((stat) => stat.id === 'scrambling');
    const gir = stats.find((stat) => stat.id === 'girRate');
    expect(scrambling).toMatchObject({ label: '스크램블링(파세이브)', display: '0%', numeric: 0 });
    expect(scrambling?.explanation).toContain('파온을 놓친 홀에서 파 이하로 막아낸 비율');
    expect(scrambling?.explanation).not.toContain('파 이상');
    expect(scrambling?.explanation).toContain('파4 3온 1펏 파');
    expect(gir?.formula).toContain('파온 홀');
    expect(gir?.explanation).toContain('샷으로 그린까지');
    expect(gir?.explanation).toContain('파3은 1온');
    expect(stats.find((stat) => stat.id === 'bounceBackRate')?.explanation).toContain('버디');
  });

  it('applies round setup names only through the editor mutation', () => {
    const round = applyRoundEditorMutation(createDefaultScorecardRound(), {
      roundName: '토요일',
      courseName: '남코스',
      holeCount: 9,
      playerCount: 2,
      names: ['영석', '민준'],
    }, '2026-08-01T00:00:00.000Z');

    expect(round.roundName).toBe('토요일');
    expect(round.courseName).toBe('남코스');
    expect(round.settings.holeCount).toBe(9);
    expect(round.players.map((player) => player.name)).toEqual(['영석', '민준']);
    expect(round.holes).toHaveLength(9);
  });
});
