import { displayPlayerName, relativeScoreLabel, visibleScoreTypeCounts, type ScorecardHoleView, type ScorecardPlayer, type ScorecardRoundView } from './domain/scorecard';

export type ScorecardExportInput = {
  readonly roundName: string;
  readonly courseName: string;
  readonly generatedAt: string;
  readonly view: ScorecardRoundView;
};

export type ScorecardExportSaveResult =
  | { readonly ok: true; readonly method: 'photo-menu' | 'download' }
  | { readonly ok: false; readonly reason: 'browser-unavailable' | 'conversion-failed' | 'share-cancelled' };

export type ScorecardExportShareResult =
  | { readonly ok: true; readonly method: 'photo-menu' }
  | { readonly ok: false; readonly reason: 'browser-unavailable' | 'share-unavailable' | 'share-cancelled' | 'share-failed' };

const columnsPerNine = 9;
export const scorecardExportCanvasWidth = 1080;
const margin = 32;
const labelWidth = 160;
const cellWidth = 80;
const subtotalWidth = 88;
const holeGap = 4;
const clusterGap = 8;
const rowHeight = 64;
const rowGap = 4;
const sectionGap = 32;
export const scorecardExportPixelRatio = 2;
const svgNamespace = 'http' + '://www.w3.org/2000/svg';
const pngMimeType = 'image/png';
const ivory = '#f3efe6';
const paper = '#ffffff';
const green = '#1e3d32';
const brass = '#8d7344';
const ink = '#17241f';
const muted = '#5c564c';
const line = '#d9d2c5';

export function createScorecardExportSvg(input: ScorecardExportInput): string {
  const width = scorecardExportCanvasWidth;
  const nines = nineGroups(input.view.holes);
  const title = 'FunGolf 스코어카드';
  const subtitle = [input.courseName.trim(), input.roundName.trim(), scoreSummaryText(input.view)].filter(Boolean).join(' · ') || '필드 기록';
  const generatedAt = formatExportTimestamp(input.generatedAt);
  const parts: string[] = [];
  let y = 120;

  nines.forEach((group, index) => {
    const nineLabel = index === 0 ? '전반' : '후반';
    const subtotalLabel = index === 0 ? 'OUT' : 'IN';
    parts.push(renderNine(group, input.view.players, y, nineLabel, subtotalLabel));
    y += nineBlockHeight(input.view.players.length) + sectionGap;
  });

  const totals = renderTotals(input.view, nines, y);
  parts.push(totals.markup);
  y += totals.height + sectionGap;

  const review = renderReview(input.view, y, width);
  parts.push(review.markup);
  y += review.height;

  const penalties = renderNoteSection('타수를 잃은 홀', penaltyTextLines(input.view), y, width);
  parts.push(...penalties.markup);
  y += penalties.height;

  const memos = renderNoteSection('홀 메모', memoTextLines(input.view), y, width);
  parts.push(...memos.markup);
  y += memos.height + sectionGap;

  return [
    `<svg xmlns="${svgNamespace}" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}" role="img" aria-label="${escapeXml(title)}">`,
    '<style><![CDATA[text{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif}]]></style>',
    `<rect width="100%" height="100%" fill="${ivory}"/>`,
    `<text x="${margin}" y="64" font-size="32" font-weight="700" fill="${ink}">${escapeXml(title)}</text>`,
    `<text x="${width - margin}" y="64" text-anchor="end" font-size="16" font-weight="600" fill="${muted}">${escapeXml(generatedAt)}</text>`,
    `<text x="${margin}" y="96" font-size="16" font-weight="600" fill="${brass}">${escapeXml(subtitle)}</text>`,
    ...parts,
    '</svg>',
  ].join('');
}

export function scorecardExportPixelSize(width: number, height: number): { readonly width: number; readonly height: number } {
  return { width: Math.round(width * scorecardExportPixelRatio), height: Math.round(height * scorecardExportPixelRatio) };
}

export async function createScorecardExportPngBlob(svg: string): Promise<Blob | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined') {
    return null;
  }

  return svgToPngBlob(svg);
}

export async function shareScorecardExportPng(fileName: string, blob: Blob): Promise<ScorecardExportShareResult> {
  if (typeof File === 'undefined' || typeof navigator === 'undefined') {
    return { ok: false, reason: 'browser-unavailable' };
  }

  const file = new File([blob], fileName, { type: pngMimeType });
  if (!canOpenPhotoSaveMenu(navigator, file)) {
    return { ok: false, reason: 'share-unavailable' };
  }

  try {
    await navigator.share({ files: [file], title: '스코어카드 사진' });
    return { ok: true, method: 'photo-menu' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, reason: 'share-cancelled' };
    }
    return { ok: false, reason: 'share-failed' };
  }
}

