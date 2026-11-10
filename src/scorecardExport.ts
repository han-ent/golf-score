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
const headerFont = 24;
const headerToBox = 12;
const boxPadding = 24;
const lineHeight = 32;
const textAscent = 14;
const textDescent = 4;
const cardGap = 16;
export const scorecardExportPixelRatio = 2;
export function exportTextBoxHeight(lineCount: number): number {
  if (lineCount <= 0) {
    return boxPadding * 2;
  }
  return boxPadding + textAscent + (lineCount - 1) * lineHeight + textDescent + boxPadding;
}
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
  if (review.markup) {
    parts.push(review.markup);
    y += review.height + sectionGap;
  }
  const penalties = renderNoteSection('타수를 잃은 홀', penaltyTextLines(input.view), y, width, 'lost');
  if (penalties.markup) {
    parts.push(penalties.markup);
    y += penalties.height + sectionGap;
  }
  const memos = renderNoteSection('홀 메모', memoTextLines(input.view), y, width, 'memo');
  if (memos.markup) {
    parts.push(memos.markup);
    y += memos.height + sectionGap;
  }

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

type ExportCell = {
  readonly main: string;
  readonly sub: string;
  readonly markers: readonly ('OB' | 'H')[];
};

function renderRow(label: string, values: readonly string[], subtotal: string, y: number, header: boolean): string {
  return renderCells(label, values.map((value) => ({ main: value, sub: '', markers: [] })), subtotal, y, header);
}

function renderScoreRow(label: string, values: readonly ExportCell[], subtotal: string, y: number): string {
  return renderCells(label, values, subtotal, y, false);
}

function renderCells(
  label: string,
  values: readonly ExportCell[],
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
    cells.push(renderValueCell(value, x, y, header, false));
    x += cellWidth + (index === values.length - 1 ? clusterGap : holeGap);
  });
  cells.push(renderValueCell({ main: subtotal, sub: '', markers: [] }, x, y, header, true));
  return cells.join('');
}

function renderLabelCell(label: string, x: number, y: number, header: boolean): string {
  const fill = header ? green : paper;
  const color = header ? ivory : ink;
  const maxWidth = labelWidth - 12;
  const id = `label-${x}-${y}`;
  return [
    `<rect x="${x}" y="${y}" width="${labelWidth}" height="${rowHeight}" rx="8" fill="${fill}" stroke="${header ? green : line}" stroke-width="1"/>`,
    `<defs><clipPath id="${id}"><rect x="${x + 1}" y="${y + 1}" width="${labelWidth - 2}" height="${rowHeight - 2}" rx="7"/></clipPath></defs>`,
    `<g clip-path="url(#${id})">`,
    clippedText(fitExportText(label, maxWidth, 16, 12), x, y, labelWidth, rowHeight, '700', color, maxWidth),
    '</g>',
  ].join('');
}

function renderValueCell(cell: ExportCell, x: number, y: number, header: boolean, subtotal: boolean): string {
  const width = subtotal ? subtotalWidth : cellWidth;
  const fill = header ? green : paper;
  const color = header ? ivory : subtotal ? brass : ink;
  const showDetail = !header && !subtotal && cell.sub.trim().length > 0;
  const showMarkers = !header && !subtotal && cell.markers.length > 0;
  const markerBand = showMarkers ? 16 : 0;
  const mainTop = y + markerBand;
  const mainHeight = showDetail ? rowHeight - markerBand - 22 : rowHeight - markerBand;
  const maxWidth = width - 8;
  const id = clipId(x, y);
  const parts = [
    `<rect x="${x}" y="${y}" width="${width}" height="${rowHeight}" rx="8" fill="${fill}" stroke="${header ? green : line}" stroke-width="1"/>`,
    `<defs><clipPath id="${id}"><rect x="${x + 1}" y="${y + 1}" width="${width - 2}" height="${rowHeight - 2}" rx="7"/></clipPath></defs>`,
    `<g clip-path="url(#${id})">`,
  ];
  if (showMarkers) {
    parts.push(renderMarkers(cell.markers, x, y, width));
  }
  parts.push(clippedText(
    fitExportText(cell.main || '—', maxWidth, header ? 20 : showDetail ? 18 : 22, 14),
    x,
    mainTop,
    width,
    mainHeight,
    '700',
    color,
    maxWidth,
  ));
  if (showDetail) {
    parts.push(clippedText(
      fitExportText(cell.sub, maxWidth, 12, 9),
      x,
      y + rowHeight - 22,
      width,
      20,
      '600',
      muted,
      maxWidth,
    ));
  }
  parts.push('</g>');
  return parts.join('');
}

function clipId(x: number, y: number): string {
  return `cell-${x}-${y}`;
}

