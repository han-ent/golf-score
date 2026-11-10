import { useMemo, useState } from 'react';

import { availableLocalStorage } from './browserEnvironment';
import {
  applyHoleMemoMutation,
  applyHolePenaltyMutation,
  applyHoleScoreMutation,
  applyHoleSetupMutation,
  applyPlayerCountMutation,
  applyPlayerMutation,
  applyRoundEditorMutation,
  applyRoundLabelMutation,
  applyRoundSetupMutation,
  createDefaultScorecardRound,
  type ScorecardHoleScoreInput,
  type ScorecardPlayer,
  type RoundEditorInput,
  type ScorecardRoundLabels,
  type ScorecardRound,
  type ScorecardRoundSettings,
} from './domain/scorecard';
import { appendScorecardHistory, createFinishedRoundRecord, loadScorecardHistory, type FinishedRoundRecord } from './domain/scorecardHistory';
import {
  clearScorecardRound,
  createBlankStoredScorecardRound,
  loadScorecardRound,
  saveScorecardRound,
  type StorageLike,
} from './domain/scorecardStorage';

type SessionStorageStatus = 'loaded' | 'default' | 'memory-only' | 'saved' | 'cleared';

export type ScorecardRoundSessionState = {
  readonly round: ScorecardRound;
  readonly storageStatus: SessionStorageStatus;
  readonly storageMessage: string;
  readonly hasSavedRound: boolean;
  readonly history: readonly FinishedRoundRecord[];
};

export type ScorecardRoundSession = ScorecardRoundSessionState & {
  readonly updateRoundLabels: (patch: Partial<ScorecardRoundLabels>) => void;
  readonly updateRoundSetup: (patch: Partial<Pick<ScorecardRoundSettings, 'holeCount'>>) => void;
  readonly setPlayerCount: (playerCount: number) => void;
  readonly updatePlayer: (playerId: string, patch: Partial<Pick<ScorecardPlayer, 'name'>>) => void;
  readonly applyRoundEditor: (input: RoundEditorInput) => void;
  readonly updateHoleSetup: (holeNumber: number, patch: { readonly par?: number }) => void;
  readonly updateHoleScore: (holeNumber: number, playerId: string, score: ScorecardHoleScoreInput | null) => void;
  readonly updateHoleMemo: (holeNumber: number, memo: string) => void;
  readonly updateHolePenalty: (holeNumber: number, playerId: string, kind: 'ob' | 'hazard') => void;
  readonly saveRound: () => boolean;
  readonly resetRound: () => void;
  readonly clearSavedRound: () => boolean;
  readonly finishRound: () => boolean;
};

export function createInitialScorecardRoundSessionState(storage: StorageLike | undefined, now = new Date().toISOString()): ScorecardRoundSessionState {
  const savedRound = loadScorecardRound(storage);

  if (savedRound) {
    return {
      round: savedRound,
      storageStatus: 'loaded',
      storageMessage: '이 기기에 저장됨',
      hasSavedRound: true,
      history: loadScorecardHistory(storage),
    };
  }

  const round = createDefaultScorecardRound({ now, playerCount: 1 });
  return {
    round,
    storageStatus: storage ? 'default' : 'memory-only',
    storageMessage: storage ? '이 기기에 저장됨' : '로컬 저장소를 사용할 수 없어 현재 화면에만 보관합니다.',
    hasSavedRound: false,
    history: loadScorecardHistory(storage),
  };
}

