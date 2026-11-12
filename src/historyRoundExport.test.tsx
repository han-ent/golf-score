// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyHoleScoreMutation, createDefaultScorecardRound } from './domain/scorecard';
import { createFinishedRoundRecord, type FinishedRoundRecord } from './domain/scorecardHistory';
import { HistoryRoundSheet } from './HistoryRoundSheet';

const exportMocks = vi.hoisted(() => ({
  createScorecardExportPngBlob: vi.fn(async (svg: string) => new Blob([svg], { type: 'image/png' })),
  shareScorecardExportPng: vi.fn(async () => ({ ok: false as const, reason: 'share-unavailable' as const })),
  downloadScorecardExportPng: vi.fn(),
}));

vi.mock('./scorecardExport', async () => {
  const actual = await vi.importActual<typeof import('./scorecardExport')>('./scorecardExport');
  return {
    ...actual,
    createScorecardExportPngBlob: exportMocks.createScorecardExportPngBlob,
    shareScorecardExportPng: exportMocks.shareScorecardExportPng,
    downloadScorecardExportPng: exportMocks.downloadScorecardExportPng,
  };
});

afterEach(() => {
  document.body.innerHTML = '';
  exportMocks.createScorecardExportPngBlob.mockClear();
  exportMocks.shareScorecardExportPng.mockClear();
  exportMocks.downloadScorecardExportPng.mockClear();
});

describe('finished round scorecard export', () => {
  it('offers the same export action on a completed round that kept its card', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const record = playedRound('남서울', '2026-09-01T04:00:00.000Z');
    const view = await renderSheet(record);

    const exportButton = button('스코어카드 내보내기');
    expect(exportButton.className).toContain('primary-button');
    expect(document.body.textContent).not.toContain('Enjoy!');

    await act(async () => {
      exportButton.click();
    });
    await waitForText('아래 미리보기를 만들었습니다.');

    expect(exportMocks.createScorecardExportPngBlob).toHaveBeenCalledTimes(1);
    const svg = exportMocks.createScorecardExportPngBlob.mock.calls[0]?.[0] ?? '';
    expect(svg).toContain('>골프 스코어</text>');
    expect(svg).not.toContain('Enjoy!');
    expect(svg).toContain('남서울');
    expect(document.body.textContent).toContain('아래 미리보기를 만들었습니다.');
    expect(document.querySelector('.export-preview img')).toBeTruthy();

    await act(async () => {
      button('파일 다운로드').click();
    });
    expect(exportMocks.downloadScorecardExportPng).toHaveBeenCalledWith('남서울-2026-09-01.png', expect.any(Blob));
    view.unmount();
  });

  it('uses the 골프-스코어 filename when the finished course name is blank', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const view = await renderSheet(playedRound('', '2026-09-02T04:00:00.000Z'));
    await act(async () => {
      button('스코어카드 내보내기').click();
    });
    await waitForText('아래 미리보기를 만들었습니다.');
    await act(async () => {
      button('파일 다운로드').click();
    });
    expect(exportMocks.downloadScorecardExportPng).toHaveBeenCalledWith('골프-스코어-2026-09-02.png', expect.any(Blob));
    view.unmount();
  });

  it('keeps summary-only history readable and does not offer an image export', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const summary: FinishedRoundRecord = {
      id: 'old-round',
      finishedAt: '2026-05-01T00:00:00.000Z',
      roundName: '',
      courseName: '동코스',
      players: [{ playerId: 'player-1', playerName: '영석', totalStrokes: 90, totalRelative: 18, completedHoles: 18, girRate: 20 }],
    };
    const view = await renderSheet(summary);
    expect(document.body.textContent).not.toContain('스코어카드 내보내기');
    expect(document.body.textContent).toContain('홀별 파·타수·퍼트가 없어 스코어카드 사진은 만들 수 없습니다.');
    expect(document.body.textContent).toContain('90타');
    view.unmount();
  });
});

async function waitForText(text: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (document.body.textContent?.includes(text)) {
      return;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`missing text ${text}; body=${document.body.textContent}`);
}

function button(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === name);
  if (!(found instanceof HTMLButtonElement)) {
    throw new Error(`missing ${name}`);
  }
  return found;
}

function playedRound(courseName: string, finishedAt: string): FinishedRoundRecord {
  let round = createDefaultScorecardRound({ now: '2026-09-01T00:00:00.000Z' });
  round = { ...round, courseName, roundName: '주말', players: [{ id: 'player-1', name: '영석' }] };
  round = applyHoleScoreMutation(round, 1, 'player-1', { strokes: 4, entryMode: 'on-putt', onGreenShots: 2, putts: 2 });
  return createFinishedRoundRecord(round, finishedAt)!;
}

async function renderSheet(record: FinishedRoundRecord): Promise<Root> {
  const root = document.createElement('div');
  document.body.append(root);
  const view = createRoot(root);
  await act(async () => {
    view.render(<HistoryRoundSheet record={record} onClose={() => undefined} onDelete={() => undefined} />);
  });
  return view;
}
