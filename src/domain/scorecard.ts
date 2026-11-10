export const scorecardPlayerCountOptions = [1, 2, 3, 4] as const;
export const defaultScorecardHoleCount = 18;
export const maximumScorecardStrokes = 20;

export type ScorecardPlayer = {
  readonly id: string;
  readonly name: string;
};

export type ScorecardRoundSettings = {
  readonly holeCount: number;
};

export type ScorecardRoundLabels = {
  readonly roundName: string;
  readonly courseName: string;
};

export type ScoreEntryMode = 'on-putt' | 'hio' | 'manual';

export type ScorecardHoleScore = {
  readonly playerId: string;
  readonly strokes: number;
  readonly entryMode: ScoreEntryMode;
  readonly onGreenShots?: number;
  readonly putts?: number;
  readonly puttsAssumed?: boolean;
  readonly holeInOne?: boolean;
};

export type HolePenaltyMark = {
  readonly playerId: string;
  readonly ob: boolean;
  readonly hazard: boolean;
};

export type ScorecardHole = {
  readonly holeNumber: number;
  readonly par: number;
  readonly memo: string;
  readonly scores: readonly ScorecardHoleScore[];
  readonly penalties: readonly HolePenaltyMark[];
};

export type ScorecardRound = {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly roundName: string;
  readonly courseName: string;
  readonly players: readonly ScorecardPlayer[];
  readonly settings: ScorecardRoundSettings;
  readonly holes: readonly ScorecardHole[];
};

export type ScorecardCellView = {
  readonly playerId: string;
  readonly holeNumber: number;
  readonly main: string;
  readonly sub: string;
};

export type ScoreTypeCounts = {
  readonly eagleOrBetter: number;
  readonly birdie: number;
  readonly par: number;
  readonly bogey: number;
  readonly doubleBogey: number;
  readonly tripleOrWorse: number;
};

export type ScorecardPlayerReview = {
  readonly playerId: string;
  readonly playerName: string;
  readonly completedHoles: number;
  readonly totalStrokes: number;
  readonly totalRelative: number;
  readonly frontRelative: number;
  readonly backRelative: number;
  readonly scoreTypeCounts: ScoreTypeCounts;
  readonly averageOnGreenShots: number | null;
  readonly averagePutts: number | null;
  readonly onePuttCount: number;
  readonly threePuttCount: number;
  readonly girHits: number;
  readonly girOpportunities: number;
  readonly girRate: number | null;
  readonly parSaves: number;
  readonly parSaveOpportunities: number;
  readonly parSaveRate: number | null;
  readonly lostStrokeHoles: readonly ScorecardLostStroke[];
};

export type ScorecardLostStroke = {
  readonly holeNumber: number;
  readonly label: string;
};

export type ScorecardHoleView = {
  readonly holeNumber: number;
  readonly par: number;
  readonly memo: string;
  readonly cells: readonly ScorecardCellView[];
};

export type ScorecardMemoHighlight = {
  readonly holeNumber: number;
  readonly memo: string;
};

export type ScorecardRoundView = {
  readonly roundId: string;
  readonly players: readonly ScorecardPlayer[];
  readonly holes: readonly ScorecardHoleView[];
  readonly reviews: readonly ScorecardPlayerReview[];
  readonly memoHighlights: readonly ScorecardMemoHighlight[];
};

const blankPlayerTemplates: readonly ScorecardPlayer[] = [
  { id: 'player-1', name: '' },
  { id: 'player-2', name: '' },
  { id: 'player-3', name: '' },
  { id: 'player-4', name: '' },
] as const;

export function createDefaultScorecardPlayers(playerCount = 1): readonly ScorecardPlayer[] {
  const count = normalizePlayerCount(playerCount);
  return blankPlayerTemplates.slice(0, count).map((player) => ({ ...player }));
}

