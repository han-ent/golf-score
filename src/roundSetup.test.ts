import { describe, expect, it } from 'vitest';

import { applyHoleScoreMutation, createDefaultScorecardRound } from './domain/scorecard';
import { isRoundSetupDraftDirty, resizeSetupNames, roundEditorFromDraft, roundSetupDraftFromRound, setupDropsScoredPlayers } from './roundSetup';

describe('round setup draft', () => {
  it('treats typed names as unsaved until the editor payload is built', () => {
    const round = createDefaultScorecardRound();
    const draft = roundSetupDraftFromRound(round);
    expect(isRoundSetupDraftDirty(draft, round)).toBe(false);

    const named = { ...draft, playerCount: 2, names: resizeSetupNames(['영석'], 2) };
    expect(isRoundSetupDraftDirty(named, round)).toBe(true);
    expect(round.players).toEqual([{ id: 'player-1', name: '' }]);
    expect(roundEditorFromDraft(named, round.settings.holeCount)).toMatchObject({
      playerCount: 2,
      names: ['영석', ''],
      holeCount: 18,
    });
  });

  it('warns when a smaller player count would drop scored players', () => {
    let round = applyHoleScoreMutation(createDefaultScorecardRound({ playerCount: 2 }), 1, 'player-2', {
      strokes: 5,
      entryMode: 'on-putt',
      onGreenShots: 3,
      putts: 2,
    });
    round = { ...round, players: round.players.map((player, index) => ({ ...player, name: index === 0 ? '영석' : '민준' })) };
    const draft = { ...roundSetupDraftFromRound(round), playerCount: 1, names: ['영석'] };
    expect(setupDropsScoredPlayers(draft, round)).toBe(true);
    expect(isRoundSetupDraftDirty(draft, round)).toBe(true);
  });
});
