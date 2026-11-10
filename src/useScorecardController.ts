import { useState } from 'react';

import {
  buildScorecardView,
  holeForNumber,
  maximumScorecardStrokes,
  quickScoreForPar,
  relativeScoreLabel,
  scoreForPlayer,
  type QuickScoreKind,
  type ScorecardHoleScoreInput,
  type ScorecardHoleScore,
  type ScorecardRound,
} from './domain/scorecard';
import { parseEditableIntegerDraft } from './inputDrafts';
import type { ScorecardRoundSession } from './useScorecardSession';

type ScorecardControllerOptions = {
  readonly round: ScorecardRound;
  readonly session: Pick<ScorecardRoundSession, 'updateHoleSetup' | 'updateHoleScore' | 'updateHoleMemo'>;
};

export function useScorecardController({ round, session }: ScorecardControllerOptions) {
  const [currentHoleDraft, setCurrentHoleDraft] = useState('1');
  const [parDraftsByHole, setParDraftsByHole] = useState<Record<number, string>>({});
  const [memoDraftsByHole, setMemoDraftsByHole] = useState<Record<number, string>>({});
  const [activePlayerIndexState, setActivePlayerIndex] = useState(0);

  const navigation = scorecardNavigationState(currentHoleDraft, round.settings.holeCount);
  const { activeNine, holeNumber, visibleHoleNumbers } = navigation;
  const roundView = buildScorecardView(round);
  const activePlayerIndex = Math.min(activePlayerIndexState, Math.max(0, round.players.length - 1));
  const activePlayer = round.players[activePlayerIndex];

  function selectHole(targetHoleNumber: number) {
    setCurrentHoleDraft(Math.min(round.settings.holeCount, Math.max(1, targetHoleNumber)).toString());
  }

  function parInputValue(targetHoleNumber: number): string {
    return parDraftsByHole[targetHoleNumber] ?? holeForNumber(round, targetHoleNumber).par.toString();
  }

  function parForHole(targetHoleNumber: number): number {
    return clampInteger(parseIntegerDraft(parInputValue(targetHoleNumber), 4), 3, 5);
  }

  function updateParDraftForHole(targetHoleNumber: number, value: string) {
    selectHole(targetHoleNumber);
    const normalizedPar = normalizeParDraft(value);
    if (normalizedPar === null) {
      setParDraftsByHole((current) => ({ ...current, [targetHoleNumber]: value }));
      return;
    }
    setParDraftsByHole((current) => ({ ...current, [targetHoleNumber]: normalizedPar.toString() }));
    session.updateHoleSetup(targetHoleNumber, { par: normalizedPar });
  }

  function normalizeParDraftForHole(targetHoleNumber: number) {
    setParDraftsByHole((current) => ({ ...current, [targetHoleNumber]: holeForNumber(round, targetHoleNumber).par.toString() }));
  }

  function memoInputValue(targetHoleNumber = holeNumber): string {
    return memoDraftsByHole[targetHoleNumber] ?? holeForNumber(round, targetHoleNumber).memo;
  }

  function updateMemoDraft(targetHoleNumber: number, value: string) {
    setMemoDraftsByHole((current) => ({ ...current, [targetHoleNumber]: value }));
    selectHole(targetHoleNumber);
    session.updateHoleMemo(targetHoleNumber, value);
  }

  function updateOnGreenShots(playerId: string, onGreenShots: number) {
    const currentScore = scoreForPlayer(round, holeNumber, playerId);
    session.updateHoleScore(holeNumber, playerId, scoreAfterOnGreenChoice(onGreenShots, currentScore));
  }

  function updatePutts(playerId: string, putts: number) {
    const currentScore = scoreForPlayer(round, holeNumber, playerId);
    const onGreenShots = currentScore?.entryMode === 'on-putt' && currentScore.onGreenShots !== undefined ? currentScore.onGreenShots : 2;
    session.updateHoleScore(holeNumber, playerId, onPuttScoreInput(onGreenShots, clampInteger(putts, 0, 9), false));
  }

  function adjustPutts(playerId: string, delta: number) {
    const currentScore = scoreForPlayer(round, holeNumber, playerId);
    const basePutts = currentScore?.entryMode === 'on-putt' && currentScore.putts !== undefined ? currentScore.putts : 2;
    updatePutts(playerId, basePutts + delta);
  }

  function recordQuickScore(kind: QuickScoreKind) {
    if (!activePlayer) {
      return;
    }
    const quick = quickScoreForPar(parForHole(holeNumber), kind);
    session.updateHoleScore(holeNumber, activePlayer.id, onPuttScoreInput(quick.onGreenShots, quick.putts, false));
  }

  function updateHoleInOne(playerId: string) {
    session.updateHoleScore(holeNumber, playerId, holeInOneScoreInput());
  }

  function clearPlayerScore(playerId: string) {
    session.updateHoleScore(holeNumber, playerId, null);
  }

  function commitManualScore(playerId: string, value: string) {
    const score = manualScoreInputFromDraft(value);
    if (score !== null) {
      session.updateHoleScore(holeNumber, playerId, score);
    }
  }

  function scorecardCellLabel(targetHoleNumber: number, playerId: string): string {
    return roundView.holes.find((hole) => hole.holeNumber === targetHoleNumber)?.cells.find((cell) => cell.playerId === playerId)?.main ?? '—';
  }

  function scorecardCellSubLabel(targetHoleNumber: number, playerId: string): string {
    return roundView.holes.find((hole) => hole.holeNumber === targetHoleNumber)?.cells.find((cell) => cell.playerId === playerId)?.sub ?? '';
  }

  function relativeScoreForPlayer(targetHoleNumber: number, playerId: string): string {
    const score = scoreForPlayer(round, targetHoleNumber, playerId);
    if (!score) {
      return '—';
    }
    return relativeScoreLabel(score.strokes - parForHole(targetHoleNumber));
  }

  function advanceHole() {
    const nextHole = Math.min(round.settings.holeCount, holeNumber + 1);
    setActivePlayerIndex(0);
    setCurrentHoleDraft(nextHole.toString());
  }

  function previousHole() {
    setActivePlayerIndex(0);
    setCurrentHoleDraft(Math.max(1, holeNumber - 1).toString());
  }

  function resetScorecardDrafts() {
    setCurrentHoleDraft('1');
    setActivePlayerIndex(0);
    setParDraftsByHole({});
    setMemoDraftsByHole({});
  }

  return {
    activeNine,
    activePlayer,
    activePlayerIndex,
    adjustPutts,
    advanceHole,
    currentHoleDraft,
    holeNumber,
    memoInputValue,
    parForHole,
    parInputValue,
    relativeScoreForPlayer,
    previousHole,
    recordQuickScore,
    resetScorecardDrafts,
    roundView,
    scoreForPlayer: (targetHoleNumber: number, playerId: string): ScorecardHoleScore | undefined => scoreForPlayer(round, targetHoleNumber, playerId),
    scorecardCellLabel,
    scorecardCellSubLabel,
    selectHole,
    selectPlayer: setActivePlayerIndex,
    updateHoleDraft: (value: string) => setCurrentHoleDraft(value),
    normalizeHoleDraft: () => setCurrentHoleDraft(normalizeSelectedHoleDraft(currentHoleDraft, round.settings.holeCount)),
    updateHoleInOne,
    updateManualScore: commitManualScore,
    updateMemoDraft,
    updateOnGreenShots,
    updateParDraftForHole,
    normalizeParDraftForHole,
    updatePutts,
    clearPlayerScore,
    visibleHoleNumbers,
  };
}