export function downloadScorecardExportPng(fileName: string, blob: Blob): void {
  downloadBlob(fileName, blob);
}

export async function saveScorecardExportPng(fileName: string, svg: string): Promise<ScorecardExportSaveResult> {
  const blob = await createScorecardExportPngBlob(svg);
  if (!blob) {
    return { ok: false, reason: 'conversion-failed' };
  }

  const shareResult = await shareScorecardExportPng(fileName, blob);
  if (shareResult.ok) {
    return { ok: true, method: 'photo-menu' };
  }
  if (shareResult.reason === 'share-cancelled') {
    return { ok: false, reason: 'share-cancelled' };
  }

  downloadScorecardExportPng(fileName, blob);
  return { ok: true, method: 'download' };
}

export function scorecardExportFileName(courseName: string, generatedAt: string): string {
  const baseName = (courseName.trim() || 'fungolf-scorecard')
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'fungolf-scorecard';
  const dateStamp = generatedAt.slice(0, 10) || 'local';

  return `${baseName}-${dateStamp}.png`;
}

function nineBlockHeight(playerCount: number): number {
  const rows = 2 + playerCount;
  return 24 + 16 + rows * rowHeight + Math.max(0, rows - 1) * rowGap;
}

function nineGroups<T>(holes: readonly T[]): readonly (readonly T[])[] {
  if (holes.length === 0) {
    return [];
  }
  const groups: T[][] = [];
  for (let index = 0; index < holes.length; index += columnsPerNine) {
    groups.push(holes.slice(index, index + columnsPerNine));
  }
  return groups;
}

function renderNine(
  holes: readonly ScorecardHoleView[],
  players: readonly ScorecardPlayer[],
  y: number,
  label: string,
  subtotalLabel: string,
): string {
  const padded = Array.from({ length: columnsPerNine }, (_, index) => holes[index]);
  const rowY = y + 24 + 16;
  const rows = [
    renderRow('홀', padded.map((hole) => hole?.holeNumber.toString() ?? ''), subtotalLabel, rowY, true),
    renderRow('파', padded.map((hole) => hole?.par.toString() ?? ''), sumDefined(padded.map((hole) => hole?.par)), rowY + rowHeight + rowGap, false),
    ...players.map((player, index) => {
      const values = padded.map((hole) => holeValue(hole, player.id));
      return renderScoreRow(
        displayPlayerName(player, index),
        values,
        sumDefined(padded.map((hole) => strokesFor(hole, player.id))),
        rowY + (rowHeight + rowGap) * (index + 2),
      );
    }),
  ];
  return [
    `<text x="${margin}" y="${y + 24}" font-size="24" font-weight="700" fill="${brass}">${label}</text>`,
    ...rows,
  ].join('');
}

function renderRow(label: string, values: readonly string[], subtotal: string, y: number, header: boolean): string {
  return renderCells(label, values.map((value) => ({ main: value, sub: '' })), subtotal, y, header);
}

function renderScoreRow(label: string, values: readonly { readonly main: string; readonly sub: string }[], subtotal: string, y: number): string {
  return renderCells(label, values, subtotal, y, false);
}

function renderCells(
  label: string,
  values: readonly { readonly main: string; readonly sub: string }[],
  subtotal: string,
  y: number,
  header: boolean,
): string {
  let x = margin;
  const cells = [
    renderLabelCell(label, x, y, header),
  ];
  x += labelWidth + clusterGap;
  values.forEach((value, index) => {
    cells.push(renderValueCell(value.main, value.sub, x, y, header, false));
    x += cellWidth + (index === values.length - 1 ? clusterGap : holeGap);
  });
  cells.push(renderValueCell(subtotal, '', x, y, header, true));
  return cells.join('');
}

function renderLabelCell(label: string, x: number, y: number, header: boolean): string {
  const fill = header ? green : paper;
  const color = header ? ivory : ink;
  return [
    `<rect x="${x}" y="${y}" width="${labelWidth}" height="${rowHeight}" rx="8" fill="${fill}" stroke="${header ? green : line}" stroke-width="1"/>`,
    centeredText(fitLabel(label, 8), x, y, labelWidth, rowHeight, 16, '700', color),
  ].join('');
}