export function createDefaultScorecardRound(input: {
  readonly id?: string;
  readonly now?: string;
  readonly playerCount?: number;
  readonly holeCount?: number;
} = {}): ScorecardRound {
  const now = input.now ?? new Date(0).toISOString();
  const holeCount = normalizeHoleCount(input.holeCount ?? defaultScorecardHoleCount);

  return {
    id: input.id?.trim() || 'scorecard-local-active',
    createdAt: now,
    updatedAt: now,
    roundName: '',
    courseName: '',
    players: createDefaultScorecardPlayers(input.playerCount ?? 1),
    settings: { holeCount },
    holes: createDefaultHoles(holeCount),
  };
}

export function cloneScorecardRound(round: ScorecardRound): ScorecardRound {
  return {
    ...round,
    players: round.players.map((player) => ({ ...player })),
    settings: { ...round.settings },
    holes: round.holes.map((hole) => ({
      ...hole,
      scores: hole.scores.map((score) => ({ ...score })),
      penalties: hole.penalties.map((penalty) => ({ ...penalty })),
    })),
  };
}

export function normalizeScorecardRoundPayload(value: unknown): ScorecardRound | null {
  if (!isRecord(value) || !Array.isArray(value.players)) {
    return null;
  }

  const players = normalizePlayers(value.players);
  if (!players || !hasUniquePlayerIds(players)) {
    return null;
  }

  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : 'scorecard-local-active';
  const createdAt = isIsoString(value.createdAt) ? value.createdAt : new Date(0).toISOString();
  const updatedAt = isIsoString(value.updatedAt) ? value.updatedAt : createdAt;
  const roundName = typeof value.roundName === 'string' ? value.roundName : '';
  const courseName = typeof value.courseName === 'string' ? value.courseName : '';
  const holeCount = normalizeHoleCount(isRecord(value.settings) ? value.settings.holeCount : defaultScorecardHoleCount);
  const holes = normalizeHoles(Array.isArray(value.holes) ? value.holes : [], players, holeCount);

  if (!holes) {
    return null;
  }

  return { id, createdAt, updatedAt, roundName, courseName, players, settings: { holeCount }, holes };
}

export function applyRoundSetupMutation(
  round: ScorecardRound,
  patch: Partial<Pick<ScorecardRoundSettings, 'holeCount'>>,
  now = new Date().toISOString(),
): ScorecardRound {
  const holeCount = patch.holeCount === undefined ? round.settings.holeCount : normalizeHoleCount(patch.holeCount);
  const holes = ensureHoles(round.holes, holeCount, round.players);

  return stampRound({ ...round, settings: { holeCount }, holes }, now);
}

export function applyRoundLabelMutation(round: ScorecardRound, patch: Partial<ScorecardRoundLabels>, now = new Date().toISOString()): ScorecardRound {
  return stampRound(
    {
      ...round,
      roundName: patch.roundName ?? round.roundName,
      courseName: patch.courseName ?? round.courseName,
    },
    now,
  );
}

export function applyPlayerCountMutation(round: ScorecardRound, playerCount: number, now = new Date().toISOString()): ScorecardRound {
  const nextPlayerCount = normalizePlayerCount(playerCount);
  const usedPlayerIds = new Set<string>();
  const players = Array.from({ length: nextPlayerCount }, (_, index) => {
    const player = round.players[index] ?? blankPlayerTemplates[index];
    const id = uniquePlayerId(player.id, usedPlayerIds, index + 1);
    usedPlayerIds.add(id);
    return { id, name: player.name ?? '' };
  });
  const activePlayerIds = new Set(players.map((player) => player.id));
  const holes = round.holes.map((hole) => ({
    ...hole,
    scores: hole.scores.filter((score) => activePlayerIds.has(score.playerId)),
    penalties: hole.penalties.filter((penalty) => activePlayerIds.has(penalty.playerId)),
  }));

  return stampRound({ ...round, players, holes }, now);
}

