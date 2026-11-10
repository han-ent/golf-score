import { buildScorecardView, displayPlayerName, type ScorecardRound } from './scorecard';
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
    })),
  };
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
  };
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
