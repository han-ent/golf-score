import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { RoundSetupSheet } from './RoundSetupSheet';
import { ScorecardGrid } from './ScorecardGrid';
import { StatList } from './StatList';
import {
  describeHoleScore,
  displayPlayerName,
  quickScoreForPar,
  relativeScoreLabel,
  visibleScoreTypeCounts,
  type QuickScoreKind,
} from './domain/scorecard';
import { compareStats, comparisonHeadline, comparisonNote, firstPlayerPeers, historyPeers, statValueFromHistory, summarizeScorecardHistory, type FinishedRoundPlayer } from './domain/scorecardHistory';
import { formatStatValue, reviewStatDefinition, reviewStatIds, reviewStatsFor } from './domain/reviewStats';
import { isRoundSetupDraftDirty, roundEditorFromDraft, roundSetupDraftFromRound, type RoundSetupDraft } from './roundSetup';
import { useFieldPreferences } from './preferences';
import { createScorecardExportPngBlob, createScorecardExportSvg, downloadScorecardExportPng, scorecardExportFileName, shareScorecardExportPng } from './scorecardExport';
import { useScorecardController } from './useScorecardController';
import { useScorecardSession } from './useScorecardSession';
import { useViewportSheet } from './useViewportSheet';
import { useWakeLock } from './useWakeLock';

const playerTones = ['#1e3d32', '#8d7344', '#3e5c4e', '#6d5a38'] as const;
const onGreenChoices = [1, 2, 3, 4, 5, 6] as const;
const puttChoices = [1, 2, 3, 4] as const;
const quickKinds = [
  ['par', '파'],
  ['bogey', '보기'],
  ['double', '더블'],
] as const;

type ExportPreview = { readonly source: string; readonly fileName: string; readonly blob: Blob };
type ConfirmKind = 'reset' | 'clear' | 'finish' | 'discard-setup';