export function applyPlayerMutation(
  round: ScorecardRound,
  playerId: string,
  patch: Partial<Pick<ScorecardPlayer, 'name'>>,
  now = new Date().toISOString(),
): ScorecardRound {
  return stampRound(
    {
      ...round,
      players: round.players.map((player) => (player.id === playerId ? { ...player, name: patch.name ?? player.name } : player)),
    },
    now,
  );
}

export function applyHoleSetupMutation(
  round: ScorecardRound,
  holeNumber: number,
  patch: Partial<Pick<ScorecardHole, 'par'>>,
  now = new Date().toISOString(),
): ScorecardRound {
  const targetHoleNumber = clampInteger(holeNumber, 1, round.settings.holeCount);
  const holes = ensureHoles(round.holes, round.settings.holeCount, round.players).map((hole) =>
    hole.holeNumber === targetHoleNumber ? { ...hole, par: patch.par === undefined ? hole.par : normalizeHolePar(patch.par) } : hole,
  );

  return stampRound({ ...round, holes }, now);
}

export function applyHoleMemoMutation(round: ScorecardRound, holeNumber: number, memo: string, now = new Date().toISOString()): ScorecardRound {
  const targetHoleNumber = clampInteger(holeNumber, 1, round.settings.holeCount);
  const holes = ensureHoles(round.holes, round.settings.holeCount, round.players).map((hole) =>
    hole.holeNumber === targetHoleNumber ? { ...hole, memo } : hole,
  );

  return stampRound({ ...round, holes }, now);
}

export function applyHolePenaltyMutation(
  round: ScorecardRound,
  holeNumber: number,
  playerId: string,
  kind: 'ob' | 'hazard',
  now = new Date().toISOString(),
): ScorecardRound {
  const targetHoleNumber = clampInteger(holeNumber, 1, round.settings.holeCount);
  if (!round.players.some((player) => player.id === playerId)) {
    return round;
  }

  const holes = ensureHoles(round.holes, round.settings.holeCount, round.players).map((hole) => {
    if (hole.holeNumber !== targetHoleNumber) {
      return hole;
    }

    const current = hole.penalties.find((penalty) => penalty.playerId === playerId) ?? { playerId, ob: false, hazard: false };
    const next = { ...current, [kind]: !current[kind] };
    const penalties = hole.penalties.filter((penalty) => penalty.playerId !== playerId);
    if (!next.ob && !next.hazard) {
      return { ...hole, penalties };
    }

    return { ...hole, penalties: [...penalties, next].sort(sortPenalties(round.players)) };
  });

  return stampRound({ ...round, holes }, now);
}

export function applyHoleScoreMutation(
  round: ScorecardRound,
  holeNumber: number,
  playerId: string,
  score: ScorecardHoleScoreInput | null,
  now = new Date().toISOString(),
): ScorecardRound {
  const targetHoleNumber = clampInteger(holeNumber, 1, round.settings.holeCount);
  const activePlayerIds = new Set(round.players.map((player) => player.id));
  if (!activePlayerIds.has(playerId)) {
    return round;
  }

  const holes = ensureHoles(round.holes, round.settings.holeCount, round.players).map((hole) => {
    if (hole.holeNumber !== targetHoleNumber) {
      return hole;
    }

    const withoutPlayer = hole.scores.filter((candidate) => candidate.playerId !== playerId);
    if (!score) {
      return { ...hole, scores: withoutPlayer };
    }

    return { ...hole, scores: [...withoutPlayer, normalizeScoreInput(playerId, score)].sort(sortScores(round.players)) };
  });

  return stampRound({ ...round, holes }, now);
}

export type ScorecardHoleScoreInput =
  | { readonly strokes: number; readonly entryMode?: 'manual' }
  | { readonly strokes: number; readonly entryMode: 'on-putt'; readonly onGreenShots: number; readonly putts: number; readonly puttsAssumed?: boolean }
  | { readonly strokes: 1; readonly entryMode: 'hio'; readonly onGreenShots: 1; readonly putts: 0; readonly holeInOne: true };

