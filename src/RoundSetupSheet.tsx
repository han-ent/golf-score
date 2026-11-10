import { createPortal } from 'react-dom';

import { scorecardPlayerCountOptions, type ScorecardRound } from './domain/scorecard';
import { isRoundSetupDraftDirty, resizeSetupNames, setupDropsScoredPlayers, type RoundSetupDraft } from './roundSetup';

type RoundSetupSheetProps = {
  readonly round: ScorecardRound;
  readonly draft: RoundSetupDraft;
  readonly onDraft: (draft: RoundSetupDraft) => void;
  readonly onSave: () => void;
  readonly onClose: () => void;
  readonly onNewRound: () => void;
};

export function RoundSetupSheet({ round, draft, onDraft, onSave, onClose, onNewRound }: RoundSetupSheetProps) {
  const dirty = isRoundSetupDraftDirty(draft, round);
  const dropsScores = setupDropsScoredPlayers(draft, round);

  const sheet = (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <h2 id="settings-title">라운드 설정</h2>
        <div className="sheet-body">
        <div className="field-grid">
          <label className="field-card">
            라운드 이름
            <input value={draft.roundName} onChange={(event) => onDraft({ ...draft, roundName: event.currentTarget.value })} placeholder="토요일 오전" />
          </label>
          <label className="field-card">
            코스 이름
            <input value={draft.courseName} onChange={(event) => onDraft({ ...draft, courseName: event.currentTarget.value })} placeholder="남코스" />
          </label>
          <label className="field-card">
            홀 수
            <input inputMode="numeric" value={draft.holeCount} onChange={(event) => onDraft({ ...draft, holeCount: event.currentTarget.value })} />
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
                  aria-checked={draft.playerCount === count}
                  onClick={() => onDraft({ ...draft, playerCount: count, names: resizeSetupNames(draft.names, count) })}
                >
                  {count}명
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="player-editor">
          {Array.from({ length: draft.playerCount }, (_, index) => (
            <label className="field-card" key={`setup-player-${index}`}>
              {index + 1}번
              <input
                value={draft.names[index] ?? ''}
                placeholder={`${index + 1}번`}
                onChange={(event) => {
                  const names = draft.names.slice();
                  names[index] = event.currentTarget.value;
                  onDraft({ ...draft, names });
                }}
              />
            </label>
          ))}
        </div>
        {dropsScores ? <p className="save-state dirty">인원을 줄이면 빠지는 선수의 점수와 벌타도 지워집니다. 저장해야 반영됩니다.</p> : null}
        </div>
        <div className="sheet-actions">
          <p className={dirty ? 'save-state dirty' : 'save-state'} role="status">
            {dirty ? '저장하지 않은 변경이 있습니다. 닫기는 반영하지 않습니다.' : '변경 없음'}
          </p>
          <button className="primary-button" type="button" disabled={!dirty} onClick={onSave}>저장</button>
          <button className="secondary-button" type="button" onClick={onNewRound}>새 라운드</button>
          <button className="secondary-button" type="button" onClick={onClose}>{dirty ? '저장 안 함' : '닫기'}</button>
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}
