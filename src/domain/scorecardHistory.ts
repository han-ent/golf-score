import { buildScorecardView, displayPlayerName, type ScorecardRound } from './scorecard';
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
  };
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

  return {
    id: value.id,
    finishedAt: value.finishedAt,
    roundName: typeof value.roundName === 'string' ? value.roundName : '',
    courseName: typeof value.courseName === 'string' ? value.courseName : '',
    players,
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