export type QuickScoreKind = 'par' | 'bogey' | 'double';

export function quickScoreForPar(par: number, kind: QuickScoreKind): { readonly onGreenShots: number; readonly putts: 2 } {
  const normalizedPar = normalizeHolePar(par);
  const onGreenShots = kind === 'par' ? normalizedPar - 2 : kind === 'bogey' ? normalizedPar - 1 : normalizedPar;
  return { onGreenShots, putts: 2 };
}

export function scorecardPlayerLabel(player: ScorecardPlayer, index: number): string {
  const name = player.name.trim();
  return name || `${index + 1}번`;
}

export function visibleScoreTypeCounts(counts: ScoreTypeCounts): readonly { readonly key: keyof ScoreTypeCounts; readonly label: string; readonly count: number }[] {
  const order: readonly (keyof ScoreTypeCounts)[] = ['eagleOrBetter', 'birdie', 'par', 'bogey', 'doubleBogey', 'tripleOrWorse'];
  return order.filter((key) => counts[key] > 0).map((key) => ({ key, label: scoreTypeLabel(key), count: counts[key] }));
}

export function buildScorecardView(round: ScorecardRound): ScorecardRoundView {
  const normalizedRound = { ...round, holes: ensureHoles(round.holes, round.settings.holeCount, round.players) };
  const holes = normalizedRound.holes.map((hole): ScorecardHoleView => ({
    holeNumber: hole.holeNumber,
    par: hole.par,
    memo: hole.memo,
    cells: normalizedRound.players.map((player) => cellViewForScore(player.id, hole.holeNumber, hole.par, scoreForPlayer(normalizedRound, hole.holeNumber, player.id))),
  }));

  return {
    roundId: normalizedRound.id,
    players: normalizedRound.players,
    holes,
    reviews: normalizedRound.players.map((player) => buildPlayerReview(normalizedRound, player)),
    memoHighlights: normalizedRound.holes
      .filter((hole) => hole.memo.trim().length > 0)
      .map((hole) => ({ holeNumber: hole.holeNumber, memo: hole.memo.trim() })),
  };
}

export function scoreForPlayer(round: ScorecardRound, holeNumber: number, playerId: string): ScorecardHoleScore | undefined {
  return round.holes.find((hole) => hole.holeNumber === holeNumber)?.scores.find((score) => score.playerId === playerId);
}

export function holeForNumber(round: ScorecardRound, holeNumber: number): ScorecardHole {
  return ensureHoles(round.holes, round.settings.holeCount, round.players).find((hole) => hole.holeNumber === holeNumber) ?? createDefaultHole(holeNumber);
}

export function relativeScoreLabel(relativeScore: number): string {
  if (relativeScore === 0) {
    return '0';
  }

  return relativeScore > 0 ? `+${relativeScore}` : `${relativeScore}`;
}

export function scoreTypeLabel(key: keyof ScoreTypeCounts): string {
  const labels: Record<keyof ScoreTypeCounts, string> = {
    eagleOrBetter: '이글 이하',
    birdie: '버디',
    par: '파',
    bogey: '보기',
    doubleBogey: '더블보기',
    tripleOrWorse: '트리플 이상',
  };
  return labels[key];
}

export function displayPlayerName(player: ScorecardPlayer, index: number): string {
  return player.name.trim() || `${index + 1}번 플레이어`;
}