function renderValueCell(main: string, sub: string, x: number, y: number, header: boolean, subtotal: boolean): string {
  const width = subtotal ? subtotalWidth : cellWidth;
  const fill = header ? green : paper;
  const color = header ? ivory : subtotal ? brass : ink;
  const caption = subtotal ? '' : sub;
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${rowHeight}" rx="8" fill="${fill}" stroke="${header ? green : line}" stroke-width="1"/>`,
    caption
      ? [
        centeredText(main || '—', x, y + 4, width, 32, header ? 20 : 22, '700', color),
        centeredText(caption, x, y + 32, width, 24, 12, '600', header ? ivory : muted),
      ].join('')
      : centeredText(main || '—', x, y, width, rowHeight, header ? 20 : 22, '700', color),
  ].join('');
}

function renderTotals(
  view: ScorecardRoundView,
  nines: readonly (readonly ScorecardHoleView[])[],
  y: number,
): { readonly markup: string; readonly height: number } {
  const lineHeight = 32;
  const height = 24 + 16 + Math.max(1, view.players.length) * lineHeight;
  const lines = view.players.map((player, index) => {
    const review = view.reviews[index];
    const name = displayPlayerName(player, index);
    const out = nines[0] ? sumDefined(nines[0].map((hole) => strokesFor(hole, player.id))) : '—';
    const inn = nines[1] ? sumDefined(nines[1].map((hole) => strokesFor(hole, player.id))) : '—';
    const total = review?.completedHoles ? `${review.totalStrokes}타` : '—';
    const relative = review?.completedHoles ? relativeScoreLabel(review.totalRelative) : '—';
    const pieces = [`${name}  OUT ${out}`, nines[1] ? `IN ${inn}` : '', `합계 ${total}  ${relative}`].filter(Boolean);
    return `<text x="${margin}" y="${y + 24 + 16 + lineHeight * index + 22}" font-size="16" font-weight="600" fill="${ink}">${escapeXml(pieces.join('  '))}</text>`;
  });
  return {
    height,
    markup: [
      `<text x="${margin}" y="${y + 24}" font-size="24" font-weight="700" fill="${green}">합계</text>`,
      ...lines,
    ].join(''),
  };
}

function renderReview(view: ScorecardRoundView, y: number, width: number): { readonly markup: string; readonly height: number } {
  const cards = view.reviews.map((review, index) => reviewCardLines(view, index));
  const cardGap = 16;
  let cursor = y + 24 + 16;
  const markup = [`<text x="${margin}" y="${y + 24}" font-size="24" font-weight="700" fill="${green}">라운드 리뷰</text>`];
  cards.forEach((lines) => {
    const cardHeight = 16 + lines.length * 28;
    markup.push(`<rect x="${margin}" y="${cursor}" width="${width - margin * 2}" height="${cardHeight}" rx="12" fill="${paper}" stroke="${line}" stroke-width="1"/>`);
    lines.forEach((line, lineIndex) => {
      const size = lineIndex === 0 ? 20 : lineIndex === 1 ? 18 : 14;
      const weight = lineIndex < 2 ? '700' : '600';
      const color = lineIndex === 0 ? green : ink;
      markup.push(`<text x="${margin + 16}" y="${cursor + 16 + 22 + lineIndex * 28}" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`);
    });
    cursor += cardHeight + cardGap;
  });
  return { markup: markup.join(''), height: cursor - y };
}

function reviewCardLines(view: ScorecardRoundView, index: number): readonly string[] {
  const review = view.reviews[index];
  const name = displayPlayerName(view.players[index] ?? { id: review?.playerId ?? '', name: review?.playerName ?? '' }, index);
  if (!review) {
    return [name, '기록 전'];
  }
  const score = review.completedHoles ? relativeScoreLabel(review.totalRelative) : '—';
  const strokes = review.completedHoles ? `${review.totalStrokes}타` : '—';
  const types = visibleScoreTypeCounts(review.scoreTypeCounts).map((entry) => `${entry.label} ${entry.count}`).join(' · ');
  return [
    name,
    `${review.completedHoles}홀 · 총타 ${strokes} · ${score}`,
    `전반 ${relativeScoreLabel(review.frontRelative)} · 후반 ${relativeScoreLabel(review.backRelative)}`,
    `온 평균 ${formatStat(review.averageOnGreenShots)} · 펏 평균 ${formatStat(review.averagePutts)}`,
    `파온율 ${formatPercent(review.girRate)} · 스크램블링(파세이브) ${formatPercent(review.parSaveRate)}`,
    `1펏 ${review.onePuttCount}회 · 3펏 ${review.threePuttCount}회`,
    types || '기록 전',
  ];
}

