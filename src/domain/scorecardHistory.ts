import { buildScorecardView, cloneScorecardRound, displayPlayerName, normalizeScorecardRoundPayload, type ScorecardRound } from './scorecard';
import { formatStatDelta, formatStatValue, reviewStatDefinition, reviewStatsFor, type ReviewStatUnit } from './reviewStats';
import { type StorageLike } from './scorecardStorage';

export const scorecardHistoryStorageKey = 'fungolf-scorecard:history:v1';
const historyVersion = 1;
const maximumHistoryRounds = 40;

export type FinishedRoundPlayer = {
  readonly playerId: string;
  readonly playerName: string;
  readonly totalStrokes: number;
  readonly totalRelative: number;
  readonly completedHoles: number;
  readonly girRate: number | null;
  readonly stats?: Readonly<Record<string, number | null>>;
};

export type FinishedRoundRecord = {
  readonly id: string;
  readonly finishedAt: string;
  readonly roundName: string;
  readonly courseName: string;
  readonly players: readonly FinishedRoundPlayer[];
  readonly card?: ScorecardRound;
};

export type HistorySummary = {
  readonly rounds: number;
  readonly averageStrokes: number;
  readonly averageRelative: number;
  readonly girRates: readonly (number | null)[];
};

export function createFinishedRoundRecord(round: ScorecardRound, finishedAt: string): FinishedRoundRecord | null {
  const view = buildScorecardView(round);
  if (view.reviews.every((review) => review.completedHoles === 0)) {
    return null;
  }

  return {
    id: `${round.id}-${finishedAt}`,
    finishedAt,
    roundName: round.roundName,
    courseName: round.courseName,
    players: view.reviews.map((review, index) => ({
      playerId: review.playerId,
      playerName: displayPlayerName(view.players[index] ?? { id: review.playerId, name: review.playerName }, index),
      totalStrokes: review.totalStrokes,
      totalRelative: review.totalRelative,
      completedHoles: review.completedHoles,
      girRate: review.girRate,
      stats: Object.fromEntries(reviewStatsFor(review).map((stat) => [stat.id, stat.numeric])),
    })),
    card: cloneScorecardRound(round),
  };
}

export function formatFinishedRoundWhen(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(parsed);
}

export type StatComparison = {
  readonly id: string;
  readonly current: number | null;
  readonly average: number | null;
  readonly samples: number;
  readonly unit: ReviewStatUnit;
};

export function historyPeers(records: readonly FinishedRoundRecord[], playerName: string, playerIndex: number): readonly FinishedRoundPlayer[] {
  const trimmed = playerName.trim();
  return records.flatMap((record) => {
    const named = trimmed ? record.players.find((player) => player.playerName.trim() === trimmed) : undefined;
    const peer = named ?? record.players[playerIndex];
    return peer && peer.completedHoles > 0 ? [peer] : [];
  });
}

export function firstPlayerPeers(records: readonly FinishedRoundRecord[]): readonly FinishedRoundPlayer[] {
  return records.flatMap((record) => {
    const player = record.players[0];
    return player && player.completedHoles > 0 ? [player] : [];
  });
}