export function useScorecardSession(inputStorage?: StorageLike): ScorecardRoundSession {
  const storage = useMemo(() => inputStorage ?? availableLocalStorage(), [inputStorage]);
  const [state, setState] = useState(() => createInitialScorecardRoundSessionState(storage));

  function commitRound(nextRound: ScorecardRound) {
    const saved = saveScorecardRound(storage, nextRound);
    setState({
      round: nextRound,
      storageStatus: saved ? 'saved' : storage ? 'default' : 'memory-only',
      storageMessage: saved ? '이 기기에 저장됨' : '현재 화면에는 반영됐지만 자동 저장은 사용할 수 없습니다.',
      hasSavedRound: saved || state.hasSavedRound,
      history: state.history,
    });
  }

  function updateRoundSetup(patch: Partial<Pick<ScorecardRoundSettings, 'holeCount'>>) {
    commitRound(applyRoundSetupMutation(state.round, patch));
  }

  function updateRoundLabels(patch: Partial<ScorecardRoundLabels>) {
    commitRound(applyRoundLabelMutation(state.round, patch));
  }

  function setPlayerCount(playerCount: number) {
    commitRound(applyPlayerCountMutation(state.round, playerCount));
  }

  function updatePlayer(playerId: string, patch: Partial<Pick<ScorecardPlayer, 'name'>>) {
    commitRound(applyPlayerMutation(state.round, playerId, patch));
  }

  function applyRoundEditor(input: RoundEditorInput) {
    commitRound(applyRoundEditorMutation(state.round, input));
  }

  function updateHoleSetup(holeNumber: number, patch: { readonly par?: number }) {
    commitRound(applyHoleSetupMutation(state.round, holeNumber, patch));
  }

  function updateHoleScore(holeNumber: number, playerId: string, score: ScorecardHoleScoreInput | null) {
    commitRound(applyHoleScoreMutation(state.round, holeNumber, playerId, score));
  }

  function updateHoleMemo(holeNumber: number, memo: string) {
    commitRound(applyHoleMemoMutation(state.round, holeNumber, memo));
  }

  function updateHolePenalty(holeNumber: number, playerId: string, kind: 'ob' | 'hazard') {
    commitRound(applyHolePenaltyMutation(state.round, holeNumber, playerId, kind));
  }

  function saveRound(): boolean {
    const saved = saveScorecardRound(storage, state.round);
    setState((current) => ({
      ...current,
      storageStatus: saved ? 'saved' : current.storageStatus,
      storageMessage: saved ? '이 기기에 저장됨' : '로컬 저장소 저장에 실패했습니다.',
      hasSavedRound: saved || current.hasSavedRound,
    }));
    return saved;
  }

  function resetRound() {
    const nextRound = createBlankStoredScorecardRound(new Date().toISOString());
    saveScorecardRound(storage, nextRound);
    setState({
      round: nextRound,
      storageStatus: storage ? 'cleared' : 'memory-only',
      storageMessage: storage ? '이 기기에 저장됨' : '로컬 저장소를 사용할 수 없어 현재 화면에만 보관합니다.',
      hasSavedRound: Boolean(storage),
      history: currentHistory(storage, state.history),
    });
  }

  function clearSavedRound(): boolean {
    const cleared = clearScorecardRound(storage);
    const nextRound = createBlankStoredScorecardRound(new Date().toISOString());
    if (cleared) {
      saveScorecardRound(storage, nextRound);
    }
    setState({
      round: nextRound,
      storageStatus: cleared ? 'cleared' : 'memory-only',
      storageMessage: cleared ? '이 기기에 저장됨' : '저장된 스코어카드를 지우지 못했습니다.',
      hasSavedRound: false,
      history: currentHistory(storage, state.history),
    });
    return cleared;
  }

  function finishRound(): boolean {
    const record = createFinishedRoundRecord(state.round, new Date().toISOString());
    if (!record) {
      return false;
    }

    const saved = appendScorecardHistory(storage, record);
    if (!saved && storage) {
      return false;
    }

    const nextRound = createBlankStoredScorecardRound(new Date().toISOString());
    saveScorecardRound(storage, nextRound);
    const history = saved ? currentHistory(storage, [...state.history, record]) : [...state.history, record];
    setState({
      round: nextRound,
      storageStatus: storage ? 'saved' : 'memory-only',
      storageMessage: storage ? '이 기기에 저장됨' : '지난 라운드는 이 화면에만 남았습니다.',
      hasSavedRound: Boolean(storage),
      history,
    });
    return true;
  }

  return {
    ...state,
    updateRoundLabels,
    updateRoundSetup,
    setPlayerCount,
    updatePlayer,
    applyRoundEditor,
    updateHoleSetup,
    updateHoleScore,
    updateHoleMemo,
    updateHolePenalty,
    saveRound,
    resetRound,
    clearSavedRound,
    finishRound,
  };
}

function currentHistory(storage: StorageLike | undefined, fallback: readonly FinishedRoundRecord[]): readonly FinishedRoundRecord[] {
  return storage ? loadScorecardHistory(storage) : fallback;
}
