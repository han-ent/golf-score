import { displayPlayerName, relativeScoreLabel, visibleScoreTypeCounts, type ScorecardRoundView } from './domain/scorecard';

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
const cellWidth = 72;
const rowHeight = 112;
const labelWidth = 96;
const horizontalPadding = 16;
const topHeaderHeight = 92;
const nineGap = 28;
const reviewLineHeight = 32;
const bottomPadding = 28;
export const scorecardExportPixelRatio = 2;
const svgNamespace = 'http' + '://www.w3.org/2000/svg';
const pngMimeType = 'image/png';

export function createScorecardExportSvg(input: ScorecardExportInput): string {
  const width = horizontalPadding * 2 + labelWidth + cellWidth * columnsPerNine;
  const nines = nineGroups(input.view.holes);
  const scorecardHeight = nines.reduce((sum, group) => sum + nineBlockHeight(group.length > 0 ? input.view.players.length : 0), 0) + Math.max(0, nines.length - 1) * nineGap;
  const reviewLines = reviewTextLines(input.view);
  const memoLines = memoTextLines(input.view);
  const penaltyLines = penaltyTextLines(input.view);
  const reviewHeight = sectionHeight(reviewLines);
  const memoHeight = sectionHeight(memoLines);
  const penaltyHeight = sectionHeight(penaltyLines);
  const height = topHeaderHeight + scorecardHeight + reviewHeight + penaltyHeight + memoHeight + bottomPadding;
  const title = truncateLabel(input.courseName.trim() || input.roundName.trim() || 'FunGolf 스코어카드', 16);
  const subtitle = [input.roundName.trim(), scoreSummaryText(input.view)].filter(Boolean).join(' · ') || '필드 기록';
  const generatedAt = formatExportTimestamp(input.generatedAt);

  let cursorY = topHeaderHeight;
  const nineMarkup = nines.map((group, index) => {
    const block = renderNine(group, input.view.players, cursorY, index === 0 ? '전반' : '후반');
    cursorY += nineBlockHeight(input.view.players.length) + nineGap;
    return block;
  });
  const reviewY = topHeaderHeight + scorecardHeight + 8;
  const penaltyY = reviewY + reviewHeight;
  const memoY = penaltyY + penaltyHeight;

  return [
    `<svg xmlns="${svgNamespace}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)} 스코어카드">`,
    '<style><![CDATA[text{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif}]]></style>',
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="${horizontalPadding}" y="40" font-size="28" font-weight="700" fill="#17241f">${escapeXml(title)}</text>`,
    `<text x="${horizontalPadding}" y="68" font-size="16" font-weight="600" fill="#17241f">${escapeXml(truncateLabel(subtitle, 28))}</text>`,
    `<text x="${width - horizontalPadding}" y="40" text-anchor="end" font-size="14" font-weight="600" fill="#5c564c">${escapeXml(generatedAt)}</text>`,
    ...nineMarkup,
    ...renderWrappedSection('라운드 리뷰', reviewLines, reviewY, width),
    ...renderWrappedSection('타수를 잃은 홀', penaltyLines, penaltyY, width),
    ...renderWrappedSection('홀 메모', memoLines, memoY, width),
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

function sectionHeight(lines: readonly string[]): number {
  return lines.length ? 52 + lines.length * reviewLineHeight : 0;
}

function nineBlockHeight(playerCount: number): number {
  return 24 + rowHeight * (2 + playerCount);
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
  holes: readonly ScorecardRoundView['holes'][number][],
  players: ScorecardRoundView['players'],
  y: number,
  label: string,
): string {
  const padded = Array.from({ length: columnsPerNine }, (_, index) => holes[index]);
  const headerY = y + 24;
  const parY = headerY + rowHeight;
  const playerY = parY + rowHeight;
  return [
    `<text x="${horizontalPadding}" y="${y + 16}" font-size="14" font-weight="700" fill="#8d7344">${label}</text>`,
    renderRow('홀', padded.map((hole) => ({ main: hole ? `${hole.holeNumber}` : '', sub: '' })), headerY, true),
    renderRow('파', padded.map((hole) => ({ main: hole ? `${hole.par}` : '', sub: '' })), parY, false),
    ...players.map((player, index) =>
      renderRow(
        displayPlayerName(player, index),
        padded.map((hole) => {
          const cell = hole?.cells.find((candidate) => candidate.playerId === player.id);
          return { main: cell?.main ?? (hole ? '—' : ''), sub: cell?.sub ?? '' };
        }),
        playerY + rowHeight * index,
        false,
      ),
    ),
  ].join('');
}

function renderRow(label: string, values: readonly { readonly main: string; readonly sub: string }[], y: number, header: boolean): string {
  const cells = values.map((value, index) => renderCell(value.main, value.sub, horizontalPadding + labelWidth + cellWidth * index, y, header));
  return [
    `<rect x="${horizontalPadding}" y="${y}" width="${labelWidth - 8}" height="${rowHeight - 8}" rx="8" fill="#ffffff" stroke="#d9d2c5" stroke-width="1"/>`,
    `<text x="${horizontalPadding + 10}" y="${y + 58}" font-size="15" font-weight="700" fill="#17241f">${escapeXml(truncateLabel(label, 5))}</text>`,
    ...cells,
  ].join('');
}

function renderCell(main: string, sub: string, x: number, y: number, header: boolean): string {
  if (!main && !sub) {
    return `<rect x="${x}" y="${y}" width="${cellWidth - 8}" height="${rowHeight - 8}" rx="8" fill="#ffffff" stroke="#efeae1" stroke-width="1"/>`;
  }
  const parts = sub.split(' · ').filter(Boolean).map((part) => truncateLabel(part, 6));
  const mainY = parts.length ? y + 34 : y + 62;
  const fill = header ? '#f3efe6' : '#ffffff';
  const stroke = header ? '#1e3d32' : '#d9d2c5';
  const mainFill = header ? '#f7f4ee' : '#17241f';
  const textFill = header ? '#1e3d32' : '#17241f';
  return [
    `<rect x="${x}" y="${y}" width="${cellWidth - 8}" height="${rowHeight - 8}" rx="8" fill="${header ? '#1e3d32' : fill}" stroke="${stroke}" stroke-width="1"/>`,
    `<text x="${x + (cellWidth - 8) / 2}" y="${mainY}" text-anchor="middle" font-size="${header ? 18 : 26}" font-weight="700" fill="${header ? mainFill : textFill}">${escapeXml(main)}</text>`,
    ...parts.map((part, index) => `<text x="${x + (cellWidth - 8) / 2}" y="${y + 58 + index * 20}" text-anchor="middle" font-size="13" font-weight="650" fill="#17241f">${escapeXml(part)}</text>`),
  ].join('');
}

function renderWrappedSection(title: string, lines: readonly string[], y: number, width: number): readonly string[] {
  if (lines.length === 0) {
    return [];
  }
  const cardHeight = 24 + lines.length * reviewLineHeight;
  return [
    `<text x="${horizontalPadding}" y="${y}" font-size="18" font-weight="700" fill="#1e3d32">${escapeXml(title)}</text>`,
    `<rect x="${horizontalPadding}" y="${y + 10}" width="${width - horizontalPadding * 2}" height="${cardHeight}" rx="12" fill="#ffffff" stroke="#d9d2c5" stroke-width="1"/>`,
    ...lines.map((line, index) => `<text x="${horizontalPadding + 16}" y="${y + 36 + reviewLineHeight * index}" font-size="16" font-weight="600" fill="#17241f">${escapeXml(line)}</text>`),
  ];
}

function reviewTextLines(view: ScorecardRoundView): readonly string[] {
  return view.reviews.flatMap((review, index) => {
    const name = displayPlayerName(view.players[index] ?? { id: review.playerId, name: review.playerName }, index);
    const score = review.completedHoles ? relativeScoreLabel(review.totalRelative) : '—';
    const strokes = review.completedHoles ? `${review.totalStrokes}타` : '—';
    const types = visibleScoreTypeCounts(review.scoreTypeCounts).map((entry) => `${entry.label} ${entry.count}`).join(' · ');
    return [
      name,
      `${review.completedHoles}홀 · 총타 ${strokes} · ${score}`,
      `전반 ${relativeScoreLabel(review.frontRelative)} · 후반 ${relativeScoreLabel(review.backRelative)}`,
      `온 평균 ${formatStat(review.averageOnGreenShots)} · 펏 평균 ${formatStat(review.averagePutts)}`,
      `파온율 ${formatPercent(review.girRate)} · 파세이브율 ${formatPercent(review.parSaveRate)}`,
      `1펏 ${review.onePuttCount}회 · 3펏 ${review.threePuttCount}회`,
      types || '기록 전',
    ];
  });
}

function penaltyTextLines(view: ScorecardRoundView): readonly string[] {
  return view.reviews.flatMap((review, index) => review.lostStrokeHoles.map((lost) => {
    const name = displayPlayerName(view.players[index] ?? { id: review.playerId, name: review.playerName }, index);
    return `${name} ${lost.holeNumber}H ${lost.label}`;
  }));
}

function memoTextLines(view: ScorecardRoundView): readonly string[] {
  return view.memoHighlights.flatMap((memo) => wrapText(`${memo.holeNumber}H ${memo.memo}`, 32));
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

function truncateLabel(value: string, maxLength = 8): string {
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