export function statValueFromHistory(player: FinishedRoundPlayer, id: string): number | null {
  if (player.stats && Object.prototype.hasOwnProperty.call(player.stats, id)) {
    const value = player.stats[id];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  if (id === 'totalStrokes') {
    return player.totalStrokes;
  }
  if (id === 'girRate') {
    return player.girRate;
  }
  if (id === 'strokesPerHole') {
    return player.completedHoles > 0 ? roundToOneDecimal(player.totalStrokes / player.completedHoles) : null;
  }
  return null;
}

export function compareStats(current: readonly { readonly id: string; readonly numeric: number | null; readonly unit: ReviewStatUnit }[], peers: readonly FinishedRoundPlayer[]): readonly StatComparison[] {
  return current.map((stat) => {
    const values = peers.map((peer) => statValueFromHistory(peer, stat.id)).filter((value): value is number => value !== null);
    return {
      id: stat.id,
      current: stat.numeric,
      average: values.length > 0 ? roundToOneDecimal(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
      samples: values.length,
      unit: stat.unit,
    };
  });
}

export function comparisonNote(comparison: StatComparison | undefined, savedRounds: number): string | null {
  if (savedRounds === 0 || !comparison) {
    return null;
  }
  const definition = reviewStatDefinition(comparison.id);
  if (!definition) {
    return null;
  }
  if (comparison.samples === 0 || comparison.average === null || comparison.current === null) {
    return '지난 라운드에는 이 항목이 없어 평균과 비교하지 않습니다.';
  }
  const delta = roundToOneDecimal(comparison.current - comparison.average);
  return `지난 ${comparison.samples}라운드 평균 ${formatStatValue(comparison.average, comparison.unit)}. 이번과의 차이는 ${formatStatDelta(delta, comparison.unit)}입니다.`;
}

export function comparisonHeadline(comparisons: readonly StatComparison[]): string | null {
  const strokes = comparisons.find((comparison) => comparison.id === 'strokesPerHole');
  const gir = comparisons.find((comparison) => comparison.id === 'girRate');
  const scrambling = comparisons.find((comparison) => comparison.id === 'scrambling');
  const parts = [strokes, gir, scrambling].flatMap((comparison) => {
    if (!comparison || comparison.current === null || comparison.average === null || comparison.samples === 0) {
      return [];
    }
    const delta = roundToOneDecimal(comparison.current - comparison.average);
    return [`${reviewStatDefinition(comparison.id)?.label ?? comparison.id} ${formatStatValue(comparison.current, comparison.unit)} · 평균 ${formatStatValue(comparison.average, comparison.unit)} (${formatStatDelta(delta, comparison.unit)})`];
  });
  if (parts.length === 0) {
    return null;
  }
  const samples = Math.max(strokes?.samples ?? 0, gir?.samples ?? 0, scrambling?.samples ?? 0);
  return `지난 ${samples}라운드 평균과 비교. ${parts.join(' · ')}`;
}

export function summarizeScorecardHistory(records: readonly FinishedRoundRecord[]): HistorySummary | null {
  const primary = records.map((record) => record.players[0]).filter((player): player is FinishedRoundPlayer => Boolean(player && player.completedHoles > 0));
  if (primary.length === 0) {
    return null;
  }

  return {
    rounds: primary.length,
    averageStrokes: roundToOneDecimal(primary.reduce((sum, player) => sum + player.totalStrokes, 0) / primary.length),
    averageRelative: roundToOneDecimal(primary.reduce((sum, player) => sum + player.totalRelative, 0) / primary.length),
    girRates: primary.map((player) => player.girRate),
  };
}

export function loadScorecardHistory(storage: StorageLike | undefined): readonly FinishedRoundRecord[] {
  if (!storage) {
    return [];
  }

  try {
    return parseHistory(storage.getItem(scorecardHistoryStorageKey));
  } catch {
    return [];
  }
}

export function clearScorecardHistory(storage: StorageLike | undefined): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(scorecardHistoryStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function removeScorecardHistoryRecord(storage: StorageLike | undefined, recordId: string): readonly FinishedRoundRecord[] | null {
  return removeScorecardHistoryRecords(storage, [recordId]);
}

export function removeScorecardHistoryRecords(storage: StorageLike | undefined, recordIds: readonly string[]): readonly FinishedRoundRecord[] | null {
  if (!storage) {
    return null;
  }

  try {
    const drop = new Set(recordIds);
    const next = loadScorecardHistory(storage).filter((record) => !drop.has(record.id));
    storage.setItem(scorecardHistoryStorageKey, JSON.stringify({ version: historyVersion, rounds: next }));
    return next;
  } catch {
    return null;
  }
}

export function formatPenaltyHoleSummary(round: ScorecardRound): string {
  const multiple = round.players.length > 1;
  const parts: string[] = [];
  round.players.forEach((player, index) => {
    let ob = 0;
    let hazard = 0;
    const obHoles: number[] = [];
    const hazardHoles: number[] = [];
    for (const hole of round.holes) {
      const mark = hole.penalties.find((penalty) => penalty.playerId === player.id);
      if (!mark) continue;
      if (mark.ob > 0) {
        ob += mark.ob;
        obHoles.push(hole.holeNumber);
      }
      if (mark.hazard > 0) {
        hazard += mark.hazard;
        hazardHoles.push(hole.holeNumber);
      }
    }
    const prefix = multiple ? `${player.name.trim() || `${index + 1}번`} ` : '';
    if (ob > 0) parts.push(`${prefix}OB ${ob}회 (${obHoles.map((hole) => `${hole}번`).join(', ')})`);
    if (hazard > 0) parts.push(`${prefix}해저드 ${hazard}회 (${hazardHoles.map((hole) => `${hole}번`).join(', ')})`);
  });
  return parts.join(' · ');
}

export function appendScorecardHistory(storage: StorageLike | undefined, record: FinishedRoundRecord): boolean {
  if (!storage) {
    return false;
  }

  try {
    const next = [...loadScorecardHistory(storage), record].slice(-maximumHistoryRounds);
    storage.setItem(scorecardHistoryStorageKey, JSON.stringify({ version: historyVersion, rounds: next }));
    return true;
  } catch {
    return false;
  }
}

function parseHistory(raw: string | null): readonly FinishedRoundRecord[] {
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as { version?: unknown; rounds?: unknown };
  if (parsed.version !== historyVersion || !Array.isArray(parsed.rounds)) {
    return [];
  }

  return parsed.rounds.flatMap((entry) => {
    const record = normalizeRecord(entry);
    return record ? [record] : [];
  });
}

function normalizeRecord(value: unknown): FinishedRoundRecord | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.finishedAt !== 'string' || !Array.isArray(value.players)) {
    return null;
  }

  const players = value.players.flatMap((player) => {
    const normalized = normalizePlayer(player);
    return normalized ? [normalized] : [];
  });
  if (players.length === 0) {
    return null;
  }

  const card = value.card === undefined || value.card === null ? undefined : normalizeScorecardRoundPayload(value.card) ?? undefined;
  return {
    id: value.id,
    finishedAt: value.finishedAt,
    roundName: typeof value.roundName === 'string' ? value.roundName : '',
    courseName: typeof value.courseName === 'string' ? value.courseName : '',
    players,
    ...(card ? { card } : {}),
  };
}

function normalizePlayer(value: unknown): FinishedRoundPlayer | null {
  if (!isRecord(value) || typeof value.playerId !== 'string') {
    return null;
  }

  return {
    playerId: value.playerId,
    playerName: typeof value.playerName === 'string' ? value.playerName : '',
    totalStrokes: finiteNumber(value.totalStrokes),
    totalRelative: finiteNumber(value.totalRelative),
    completedHoles: finiteNumber(value.completedHoles),
    girRate: typeof value.girRate === 'number' && Number.isFinite(value.girRate) ? value.girRate : null,
    stats: normalizeStats(value.stats),
  };
}

function normalizeStats(value: unknown): Readonly<Record<string, number | null>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const stats: Record<string, number | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      stats[key] = entry;
    } else if (entry === null) {
      stats[key] = null;
    }
  }
  return stats;
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