export type ScorecardNavigationState = {
  readonly activeNine: 'front' | 'back';
  readonly holeNumber: number;
  readonly visibleHoleNumbers: readonly number[];
};

export function scorecardNavigationState(currentHoleDraft: string, holeCount: number): ScorecardNavigationState {
  const normalizedHoleCount = clampInteger(holeCount, 1, 18);
  const parsedHoleNumber = parseIntegerDraft(currentHoleDraft, 1);
  const holeNumber = clampInteger(parsedHoleNumber, 1, normalizedHoleCount);
  const activeNine: 'front' | 'back' = holeNumber > 9 ? 'back' : 'front';
  const firstHoleInActiveNine = activeNine === 'front' ? 1 : 10;
  const visibleHoleNumbers = Array.from(
    { length: Math.max(0, Math.min(9, normalizedHoleCount - firstHoleInActiveNine + 1)) },
    (_, index) => firstHoleInActiveNine + index,
  );

  return { activeNine, holeNumber, visibleHoleNumbers };
}

export function parseIntegerDraft(value: string, defaultValue: number): number {
  return parseEditableIntegerDraft(value) ?? defaultValue;
}

export function normalizeSelectedHoleDraft(value: string, holeCount: number): string {
  return scorecardNavigationState(value, holeCount).holeNumber.toString();
}

export function normalizeParDraft(value: string): number | null {
  const parsedValue = parseEditableIntegerDraft(value);
  return parsedValue === null ? null : clampInteger(parsedValue, 3, 5);
}

export function onPuttScoreInput(onGreenShots: number, putts: number, puttsAssumed = false): ScorecardHoleScoreInput {
  const normalizedOnGreenShots = clampInteger(onGreenShots, 1, 9);
  const normalizedPutts = clampInteger(putts, 0, 9);
  const strokes = clampInteger(normalizedOnGreenShots + normalizedPutts, 1, maximumScorecardStrokes);
  return { strokes, entryMode: 'on-putt', onGreenShots: normalizedOnGreenShots, putts: normalizedPutts, puttsAssumed };
}

export function scoreAfterOnGreenChoice(
  onGreenShots: number,
  current: Pick<ScorecardHoleScore, 'entryMode' | 'putts' | 'puttsAssumed'> | undefined,
): ScorecardHoleScoreInput {
  const userChosePutts = current?.entryMode === 'on-putt' && typeof current.putts === 'number' && current.puttsAssumed !== true;
  const putts = userChosePutts ? current.putts ?? 2 : 2;
  return onPuttScoreInput(onGreenShots, putts, !userChosePutts);
}

export function nextEntryTarget(input: {
  readonly holeNumber: number;
  readonly holeCount: number;
  readonly playerIndex: number;
  readonly playerCount: number;
}): { readonly holeNumber: number; readonly playerIndex: number } {
  const holeCount = clampInteger(input.holeCount, 1, 18);
  const holeNumber = clampInteger(input.holeNumber, 1, holeCount);
  const playerCount = clampInteger(input.playerCount, 1, 4);
  const playerIndex = clampInteger(input.playerIndex, 0, playerCount - 1);

  if (playerIndex + 1 < playerCount) {
    return { holeNumber, playerIndex: playerIndex + 1 };
  }
  if (holeNumber >= holeCount) {
    return { holeNumber, playerIndex };
  }
  return { holeNumber: holeNumber + 1, playerIndex: 0 };
}

export function holeInOneScoreInput(): ScorecardHoleScoreInput {
  return { strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true };
}

export function manualScoreInputFromDraft(value: string): ScorecardHoleScoreInput | null {
  const parsedValue = parseEditableIntegerDraft(value);
  return parsedValue === null ? null : { strokes: clampInteger(parsedValue, 1, maximumScorecardStrokes), entryMode: 'manual' };
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, integer));
}