function buildPlayerReview(round: ScorecardRound, player: ScorecardPlayer): ScorecardPlayerReview {
  const counts: MutableScoreTypeCounts = {
    eagleOrBetter: 0,
    birdie: 0,
    par: 0,
    bogey: 0,
    doubleBogey: 0,
    tripleOrWorse: 0,
  };
  let completedHoles = 0;
  let totalStrokes = 0;
  let totalRelative = 0;
  let frontRelative = 0;
  let backRelative = 0;
  let onGreenTotal = 0;
  let onGreenCount = 0;
  let puttTotal = 0;
  let puttCount = 0;
  let onePuttCount = 0;
  let threePuttCount = 0;
  let girHits = 0;
  let girOpportunities = 0;
  let parSaves = 0;
  let parSaveOpportunities = 0;
  const lostStrokeHoles: ScorecardLostStroke[] = [];

  for (const hole of round.holes) {
    const penalty = hole.penalties.find((mark) => mark.playerId === player.id && (mark.ob || mark.hazard));
    if (penalty) {
      lostStrokeHoles.push({ holeNumber: hole.holeNumber, label: penaltyLabel(penalty) });
    }

    const score = scoreForPlayer(round, hole.holeNumber, player.id);
    if (!score) {
      continue;
    }

    const relative = score.strokes - hole.par;
    completedHoles += 1;
    totalStrokes += score.strokes;
    totalRelative += relative;
    if (hole.holeNumber <= 9) {
      frontRelative += relative;
    } else {
      backRelative += relative;
    }
    counts[scoreTypeKey(relative)] += 1;

    if (score.entryMode === 'on-putt' || score.entryMode === 'hio') {
      if (typeof score.onGreenShots === 'number') {
        onGreenTotal += score.onGreenShots;
        onGreenCount += 1;
        girOpportunities += 1;
        if (score.onGreenShots <= hole.par - 2) {
          girHits += 1;
        } else {
          parSaveOpportunities += 1;
          if (relative <= 0) {
            parSaves += 1;
          }
        }
      }
      if (typeof score.putts === 'number') {
        puttTotal += score.putts;
        puttCount += 1;
        if (score.putts === 1) {
          onePuttCount += 1;
        }
        if (score.putts >= 3) {
          threePuttCount += 1;
        }
      }
    }
  }

  return {
    playerId: player.id,
    playerName: player.name,
    completedHoles,
    totalStrokes,
    totalRelative,
    frontRelative,
    backRelative,
    scoreTypeCounts: counts,
    averageOnGreenShots: onGreenCount > 0 ? roundToOneDecimal(onGreenTotal / onGreenCount) : null,
    averagePutts: puttCount > 0 ? roundToOneDecimal(puttTotal / puttCount) : null,
    onePuttCount,
    threePuttCount,
    girHits,
    girOpportunities,
    girRate: girOpportunities > 0 ? roundToOneDecimal((girHits / girOpportunities) * 100) : null,
    parSaves,
    parSaveOpportunities,
    parSaveRate: parSaveOpportunities > 0 ? roundToOneDecimal((parSaves / parSaveOpportunities) * 100) : null,
    lostStrokeHoles,
  };
}

type MutableScoreTypeCounts = { -readonly [K in keyof ScoreTypeCounts]: number };

function cellViewForScore(playerId: string, holeNumber: number, par: number, score: ScorecardHoleScore | undefined): ScorecardCellView {
  if (!score) {
    return { playerId, holeNumber, main: '—', sub: '' };
  }

  const relative = score.strokes - par;
  return {
    playerId,
    holeNumber,
    main: relativeScoreLabel(relative),
    sub: score.entryMode === 'manual' ? '' : `온 ${score.onGreenShots ?? 0} · 펏 ${score.putts ?? 0}`,
  };
}

function scoreTypeKey(relative: number): keyof ScoreTypeCounts {
  if (relative <= -2) return 'eagleOrBetter';
  if (relative === -1) return 'birdie';
  if (relative === 0) return 'par';
  if (relative === 1) return 'bogey';
  if (relative === 2) return 'doubleBogey';
  return 'tripleOrWorse';
}

function createDefaultHoles(holeCount: number): readonly ScorecardHole[] {
  return Array.from({ length: holeCount }, (_, index) => createDefaultHole(index + 1));
}