function renderNoteSection(title: string, lines: readonly string[], y: number, width: number): { readonly markup: readonly string[]; readonly height: number } {
  if (lines.length === 0) {
    return { markup: [], height: 0 };
  }
  const cardHeight = 16 + lines.length * 28;
  return {
    height: 24 + 16 + cardHeight + sectionGap,
    markup: [
      `<text x="${margin}" y="${y + 24}" font-size="24" font-weight="700" fill="${green}">${escapeXml(title)}</text>`,
      `<rect x="${margin}" y="${y + 24 + 16}" width="${width - margin * 2}" height="${cardHeight}" rx="12" fill="${paper}" stroke="${line}" stroke-width="1"/>`,
      ...lines.map((line, index) => `<text x="${margin + 16}" y="${y + 24 + 16 + 28 + index * 28}" font-size="16" font-weight="600" fill="${ink}">${escapeXml(line)}</text>`),
    ],
  };
}

function holeValue(hole: ScorecardHoleView | undefined, playerId: string): { readonly main: string; readonly sub: string } {
  if (!hole) {
    return { main: '', sub: '' };
  }
  const cell = hole.cells.find((candidate) => candidate.playerId === playerId);
  const badge = cell?.badge ? ` ${cell.badge}` : '';
  return { main: cell?.main ?? '—', sub: `${cell?.sub ?? ''}${badge}`.trim() };
}

function strokesFor(hole: ScorecardHoleView | undefined, playerId: string): number | undefined {
  if (!hole) {
    return undefined;
  }
  const cell = hole.cells.find((candidate) => candidate.playerId === playerId);
  if (!cell || cell.main === '—' || cell.main === '') {
    return undefined;
  }
  const relative = Number(cell.main);
  return Number.isFinite(relative) ? hole.par + relative : undefined;
}

function sumDefined(values: readonly (number | undefined)[]): string {
  const numbers = values.filter((value): value is number => typeof value === 'number');
  return numbers.length > 0 ? `${numbers.reduce((sum, value) => sum + value, 0)}` : '—';
}

function centeredText(value: string, x: number, y: number, width: number, height: number, fontSize: number, weight: string, fill: string): string {
  const baseline = y + height / 2 + fontSize * 0.35;
  return `<text x="${x + width / 2}" y="${baseline.toFixed(1)}" text-anchor="middle" font-size="${fontSize}" font-weight="${weight}" fill="${fill}">${escapeXml(value)}</text>`;
}

function penaltyTextLines(view: ScorecardRoundView): readonly string[] {
  return view.reviews.flatMap((review, index) => review.lostStrokeHoles.map((lost) => {
    const name = displayPlayerName(view.players[index] ?? { id: review.playerId, name: review.playerName }, index);
    return `${name} ${lost.holeNumber}H ${lost.label}`;
  }));
}

function memoTextLines(view: ScorecardRoundView): readonly string[] {
  return view.memoHighlights.flatMap((memo) => wrapText(`${memo.holeNumber}H ${memo.memo}`, 42));
}

function wrapText(value: string, maxLength: number): readonly string[] {
  const characters = Array.from(value);
  if (characters.length <= maxLength) {
    return [value];
  }
  const lines: string[] = [];
  for (let index = 0; index < characters.length; index += maxLength) {
    lines.push(characters.slice(index, index + maxLength).join(''));
  }
  return lines;
}

function scoreSummaryText(view: ScorecardRoundView): string {
  const firstReview = view.reviews[0];
  if (!firstReview || firstReview.completedHoles === 0) {
    return '기록 전';
  }
  return `${firstReview.completedHoles}홀 ${relativeScoreLabel(firstReview.totalRelative)}`;
}

function formatStat(value: number | null): string {
  return value === null ? '—' : `${value}`;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

function fitLabel(value: string, maxLength: number): string {
  const characters = Array.from(value);
  return characters.length > maxLength ? `${characters.slice(0, maxLength - 1).join('')}…` : value;
}

function formatExportTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(parsed);
}

async function svgToPngBlob(svg: string): Promise<Blob | null> {
  const size = exportedSvgSize(svg);
  if (!size) {
    return null;
  }

  const pixelSize = scorecardExportPixelSize(size.width, size.height);
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = pixelSize.width;
    canvas.height = pixelSize.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    context.drawImage(image, 0, 0, pixelSize.width, pixelSize.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, pngMimeType));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('scorecard export image load failed'));
    image.src = url;
  });
}

function exportedSvgSize(svg: string): { readonly width: number; readonly height: number } | null {
  const width = Number(svg.match(/<svg[^>]*\swidth="(\d+)"/)?.[1]);
  const height = Number(svg.match(/<svg[^>]*\sheight="(\d+)"/)?.[1]);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? { width, height } : null;
}

function canOpenPhotoSaveMenu(value: Navigator | null, file: File): value is Navigator & { share: (data: ShareData) => Promise<void>; canShare: (data: ShareData) => boolean } {
  if (!value || !('share' in value) || !('canShare' in value)) {
    return false;
  }

  try {
    return value.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
