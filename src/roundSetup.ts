import type { RoundEditorInput, ScorecardRound } from './domain/scorecard';

export type RoundSetupDraft = {
  readonly roundName: string;
  readonly courseName: string;
  readonly holeCount: string;
  readonly playerCount: number;
  readonly names: readonly string[];
};

export function roundSetupDraftFromRound(round: ScorecardRound): RoundSetupDraft {
  return {
    roundName: round.roundName,
    courseName: round.courseName,
    holeCount: String(round.settings.holeCount),
    playerCount: round.players.length,
    names: round.players.map((player) => player.name),
  };
}

export function isRoundSetupDraftDirty(draft: RoundSetupDraft, round: ScorecardRound): boolean {
  const saved = roundSetupDraftFromRound(round);
  const namesDiffer = Array.from({ length: Math.max(draft.playerCount, saved.names.length) }, (_, index) => (draft.names[index] ?? '') !== (saved.names[index] ?? '')).some(Boolean);
  return draft.roundName !== saved.roundName
    || draft.courseName !== saved.courseName
    || draft.holeCount.trim() !== saved.holeCount
    || draft.playerCount !== saved.playerCount
    || namesDiffer;
}

export function roundEditorFromDraft(draft: RoundSetupDraft, fallbackHoleCount: number): RoundEditorInput {
  const playerCount = clampInteger(draft.playerCount, 1, 4);
  const parsedHoleCount = Number(draft.holeCount.trim());
  const holeCount = Number.isInteger(parsedHoleCount) ? clampInteger(parsedHoleCount, 1, 18) : clampInteger(fallbackHoleCount, 1, 18);
  return {
    roundName: draft.roundName,
    courseName: draft.courseName,
    holeCount,
    playerCount,
    names: Array.from({ length: playerCount }, (_, index) => draft.names[index] ?? ''),
  };
}

export function setupDropsScoredPlayers(draft: RoundSetupDraft, round: ScorecardRound): boolean {
  return round.players.slice(draft.playerCount).some((player) => round.holes.some((hole) => (
    hole.scores.some((score) => score.playerId === player.id) || hole.penalties.some((penalty) => penalty.playerId === player.id)
  )));
}

export function resizeSetupNames(names: readonly string[], playerCount: number): readonly string[] {
  return Array.from({ length: playerCount }, (_, index) => names[index] ?? '');
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, integer));
}