function renderMarkers(markers: readonly ('OB' | 'H')[], x: number, y: number, width: number): string {
  let cursor = x + width - 4;
  const parts: string[] = [];
  for (const marker of [...markers].reverse()) {
    const badgeWidth = marker === 'OB' ? 18 : 14;
    cursor -= badgeWidth;
    parts.push(`<rect x="${cursor}" y="${y + 3}" width="${badgeWidth}" height="12" rx="4" fill="${brass}"/>`);
    parts.push(`<text class="cell-marker" x="${cursor + badgeWidth / 2}" y="${y + 12}" text-anchor="middle" font-size="8" font-weight="700" fill="${ivory}">${marker}</text>`);
    cursor -= 2;
  }
  return parts.join('');
}

function renderTotals(
  view: ScorecardRoundView,
  nines: readonly (readonly ScorecardHoleView[])[],
  y: number,
): { readonly markup: string; readonly height: number } {
  const lineCount = Math.max(1, view.players.length);
  const height = headerFont + headerToBox + lineCount * lineHeight;
  const lines = view.players.map((player, index) => {
    const review = view.reviews[index];
    const name = displayPlayerName(player, index);
    const out = nines[0] ? sumDefined(nines[0].map((hole) => strokesFor(hole, player.id))) : '—';
    const inn = nines[1] ? sumDefined(nines[1].map((hole) => strokesFor(hole, player.id))) : '—';
    const total = review?.completedHoles ? `${review.totalStrokes}타` : '—';
    const relative = review?.completedHoles ? exportRelativeLabel(review.totalRelative) : '—';
    const pieces = [`${name}  OUT ${out}`, nines[1] ? `IN ${inn}` : '', `합계 ${total}  ${relative}`].filter(Boolean);
    const baseline = y + headerFont + headerToBox + textAscent + index * lineHeight;
    return `<text x="${margin}" y="${baseline}" font-size="16" font-weight="600" fill="${ink}">${escapeXml(pieces.join('  '))}</text>`;
  });
  return {
    height,
    markup: [
      `<text x="${margin}" y="${y + headerFont}" font-size="${headerFont}" font-weight="700" fill="${green}">합계</text>`,
      ...lines,
    ].join(''),
  };
}

function renderReview(view: ScorecardRoundView, y: number, width: number): { readonly markup: string; readonly height: number } {
  const textWidth = width - margin * 2 - boxPadding * 2;
  const cards = view.reviews.map((review, index) => reviewCardLines(view, index).flatMap((line) => wrapToWidth(line, textWidth, 16)));
  return renderTextSection('라운드 리뷰', cards, y, width, 'review');
}

function reviewCardLines(view: ScorecardRoundView, index: number): readonly string[] {
  const review = view.reviews[index];
  const name = displayPlayerName(view.players[index] ?? { id: review?.playerId ?? '', name: review?.playerName ?? '' }, index);
  if (!review) {
    return [name, '기록 전'];
  }
  const score = review.completedHoles ? exportRelativeLabel(review.totalRelative) : '—';
  const strokes = review.completedHoles ? `${review.totalStrokes}타` : '—';
  const types = visibleScoreTypeCounts(review.scoreTypeCounts).map((entry) => `${entry.label} ${entry.count}`).join(' · ');
  return [
    name,
    `${review.completedHoles}홀 · 총타 ${strokes} · ${score}`,
    `전반 ${exportRelativeLabel(review.frontRelative)} · 후반 ${exportRelativeLabel(review.backRelative)}`,
    `온 평균 ${formatStat(review.averageOnGreenShots)} · 펏 평균 ${formatStat(review.averagePutts)}`,
    `파온율 ${formatPercent(review.girRate)} · 스크램블링(파세이브) ${formatPercent(review.parSaveRate)}`,
    `1펏 ${review.onePuttCount}회 · 3펏 ${review.threePuttCount}회`,
    types || '기록 전',
  ];
}

function renderNoteSection(
  title: string,
  lines: readonly string[],
  y: number,
  width: number,
  section: string,
): { readonly markup: string; readonly height: number } {
  if (lines.length === 0) {
    return { markup: '', height: 0 };
  }
  const textWidth = width - margin * 2 - boxPadding * 2;
  const wrapped = lines.flatMap((line) => wrapToWidth(line, textWidth, 16));
  return renderTextSection(title, [wrapped], y, width, section);
}

