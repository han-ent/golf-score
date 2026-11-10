import { describe, expect, it } from 'vitest';

import { applyHoleMemoMutation, applyHolePenaltyMutation, applyHoleScoreMutation, buildScorecardView, createDefaultScorecardRound } from './domain/scorecard';
import { createScorecardExportSvg, estimateExportTextWidth, exportTextBoxHeight, scorecardExportCanvasWidth, scorecardExportFileName, scorecardExportPixelRatio, scorecardExportPixelSize } from './scorecardExport';

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
    expect(svg).toContain(`width="${scorecardExportCanvasWidth}"`);
    expect(svg).toContain('OUT');
    expect(svg).toContain('IN');
    expect(svg).toContain('합계');
    expect(svg).toContain('1번 플레이어');
    expect(svg).toContain('1홀 ±0');
    expect(svg).not.toContain('홀 0');
    const review = svg.match(/<rect data-section="review"[^>]*height="(\d+)"/);
    expect(Number(review?.[1])).toBe(exportTextBoxHeight(7));
    expect(svgHeight(svg)).toBeGreaterThanOrEqual(lowestRectBottom(svg) + 24);
    expect(scorecardExportPixelRatio).toBe(2);
    expect(scorecardExportCanvasWidth).toBe(1080);
    expect(scorecardExportPixelSize(776, 400)).toEqual({ width: 1552, height: 800 });
    expect(svg).not.toContain('스코어카드 · 홀 메모 포함 · 로컬 이미지 저장');
    expect(svg).not.toContain('오장');
    expect(svg).not.toContain('QR');
  });

  it('keeps a fixed 1080 canvas for 1 to 4 players and 9 or 18 holes', () => {
    for (const playerCount of [1, 2, 3, 4]) {
      for (const holeCount of [9, 18]) {
        let round = createDefaultScorecardRound({ playerCount, holeCount });
        round = {
          ...round,
          players: round.players.map((player, index) => ({ ...player, name: index === 0 ? '한영석' : '' })),
          courseName: '남코스',
        };
        round = applyHoleScoreMutation(round, 1, round.players[0]!.id, { strokes: 5, entryMode: 'on-putt', onGreenShots: 3, putts: 2 });
        if (holeCount === 18) {
          round = applyHoleScoreMutation(round, 10, round.players[0]!.id, { strokes: 6, entryMode: 'on-putt', onGreenShots: 4, putts: 2 });
        }
        const svg = createScorecardExportSvg({
          roundName: '토요일',
          courseName: round.courseName,
          generatedAt: '2026-06-27T00:00:00.000Z',
          view: buildScorecardView(round),
        });
        expect(svg).toContain('width="1080"');
        expect(svg).toContain('한영석');
        expect(svg).toContain('OUT');
        expect(svg).toContain('합계');
        expect(svg.includes('IN')).toBe(holeCount === 18);
        expect(svg).not.toContain('1번 플…');
      }
    }
  });

  it('keeps OB and hazard inside the cell as markers and in the memo, never overlapping the next hole', () => {
    let round = createDefaultScorecardRound({ playerCount: 4, holeCount: 18, now: '2026-11-10T00:00:00.000Z' });
    round = {
      ...round,
      courseName: '남코스',
      players: round.players.map((player, index) => ({ ...player, name: `skgskgㄴㅎ영석플레이어${index}` })),
    };
    for (const player of round.players) {
      for (let holeNumber = 1; holeNumber <= 18; holeNumber += 1) {
        round = applyHoleScoreMutation(round, holeNumber, player.id, { strokes: 6, entryMode: 'on-putt', onGreenShots: 3, putts: 2 });
        round = applyHolePenaltyMutation(round, holeNumber, player.id, 'ob', 2);
        round = applyHolePenaltyMutation(round, holeNumber, player.id, 'hazard', 2);
      }
    }
    const svg = createScorecardExportSvg({
      roundName: '토요일',
      courseName: '남코스',
      generatedAt: '2026-11-10T00:00:00.000Z',
      view: buildScorecardView(round),
    });
    const fitted = [...svg.matchAll(/<text class="cell-fit"[^>]*data-max="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)];
    expect(fitted.length).toBeGreaterThan(18 * 4);
    for (const [, max, size, text] of fitted) {
      expect(text.includes('해저드') || text.includes('회')).toBe(false);
      expect(estimateExportTextWidth(text, Number(size))).toBeLessThanOrEqual(Number(max) + 0.01);
    }
    expect(svg).toContain('class="cell-marker"');
    expect(svg).toContain('>OB<');
    expect(svg).toContain('>H<');
    expect(svg).toContain('OB 2회');
    expect(svg).toContain('해저드 2회');
    expect(svg).toContain('clip-path=');
    expect(svg).toContain('…');
    expect(svg).not.toContain('온 3 · 펏 2 OB');
    expect(svgHeight(svg)).toBeGreaterThanOrEqual(lowestRectBottom(svg) + 24);
  });

  it('creates Korean-safe PNG filenames', () => {
    expect(scorecardExportFileName('남서울 OUT', '2026-06-27T00:00:00.000Z')).toBe('남서울-OUT-2026-06-27.png');
  });
});

function svgHeight(svg: string): number {
  return Number(svg.match(/<svg[^>]*\sheight="(\d+)"/)?.[1]);
}

function lowestRectBottom(svg: string): number {
  let bottom = 0;
  for (const match of svg.matchAll(/<rect\b[^>]*\sy="(\d+)"[^>]*\sheight="(\d+)"/g)) {
    bottom = Math.max(bottom, Number(match[1]) + Number(match[2]));
  }
  return bottom;
}
