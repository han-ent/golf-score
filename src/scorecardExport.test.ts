import { describe, expect, it } from 'vitest';

import { applyHoleMemoMutation, applyHoleScoreMutation, buildScorecardView, createDefaultScorecardRound } from './domain/scorecard';
import { createScorecardExportSvg, scorecardExportFileName, scorecardExportPixelRatio, scorecardExportPixelSize } from './scorecardExport';

describe('scorecard PNG export source', () => {
  it('exports full scorecard, round review, relative cells, on/putt annotations, and non-empty memos', () => {
    let round = createDefaultScorecardRound({ now: '2026-06-27T00:00:00.000Z' });
    round = applyHoleScoreMutation(round, 1, 'player-1', { strokes: 4, entryMode: 'on-putt', onGreenShots: 2, putts: 2 });
    round = applyHoleMemoMutation(round, 1, '첫 홀 안정적인 2온 2펏');

    const svg = createScorecardExportSvg({
      roundName: '주말 라운드',
      courseName: '남코스',
      generatedAt: '2026-06-27T00:00:00.000Z',
      view: buildScorecardView(round),
    });

    expect(svg).toContain('스코어카드');
    expect(svg).toContain('라운드 리뷰');
    expect(svg).toContain('총타 4타');
    expect(svg).toContain('홀 메모');
    expect(svg).toContain('2온 2펏');
    expect(svg).toContain('온 2');
    expect(svg).toContain('펏 2');
    expect(svg).toContain('>0<');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('전반');
    expect(svg).toContain('후반');
    expect(svg).toContain('파온율');
    expect(svg).not.toContain('linearGradient');
    expect(Number(svg.match(/width="(\d+)"/)?.[1])).toBeLessThan(900);
    expect(scorecardExportPixelRatio).toBe(2);
    expect(scorecardExportPixelSize(776, 400)).toEqual({ width: 1552, height: 800 });
    expect(svg).not.toContain('스코어카드 · 홀 메모 포함 · 로컬 이미지 저장');
    expect(svg).not.toContain('오장');
    expect(svg).not.toContain('QR');
  });

  it('creates Korean-safe PNG filenames', () => {
    expect(scorecardExportFileName('남서울 OUT', '2026-06-27T00:00:00.000Z')).toBe('남서울-OUT-2026-06-27.png');
  });
});