function renderTextSection(
  title: string,
  cards: readonly (readonly string[])[],
  y: number,
  width: number,
  section: string,
): { readonly markup: string; readonly height: number } {
  const headerBaseline = y + headerFont;
  let boxTop = headerBaseline + headerToBox;
  const markup = [`<text x="${margin}" y="${headerBaseline}" font-size="${headerFont}" font-weight="700" fill="${green}">${escapeXml(title)}</text>`];
  cards.forEach((lines, cardIndex) => {
    const boxHeight = exportTextBoxHeight(lines.length);
    markup.push(`<rect data-section="${section}" x="${margin}" y="${boxTop}" width="${width - margin * 2}" height="${boxHeight}" rx="12" fill="${paper}" stroke="${line}" stroke-width="1"/>`);
    lines.forEach((text, lineIndex) => {
      const emphasis = section === 'review' && lineIndex < 2;
      const size = section === 'review' && lineIndex === 0 ? 18 : 16;
      const baseline = boxTop + boxPadding + textAscent + lineIndex * lineHeight;
      markup.push(`<text x="${margin + boxPadding}" y="${baseline}" font-size="${size}" font-weight="${emphasis ? '700' : '600'}" fill="${section === 'review' && lineIndex === 0 ? green : ink}">${escapeXml(text)}</text>`);
    });
    boxTop += boxHeight;
    if (cardIndex < cards.length - 1) {
      boxTop += cardGap;
    }
  });
  return { markup: markup.join(''), height: boxTop - y };
}

function holeValue(hole: ScorecardHoleView | undefined, playerId: string): ExportCell {
  if (!hole) {
    return { main: '', sub: '', markers: [] };
  }
  const cell = hole.cells.find((candidate) => candidate.playerId === playerId);
  const markers: ('OB' | 'H')[] = [];
  if (cell?.badge.includes('OB')) markers.push('OB');
  if (cell?.badge.includes('해저드')) markers.push('H');
  return { main: cell?.main ?? '—', sub: cell?.sub?.trim() ?? '', markers };
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

function clippedText(
  fitted: { readonly text: string; readonly fontSize: number },
  x: number,
  y: number,
  width: number,
  height: number,
  weight: string,
  fill: string,
  maxWidth: number,
): string {
  if (!fitted.text) {
    return '';
  }
  const baseline = y + height / 2 + fitted.fontSize * 0.35;
  return `<text class="cell-fit" data-max="${maxWidth}" x="${x + width / 2}" y="${baseline.toFixed(1)}" text-anchor="middle" font-size="${fitted.fontSize}" font-weight="${weight}" fill="${fill}">${escapeXml(fitted.text)}</text>`;
}

export function estimateExportTextWidth(value: string, fontSize: number): number {
  let width = 0;
  for (const char of Array.from(value)) {
    if (char === ' ' || char === '·') {
      width += fontSize * 0.35;
    } else if (char.charCodeAt(0) < 128) {
      width += fontSize * 0.62;
    } else {
      width += fontSize;
    }
  }
  return width;
}

export function fitExportText(value: string, maxWidth: number, maxFont: number, minFont: number): { readonly text: string; readonly fontSize: number } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { text: '', fontSize: maxFont };
  }
  let fontSize = maxFont;
  while (fontSize > minFont && estimateExportTextWidth(trimmed, fontSize) > maxWidth) {
    fontSize -= 1;
  }
  if (estimateExportTextWidth(trimmed, fontSize) <= maxWidth) {
    return { text: trimmed, fontSize };
  }
  const characters = Array.from(trimmed);
  let count = characters.length;
  while (count > 0 && estimateExportTextWidth(`${characters.slice(0, count).join('')}…`, minFont) > maxWidth) {
    count -= 1;
  }
  return { text: count > 0 ? `${characters.slice(0, count).join('')}…` : '…', fontSize: minFont };
}

function penaltyTextLines(view: ScorecardRoundView): readonly string[] {
  return view.reviews.flatMap((review, index) => review.lostStrokeHoles.map((lost) => {
    const name = displayPlayerName(view.players[index] ?? { id: review.playerId, name: review.playerName }, index);
    return `${name} ${lost.holeNumber}H ${lost.label}`;
  }));
}

function memoTextLines(view: ScorecardRoundView): readonly string[] {
  return view.memoHighlights.map((memo) => `${memo.holeNumber}H ${memo.memo.replace(/\s*\n\s*/g, ' · ')}`);
}

function wrapToWidth(value: string, maxWidth: number, fontSize: number): readonly string[] {
  const characters = Array.from(value);
  if (characters.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let current = '';
  for (const char of characters) {
    const next = `${current}${char}`;
    if (current && estimateExportTextWidth(next, fontSize) > maxWidth) {
      lines.push(current);
      current = char.trim() ? char : '';
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function scoreSummaryText(view: ScorecardRoundView): string {
  const firstReview = view.reviews[0];
  if (!firstReview || firstReview.completedHoles === 0) {
    return '기록 전';
  }
  return `${firstReview.completedHoles}홀 ${exportRelativeLabel(firstReview.totalRelative)}`;
}

function exportRelativeLabel(relative: number): string {
  return relative === 0 ? '±0' : relativeScoreLabel(relative);
}

function formatStat(value: number | null): string {
  return value === null ? '—' : `${value}`;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value}%`;
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
