import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FocusEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { scorecardPlayerCountOptions, type ScorecardRound } from './domain/scorecard';
import { isRoundSetupDraftDirty, resizeSetupNames, setupDropsScoredPlayers, type RoundSetupDraft } from './roundSetup';
import { placeFieldAboveFooter, syncSheetFooterHeight, viewportIsKeyboardOccluded } from './sheetKeyboard';

type RoundSetupSheetProps = {
  readonly round: ScorecardRound;
  readonly draft: RoundSetupDraft;
  readonly onDraft: (draft: RoundSetupDraft) => void;
  readonly onSave: (draft: RoundSetupDraft) => void;
  readonly onClose: (draft: RoundSetupDraft) => void;
  readonly onNewRound: () => void;
};

export function RoundSetupSheet({ round, draft, onDraft, onSave, onClose, onNewRound }: RoundSetupSheetProps) {
  const dirty = isRoundSetupDraftDirty(draft, round);
  const dropsScores = setupDropsScoredPlayers(draft, round);
  const formRef = useRef<HTMLFormElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const playerCountRef = useRef(draft.playerCount);
  const onDraftRef = useRef(onDraft);
  const [initial] = useState(draft);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const commit = useCallback((next: RoundSetupDraft) => {
    onDraftRef.current(next);
  }, []);

  useEffect(() => {
    onDraftRef.current = onDraft;
  }, [onDraft]);

  useEffect(() => {
    const sync = () => {
      const sheet = sheetRef.current;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const occluded = viewportIsKeyboardOccluded(window.innerHeight, viewportHeight);
      const active = document.activeElement;
      const inside = active instanceof Node && Boolean(sheet?.contains(active));
      setKeyboardOpen(occluded && inside);
      if (occluded && inside && active instanceof HTMLElement && sheet?.classList.contains('keyboard-open')) {
        placeFieldAboveFooter(active);
      }
    };
    const onFocusOut = () => {
      window.setTimeout(sync, 0);
    };
    sync();
    window.visualViewport?.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('scroll', sync);
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      window.visualViewport?.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('scroll', sync);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    syncSheetFooterHeight(sheet, keyboardOpen);
    if (!keyboardOpen) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) placeFieldAboveFooter(active);
  }, [keyboardOpen]);

  function readDraft(): RoundSetupDraft {
    return draftFromForm(formRef.current, playerCountRef.current, initial);
  }

  const sheet = (
    <div className="sheet-backdrop">
      <div ref={sheetRef} className={keyboardOpen ? 'sheet setup-sheet keyboard-open' : 'sheet setup-sheet'} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <h2 id="settings-title">라운드 설정</h2>
        <div className="sheet-body">
          <SetupFields
            initial={initial}
            formRef={formRef}
            playerCountRef={playerCountRef}
            onCommit={commit}
          />
          {dropsScores ? <p className="save-state dirty">인원을 줄이면 빠지는 선수의 점수와 벌타도 지워집니다. 저장해야 반영됩니다.</p> : null}
        </div>
        <div className="sheet-actions">
          {keyboardOpen ? null : (
            <p className={dirty ? 'save-state dirty' : 'save-state'} role="status">
              {dirty ? '저장하지 않은 변경이 있습니다. 닫기는 반영하지 않습니다.' : '변경 없음'}
            </p>
          )}
          <button className={dirty ? 'primary-button' : 'primary-button is-disabled'} type="button" aria-disabled={!dirty} onClick={() => onSave(readDraft())}>저장</button>
          {keyboardOpen ? null : (
            <>
              <button className="secondary-button" type="button" onClick={onNewRound}>새 라운드</button>
              <button className="secondary-button" type="button" onClick={() => onClose(readDraft())}>{dirty ? '저장 안 함' : '닫기'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}

const SetupFields = memo(function SetupFields({
  initial,
  formRef,
  playerCountRef,
  onCommit,
}: {
  readonly initial: RoundSetupDraft;
  readonly formRef: RefObject<HTMLFormElement | null>;
  readonly playerCountRef: RefObject<number>;
  readonly onCommit: (draft: RoundSetupDraft) => void;
}) {
  const composing = useRef(false);
  const [playerCount, setPlayerCount] = useState(initial.playerCount);
  const [names, setNames] = useState(initial.names);

  function publish(nextCount = playerCount) {
    if (composing.current) return;
    onCommit(draftFromForm(formRef.current, nextCount, { ...initial, names }));
  }

  return (
    <form ref={formRef} onSubmit={(event) => event.preventDefault()}>
      <div className="field-grid">
        <label className="field-card">
          라운드 이름
          <input name="roundName" defaultValue={initial.roundName} placeholder="토요일 오전" onFocus={revealField} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; publish(); }} onChange={(event) => commitIfReady(event, composing, () => publish())} />
        </label>
        <label className="field-card">
          코스 이름
          <input name="courseName" defaultValue={initial.courseName} placeholder="남코스" onFocus={revealField} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; publish(); }} onChange={(event) => commitIfReady(event, composing, () => publish())} />
        </label>
        <label className="field-card">
          홀 수
          <input name="holeCount" inputMode="numeric" defaultValue={initial.holeCount} onFocus={revealField} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; publish(); }} onChange={(event) => commitIfReady(event, composing, () => publish())} />
        </label>
        <div className="field-card">
          <span>플레이어 수</span>
          <div className="segmented-control" role="radiogroup" aria-label="플레이어 수">
            {scorecardPlayerCountOptions.map((count) => (
              <button
                className="segment"
                key={count}
                type="button"
                role="radio"
                aria-checked={playerCount === count}
                onClick={() => {
                  composing.current = false;
                  const snapshot = draftFromForm(formRef.current, playerCount, { ...initial, names });
                  setNames(snapshot.names);
                  playerCountRef.current = count;
                  setPlayerCount(count);
                  onCommit({ ...snapshot, playerCount: count, names: resizeSetupNames(snapshot.names, count) });
                }}
              >
                {count}명
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="player-editor">
        {Array.from({ length: playerCount }, (_, index) => (
          <label className="field-card" key={`setup-player-${index}`}>
            {index + 1}번
            <input
              name={`name-${index}`}
              defaultValue={names[index] ?? ''}
              placeholder={`${index + 1}번`}
              onFocus={revealField}
              onCompositionStart={() => { composing.current = true; }}
              onCompositionEnd={() => { composing.current = false; publish(); }}
              onChange={(event) => commitIfReady(event, composing, () => publish())}
            />
          </label>
        ))}
      </div>
    </form>
  );
});

function draftFromForm(form: HTMLFormElement | null, playerCount: number, fallback: RoundSetupDraft): RoundSetupDraft {
  if (!form) {
    return { ...fallback, playerCount, names: resizeSetupNames(fallback.names, playerCount) };
  }
  const data = new FormData(form);
  const remembered = fallback.names.slice();
  for (let index = 0; index < playerCount; index += 1) {
    const value = data.get(`name-${index}`);
    if (typeof value === 'string') remembered[index] = value;
    else if (remembered[index] === undefined) remembered[index] = '';
  }
  return {
    roundName: String(data.get('roundName') ?? fallback.roundName),
    courseName: String(data.get('courseName') ?? fallback.courseName),
    holeCount: String(data.get('holeCount') ?? fallback.holeCount),
    playerCount,
    names: resizeSetupNames(remembered, playerCount),
  };
}

function commitIfReady(event: ChangeEvent<HTMLInputElement>, composing: RefObject<boolean>, publish: () => void) {
  const native = event.nativeEvent;
  if (composing.current || ('isComposing' in native && Boolean(native.isComposing))) return;
  publish();
}

function revealField(event: FocusEvent<HTMLInputElement>) {
  placeFieldAboveFooter(event.currentTarget);
}