export function App() {
  const session = useScorecardSession();
  const { round } = session;
  const preferences = useFieldPreferences();
  const wakeLock = useWakeLock(preferences.wakeLock);
  const [manualScoreDrafts, setManualScoreDrafts] = useState<Record<string, string>>({});
  const [setupDraft, setSetupDraft] = useState<RoundSetupDraft | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoState, setMemoState] = useState<{ readonly hole: number; readonly open: boolean }>({ hole: 1, open: false });
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  useViewportSheet(settingsOpen || confirmKind !== null);
  const controller = useScorecardController({ round, session });
  const memoOpen = memoState.hole === controller.holeNumber && memoState.open;
  const activePlayer = controller.activePlayer ?? round.players[0];
  const activeIndex = controller.activePlayerIndex;
  const currentScore = activePlayer ? controller.scoreForPlayer(controller.holeNumber, activePlayer.id) : undefined;
  const selectedHole = controller.roundView.holes.find((hole) => hole.holeNumber === controller.holeNumber);
  const activeCell = selectedHole?.cells.find((cell) => cell.playerId === activePlayer?.id);
  const activeReview = controller.roundView.reviews[activeIndex];
  const puttValue = currentScore && typeof currentScore.putts === 'number' ? currentScore.putts : 2;
  const puttsAssumed = currentScore?.entryMode === 'hio' ? false : currentScore?.entryMode !== 'on-putt' || currentScore.puttsAssumed === true;
  const par = controller.parForHole(controller.holeNumber);
  const penalty = round.holes.find((hole) => hole.holeNumber === controller.holeNumber)?.penalties.find((mark) => mark.playerId === activePlayer?.id);
  const breakdown = describeHoleScore(par, currentScore, penalty);
  const historySummary = summarizeScorecardHistory(session.history);
  const historyPeersForCard = firstPlayerPeers(session.history);
  const hasScores = round.holes.some((hole) => hole.scores.length > 0);
  const quickHint = `파 ${par}: 파 ${quickScoreForPar(par, 'par').onGreenShots}온 2펏 · 보기 ${quickScoreForPar(par, 'bogey').onGreenShots}온 2펏 · 더블 ${quickScoreForPar(par, 'double').onGreenShots}온 2펏. 퍼트는 1–4.`;

  function playerStyle(index: number): CSSProperties {
    return preferences.sunlight ? ({ '--player-tone': '#000000' } as CSSProperties) : ({ '--player-tone': playerTones[index % playerTones.length] } as CSSProperties);
  }

  function openSettings() {
    setSetupDraft(roundSetupDraftFromRound(round));
    setSettingsOpen(true);
  }

  function requestCloseSettings() {
    if (setupDraft && isRoundSetupDraftDirty(setupDraft, round)) {
      setConfirmKind('discard-setup');
      return;
    }
    setSettingsOpen(false);
    setSetupDraft(null);
  }

  function saveSetup() {
    if (!setupDraft || !isRoundSetupDraftDirty(setupDraft, round)) {
      return;
    }
    session.applyRoundEditor(roundEditorFromDraft(setupDraft, round.settings.holeCount));
    setSettingsOpen(false);
    setSetupDraft(null);
  }

  function manualDraftKey(playerId: string) {
    return `${controller.holeNumber}:${playerId}`;
  }

  function quickPressed(kind: QuickScoreKind): boolean {
    if (!currentScore || currentScore.entryMode !== 'on-putt' || currentScore.puttsAssumed === true || currentScore.putts !== 2) {
      return false;
    }
    return quickScoreForPar(par, kind).onGreenShots === currentScore.onGreenShots;
  }

  async function handleExportPng() {
    const now = new Date().toISOString();
    const fileName = scorecardExportFileName(round.courseName || round.roundName, now);
    const exportSvg = createScorecardExportSvg({ roundName: round.roundName, courseName: round.courseName, generatedAt: now, view: controller.roundView });
    setExportPreview(null);
    setExportStatus('스코어카드 사진을 만드는 중입니다.');
    const blob = await createScorecardExportPngBlob(exportSvg);
    if (!blob) {
      setExportStatus('이 브라우저에서는 스코어카드 사진을 만들 수 없습니다.');
      return;
    }
    const shareResult = await shareScorecardExportPng(fileName, blob);
    if (shareResult.ok) {
      setExportStatus('내보내기 메뉴를 열었습니다. 카카오톡 나에게 보내기 등 원하는 앱을 선택해 주세요.');
      return;
    }
    if (shareResult.reason === 'share-cancelled') {
      setExportStatus('내보내기를 취소했습니다.');
      return;
    }
    try {
      const source = await blobToDataUrl(blob);
      setExportPreview({ source, fileName, blob });
      setExportStatus('이 브라우저에서는 내보내기 메뉴가 제한되어 아래 미리보기를 만들었습니다.');
    } catch {
      downloadScorecardExportPng(fileName, blob);
      setExportStatus('파일 다운로드를 요청했습니다. 인앱 브라우저에서는 저장 위치가 표시되지 않을 수 있습니다.');
    }
  }

  function downloadExportPreview() {
    if (!exportPreview) {
      return;
    }
    downloadScorecardExportPng(exportPreview.fileName, exportPreview.blob);
    setExportStatus('파일 다운로드를 요청했습니다. 카카오톡 인앱 브라우저에서는 아래 이미지를 길게 눌러 저장하는 방법이 더 안정적입니다.');
  }

  function runConfirm() {
    if (confirmKind === 'reset') {
      setManualScoreDrafts({});
      setExportStatus(null);
      setExportPreview(null);
      controller.resetScorecardDrafts();
      session.resetRound();
      setSettingsOpen(false);
    }
    if (confirmKind === 'clear') {
      setManualScoreDrafts({});
      setExportStatus(null);
      setExportPreview(null);
      controller.resetScorecardDrafts();
      session.clearSavedRound();
    }
    if (confirmKind === 'finish') {
      const finished = session.finishRound();
      if (finished) {
        setManualScoreDrafts({});
        controller.resetScorecardDrafts();
      }
    }
    if (confirmKind === 'discard-setup') {
      setSettingsOpen(false);
      setSetupDraft(null);
    }
    setConfirmKind(null);
  }

  const confirmCopy: Record<ConfirmKind, { title: string; body: string; confirm: string }> = {
    reset: { title: '새 라운드', body: '지금 라운드의 점수와 메모를 비울까요?', confirm: '비우고 시작' },
    clear: { title: '저장 기록 지우기', body: '이 기기에 저장된 현재 라운드를 지울까요? 지난 라운드 기록은 남습니다.', confirm: '지우기' },
    finish: { title: '라운드 마치기', body: '이 라운드를 지난 기록에 남기고 새 라운드를 시작할까요?', confirm: '기록하고 시작' },
    'discard-setup': { title: '저장하지 않고 닫기', body: '라운드 설정의 변경 내용을 버릴까요?', confirm: '버리고 닫기' },
  };

  return (
    <main className="app-shell">
      <header className="app-bar">
        <div>
          <p className="product">FunGolf</p>
          <p className="status-text">{session.storageStatus === 'memory-only' ? session.storageMessage : '이 기기에 저장됨'}</p>
        </div>
        <div className="app-bar-actions">
          <button className="text-button" type="button" aria-pressed={preferences.sunlight} onClick={() => preferences.setSunlight(!preferences.sunlight)}>햇빛</button>
          <button className="text-button" type="button" aria-pressed={preferences.wakeLock} onClick={() => preferences.setWakeLock(!preferences.wakeLock)}>화면 유지</button>
          <button className="text-button" type="button" onClick={openSettings}>설정</button>
        </div>
      </header>
      {wakeLock.message ? <p className="notice">{wakeLock.message}</p> : null}

      <div className="hole-nav" aria-label="홀 이동">
        <button type="button" onClick={controller.previousHole} disabled={controller.holeNumber <= 1}>이전 홀</button>
        <button type="button" onClick={controller.advanceHole} disabled={controller.holeNumber >= round.settings.holeCount}>다음 홀</button>
      </div>

      <section className="hole-entry" aria-labelledby="hole-input-title">
        <div className="title-row">
          <h1 id="hole-input-title">{controller.holeNumber}번 홀</h1>
          <strong className="running-total">{activeReview?.completedHoles ? relativeScoreLabel(activeReview.totalRelative) : '—'}</strong>
        </div>
        <div className="par-choices" role="radiogroup" aria-label="이 홀의 파">
          {[3, 4, 5].map((choice) => (
            <button key={choice} type="button" role="radio" aria-checked={par === choice} onClick={() => session.updateHoleSetup(controller.holeNumber, { par: choice })}>
              파 {choice}
            </button>
          ))}
        </div>
        {round.players.length > 1 ? (
          <div className="player-switch" role="radiogroup" aria-label="입력할 선수">
            {round.players.map((player, index) => (
              <button key={player.id} type="button" role="radio" aria-checked={index === activeIndex} onClick={() => controller.selectPlayer(index)} title={displayPlayerName(player, index)}>
                <span className="clip">{displayPlayerName(player, index)}</span>
              </button>
            ))}
          </div>
        ) : null}
        <p className="player-line">
          <span className="clip">{activePlayer ? displayPlayerName(activePlayer, activeIndex) : '1번'}</span>
          <b>{activeCell?.main ?? '—'}</b>
        </p>
        <div className="quick-row" aria-label="한 번에 기록">
          {quickKinds.map(([kind, label]) => (
            <button key={kind} type="button" aria-pressed={quickPressed(kind)} onClick={() => controller.recordQuickScore(kind)}>{label}</button>
          ))}
        </div>
        <p className="hint">{quickHint}</p>

        {activePlayer ? (
          <>
            <p className="detail-label">온</p>
            <div className="choice-row" role="group" aria-label="온">
              {onGreenChoices.map((choice) => (
                <button
                  className={currentScore?.onGreenShots === choice ? 'choice-chip active' : 'choice-chip'}
                  key={choice}
                  type="button"
                  aria-pressed={currentScore?.onGreenShots === choice}
                  onClick={() => controller.updateOnGreenShots(activePlayer.id, choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
            <p className="detail-label">펏</p>
            <div className="putt-stepper">
              <button className="text-button" type="button" onClick={() => controller.adjustPutts(activePlayer.id, -1)} aria-label="퍼트 줄이기">−</button>
              <strong className={puttsAssumed ? 'putt-value assumed' : 'putt-value'}>{puttValue}</strong>
              <button className="text-button" type="button" onClick={() => controller.adjustPutts(activePlayer.id, 1)} aria-label="퍼트 늘리기">+</button>
            </div>
            <div className="choice-row putt-choices" role="group" aria-label="퍼트 1에서 4">
              {puttChoices.map((choice) => {
                const pressed = currentScore?.entryMode === 'on-putt' && currentScore.putts === choice && currentScore.puttsAssumed !== true;
                const assumedChip = !pressed && choice === puttValue && puttsAssumed;
                const chipClass = pressed ? 'choice-chip active' : assumedChip ? 'choice-chip assumed' : 'choice-chip';
                return (
                  <button className={chipClass} key={choice} type="button" aria-pressed={pressed} onClick={() => controller.updatePutts(activePlayer.id, choice)}>
                    {choice}
                  </button>
                );
              })}
            </div>
            {currentScore?.entryMode === 'on-putt' && currentScore.puttsAssumed === true ? <p className="assumed-note">기본 2펏입니다. 1–4를 누르면 굵게 바뀝니다.</p> : null}
            <div className="penalty-row">
              <button type="button" aria-pressed={penalty?.ob === true} onClick={() => session.updateHolePenalty(controller.holeNumber, activePlayer.id, 'ob')}>OB +2</button>
              <button type="button" aria-pressed={penalty?.hazard === true} onClick={() => session.updateHolePenalty(controller.holeNumber, activePlayer.id, 'hazard')}>해저드 +1</button>
              <button type="button" onClick={() => controller.updateHoleInOne(activePlayer.id)}>홀인원</button>
              <button type="button" className="danger" onClick={() => controller.clearPlayerScore(activePlayer.id)}>지우기</button>
            </div>
            <p className="hint">OB 티는 +2, 해저드 티는 +1입니다. 파·보기·더블 뒤에도 이 홀 타수에 남습니다.</p>
            {breakdown.badges.length || breakdown.summary ? (
              <div className="score-readout">
                {breakdown.badges.length ? (
                  <div className="penalty-badges">
                    {breakdown.badges.map((badge) => <span className="penalty-badge" key={badge}>{badge}</span>)}
                  </div>
                ) : null}
                {breakdown.summary ? <p className="score-breakdown">{breakdown.summary}</p> : null}
              </div>
            ) : null}
            <label className="manual-score">
              직접 타수 (벌타 제외)
              <input
                inputMode="numeric"
                value={manualScoreDrafts[manualDraftKey(activePlayer.id)] ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setManualScoreDrafts((current) => ({ ...current, [manualDraftKey(activePlayer.id)]: value }));
                  controller.updateManualScore(activePlayer.id, value);
                }}
                placeholder="예: 7"
              />
            </label>
          </>
        ) : null}

        <button className="memo-button text-button" type="button" aria-expanded={memoOpen} onClick={() => setMemoState((current) => ({ hole: controller.holeNumber, open: current.hole === controller.holeNumber ? !current.open : true }))}>홀 메모</button>
        {memoOpen ? (
          <label className="memo-card">
            이 홀 메모
            <textarea value={controller.memoInputValue(controller.holeNumber)} onChange={(event) => controller.updateMemoDraft(controller.holeNumber, event.currentTarget.value)} placeholder="티샷, 세컨드, 퍼트" />
          </label>
        ) : null}
      </section>

      <ScorecardGrid
        activeNine={controller.activeNine}
        holeCount={round.settings.holeCount}
        selectedHoleNumber={controller.holeNumber}
        visibleHoleNumbers={controller.visibleHoleNumbers}
        players={round.players}
        roundView={controller.roundView}
        displayPlayerName={displayPlayerName}
        playerStyle={playerStyle}
        onSelectHole={controller.selectHole}
      />

      <section className="review-card" aria-labelledby="review-title">
        <h2 id="review-title">라운드 리뷰</h2>
        <p className="hint">항목을 누르거나 가리키면 계산과 지난 라운드 평균을 보여 줍니다.</p>
        <div className="review-grid">
          {controller.roundView.reviews.map((review, index) => {
            const types = visibleScoreTypeCounts(review.scoreTypeCounts);
            const player = round.players[index] ?? { id: review.playerId, name: review.playerName };
            const playerLabel = displayPlayerName(player, index);
            const stats = reviewStatsFor(review);
            const peers = historyPeers(session.history, playerLabel, index);
            const comparisons = compareStats(stats, peers);
            const headline = comparisonHeadline(comparisons);
            return (
              <article className="review-player" key={review.playerId}>
                <strong className="clip">{playerLabel}</strong>
                <p className="player-line"><span>{review.completedHoles}홀</span><b>{review.completedHoles ? relativeScoreLabel(review.totalRelative) : '—'}</b></p>
                {headline ? <p className="compare-line">{headline}</p> : <p className="compare-line">마친 라운드가 없으면 이번 기록만 보여 줍니다.</p>}
                <StatList
                  listId={`review-${review.playerId}`}
                  label={`${playerLabel} 기록`}
                  rows={stats.map((stat) => ({
                    id: stat.id,
                    label: stat.label,
                    display: stat.display,
                    formula: stat.formula,
                    explanation: stat.explanation,
                    note: comparisonNote(comparisons.find((comparison) => comparison.id === stat.id), session.history.length),
                  }))}
                />
                {types.length ? <ul className="score-type-list">{types.map((type) => <li key={type.key}>{type.label} {type.count}</li>)}</ul> : null}
                {review.lostStrokeHoles.length ? (
                  <div>
                    <h3>타수를 잃은 홀</h3>
                    <ul className="lost-list">{review.lostStrokeHoles.map((lost) => <li key={lost.holeNumber}>{lost.holeNumber}H {lost.label}</li>)}</ul>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        <div className="memo-highlights">
          <h3>메모</h3>
          {controller.roundView.memoHighlights.length ? (
            <ul>{controller.roundView.memoHighlights.map((memo) => <li key={memo.holeNumber}><strong>{memo.holeNumber}H</strong> {memo.memo}</li>)}</ul>
          ) : <p>아직 남긴 홀 메모가 없습니다.</p>}
        </div>
      </section>

      <section className="history-card" aria-labelledby="history-title">
        <h2 id="history-title">지난 라운드</h2>
        {historySummary ? (
          <>
            <p>첫 번째 선수 기준 {historySummary.rounds}라운드. 평균 {historySummary.averageStrokes}타, 평균 {relativeScoreLabel(historySummary.averageRelative)}.</p>
            <StatList
              listId="history-average"
              label="지난 라운드 평균"
              rows={reviewStatIdsWithSamples(historyPeersForCard)}
            />
            <ol>
              {[...session.history].reverse().map((record) => {
                const player = record.players[0];
                return (
                  <li className="history-round" key={record.id}>
                    <div className="stat-line">
                      <strong className="clip">{record.courseName.trim() || record.roundName.trim() || '라운드'}</strong>
                      <b>{player ? relativeScoreLabel(player.totalRelative) : '—'}</b>
                    </div>
                    <div className="stat-line"><span>{player ? `${player.totalStrokes}타` : '—'}</span><span>파온 {player?.girRate ?? '—'}%</span></div>
                    <div className="trend-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, player?.girRate ?? 0))}%` }} /></div>
                  </li>
                );
              })}
            </ol>
          </>
        ) : <p>마친 라운드가 없습니다.</p>}
        <button className="secondary-button" type="button" disabled={!hasScores} onClick={() => setConfirmKind('finish')}>이 라운드 마치기</button>
      </section>

      <section className="export-card" aria-labelledby="export-title">
        <h2 id="export-title">스코어카드 내보내기</h2>
        <p>전체 스코어카드, 라운드 리뷰, 홀 메모를 사진 한 장으로 만들어 카카오톡 등으로 내보냅니다.</p>
        <div className="export-actions">
          <button className="primary-button" type="button" onClick={handleExportPng}>스코어카드 내보내기</button>
          <button className="secondary-button" type="button" onClick={() => setConfirmKind('clear')}>저장 기록 지우기</button>
        </div>
        {exportStatus ? <p className="status-text">{exportStatus}</p> : null}
        {exportPreview ? (
          <div className="export-preview" aria-label="스코어카드 이미지 미리보기">
            <img src={exportPreview.source} alt="내보낼 스코어카드 미리보기" />
            <p>카카오톡 인앱 브라우저에서 다운로드 파일이 안 보이면, 이미지를 길게 눌러 저장/공유하세요. 계속 안 되면 우측 상단 메뉴에서 Chrome 또는 Safari로 열어 다시 내보내면 안정적입니다.</p>
            <div className="export-actions">
              <button className="secondary-button" type="button" onClick={downloadExportPreview}>파일 다운로드</button>
              <button className="secondary-button" type="button" onClick={() => setExportPreview(null)}>미리보기 닫기</button>
            </div>
          </div>
        ) : null}
      </section>

      {settingsOpen && setupDraft ? (
        <RoundSetupSheet
          round={round}
          draft={setupDraft}
          onDraft={setSetupDraft}
          onSave={saveSetup}
          onClose={requestCloseSettings}
          onNewRound={() => setConfirmKind('reset')}
        />
      ) : null}

      {confirmKind ? createPortal(
        <div className="sheet-backdrop">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <h2 id="confirm-title">{confirmCopy[confirmKind].title}</h2>
            <p>{confirmCopy[confirmKind].body}</p>
            <div className="confirm-actions">
              <button className="secondary-button" type="button" onClick={() => setConfirmKind(null)}>취소</button>
              <button className="primary-button" type="button" onClick={runConfirm}>{confirmCopy[confirmKind].confirm}</button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </main>
  );
}

function reviewStatIdsWithSamples(peers: readonly FinishedRoundPlayer[]) {
  return reviewStatIds().flatMap((id) => {
    const definition = reviewStatDefinition(id);
    if (!definition) {
      return [];
    }
    const values = peers.map((peer) => statValueFromHistory(peer, id)).filter((value): value is number => value !== null);
    if (values.length === 0) {
      return [];
    }
    const average = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
    const display = id === 'totalStrokes' || id === 'penaltyStrokes' ? `${formatStatValue(average, definition.unit)}타` : formatStatValue(average, definition.unit);
    return [{
      id,
      label: definition.label,
      display,
      formula: definition.formula,
      explanation: definition.explanation,
      note: `저장한 ${values.length}라운드 평균입니다. 이 항목이 없는 예전 기록은 빠집니다.`,
    }];
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader === 'undefined') {
    return Promise.reject(new Error('file reader unavailable'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('invalid file reader result')));
    reader.onerror = () => reject(reader.error ?? new Error('file reader failed'));
    reader.readAsDataURL(blob);
  });
}