function createDefaultHole(holeNumber: number): ScorecardHole {
  return { holeNumber, par: 4, memo: '', scores: [], penalties: [] };
}

function ensureHoles(holes: readonly ScorecardHole[], holeCount: number, players: readonly ScorecardPlayer[]): readonly ScorecardHole[] {
  const activePlayerIds = new Set(players.map((player) => player.id));
  return Array.from({ length: holeCount }, (_, index) => {
    const holeNumber = index + 1;
    const stored = holes.find((hole) => hole.holeNumber === holeNumber);
    if (!stored) {
      return createDefaultHole(holeNumber);
    }

    return {
      holeNumber,
      par: normalizeHolePar(stored.par),
      memo: stored.memo,
      scores: stored.scores.filter((score) => activePlayerIds.has(score.playerId)).map((score) => normalizeStoredScore(score)),
      penalties: (stored.penalties ?? []).filter((penalty) => activePlayerIds.has(penalty.playerId)).map((penalty) => ({ ...penalty })),
    };
  });
}

function normalizeHoles(values: readonly unknown[], players: readonly ScorecardPlayer[], holeCount: number): readonly ScorecardHole[] | null {
  const playerIds = players.map((player) => player.id);
  const holes = values.map((value): ScorecardHole | null => {
    if (!isRecord(value) || !isIntegerInRange(value.holeNumber, 1, 18)) {
      return null;
    }

    const holeNumber = clampInteger(value.holeNumber, 1, holeCount);
    const par = normalizeHolePar(value.par);
    const memo = typeof value.memo === 'string' ? value.memo : '';
    const scores = Array.isArray(value.scores) ? normalizeScores(value.scores, playerIds) : [];
    const penalties = normalizePenalties(value.penalties, playerIds);
    return scores && penalties ? { holeNumber, par, memo, scores, penalties } : null;
  });

  if (!holes.every((hole): hole is ScorecardHole => hole !== null)) {
    return null;
  }

  return ensureHoles(holes, holeCount, players);
}

function normalizePlayers(values: readonly unknown[]): readonly ScorecardPlayer[] | null {
  if (values.length < 1 || values.length > 4) {
    return null;
  }

  const players = values.map((value, index): ScorecardPlayer | null => {
    if (!isRecord(value)) {
      return null;
    }

    const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : `player-${index + 1}`;
    const name = typeof value.name === 'string' ? value.name : '';
    return { id, name };
  });

  return players.every((player): player is ScorecardPlayer => player !== null) ? players : null;
}

function normalizeScores(values: readonly unknown[], playerIds: readonly string[]): readonly ScorecardHoleScore[] | null {
  const scores = values.map((value) => normalizeStoredScore(value)).filter((score) => playerIds.includes(score.playerId));
  return hasUniqueScorePlayerIds(scores) ? scores : null;
}

function normalizeStoredScore(value: unknown): ScorecardHoleScore {
  if (!isRecord(value)) {
    return { playerId: '', strokes: 1, entryMode: 'manual' };
  }

  const playerId = typeof value.playerId === 'string' ? value.playerId : '';
  const entryMode = value.entryMode === 'hio' || value.entryMode === 'manual' || value.entryMode === 'on-putt' ? value.entryMode : 'manual';
  const strokes = clampInteger(typeof value.strokes === 'number' ? value.strokes : 1, 1, maximumScorecardStrokes);

  if (entryMode === 'hio') {
    return { playerId, strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true };
  }

  if (entryMode === 'on-putt') {
    const onGreenShots = clampInteger(typeof value.onGreenShots === 'number' ? value.onGreenShots : 1, 1, 9);
    const putts = clampInteger(typeof value.putts === 'number' ? value.putts : Math.max(0, strokes - onGreenShots), 0, 9);
    return {
      playerId,
      strokes: clampInteger(onGreenShots + putts, 1, maximumScorecardStrokes),
      entryMode: 'on-putt',
      onGreenShots,
      putts,
      puttsAssumed: value.puttsAssumed === true,
    };
  }

  return { playerId, strokes, entryMode: 'manual' };
}

function normalizeScoreInput(playerId: string, score: ScorecardHoleScoreInput): ScorecardHoleScore {
  if (score.entryMode === 'hio') {
    return { playerId, strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true };
  }

  if (score.entryMode === 'on-putt') {
    const onGreenShots = clampInteger(score.onGreenShots, 1, 9);
    const putts = clampInteger(score.putts, 0, 9);
    return {
      playerId,
      strokes: clampInteger(onGreenShots + putts, 1, maximumScorecardStrokes),
      entryMode: 'on-putt',
      onGreenShots,
      putts,
      puttsAssumed: score.puttsAssumed === true,
    };
  }

  return { playerId, strokes: clampInteger(score.strokes, 1, maximumScorecardStrokes), entryMode: 'manual' };
}

function sortScores(players: readonly ScorecardPlayer[]) {
  const order = new Map(players.map((player, index) => [player.id, index]));
  return (left: ScorecardHoleScore, right: ScorecardHoleScore) => (order.get(left.playerId) ?? 99) - (order.get(right.playerId) ?? 99);
}

function sortPenalties(players: readonly ScorecardPlayer[]) {
  const order = new Map(players.map((player, index) => [player.id, index]));
  return (left: HolePenaltyMark, right: HolePenaltyMark) => (order.get(left.playerId) ?? 99) - (order.get(right.playerId) ?? 99);
}

function penaltyLabel(penalty: HolePenaltyMark): string {
  return [penalty.ob ? 'OB' : '', penalty.hazard ? '해저드' : ''].filter(Boolean).join('·');
}

function normalizePenalties(value: unknown, playerIds: readonly string[]): readonly HolePenaltyMark[] | null {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }

  const penalties = value.map((entry): HolePenaltyMark | null => {
    if (!isRecord(entry) || typeof entry.playerId !== 'string' || !playerIds.includes(entry.playerId)) {
      return null;
    }
    const ob = entry.ob === true;
    const hazard = entry.hazard === true;
    return ob || hazard ? { playerId: entry.playerId, ob, hazard } : null;
  }).filter((entry): entry is HolePenaltyMark => entry !== null);

  return new Set(penalties.map((penalty) => penalty.playerId)).size === penalties.length ? penalties : null;
}

function normalizeHoleCount(value: unknown): number {
  return clampInteger(typeof value === 'number' ? value : defaultScorecardHoleCount, 1, 18);
}

function normalizePlayerCount(value: unknown): 1 | 2 | 3 | 4 {
  return clampInteger(typeof value === 'number' ? value : 1, 1, 4) as 1 | 2 | 3 | 4;
}

function normalizeHolePar(value: unknown): number {
  return clampInteger(typeof value === 'number' ? value : 4, 3, 5);
}

function uniquePlayerId(candidate: string, usedIds: ReadonlySet<string>, defaultIndex: number): string {
  const trimmed = candidate.trim();
  if (trimmed && !usedIds.has(trimmed)) {
    return trimmed;
  }

  let suffix = defaultIndex;
  let generatedId = `player-${suffix}`;
  while (usedIds.has(generatedId)) {
    suffix += 1;
    generatedId = `player-${suffix}`;
  }
  return generatedId;
}

function hasUniquePlayerIds(players: readonly ScorecardPlayer[]): boolean {
  return new Set(players.map((player) => player.id)).size === players.length;
}

function hasUniqueScorePlayerIds(scores: readonly ScorecardHoleScore[]): boolean {
  return new Set(scores.map((score) => score.playerId)).size === scores.length;
}

function stampRound(round: ScorecardRound, now: string): ScorecardRound {
  return { ...round, updatedAt: now };
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampInteger(value: number, min: number, max: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, integer));
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIsoString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
