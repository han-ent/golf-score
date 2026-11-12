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
  /** Penalty strokes already folded into `strokes`. Missing on legacy manual scores. */
  readonly includedPenaltyStrokes?: number;
};

export type HolePenaltyMark = {
  readonly playerId: string;
  readonly ob: number;
  readonly hazard: number;
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
  readonly badge: string;
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
  readonly strokesPerHole: number | null;
  readonly puttsPerGir: number | null;
  readonly birdieOrBetterRate: number | null;
  readonly bogeyAvoidance: number | null;
  readonly bounceBackRate: number | null;
  readonly par3Average: number | null;
  readonly par4Average: number | null;
  readonly par5Average: number | null;
  readonly obCount: number;
  readonly hazardCount: number;
  readonly onePuttRate: number | null;
  readonly threePuttRate: number | null;
  readonly frontHoles: number;
  readonly backHoles: number;
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

export type RoundEditorInput = {
  readonly roundName: string;
  readonly courseName: string;
  readonly holeCount: number;
  readonly playerCount: number;
  readonly names: readonly string[];
};

export function applyRoundEditorMutation(round: ScorecardRound, input: RoundEditorInput, now = new Date().toISOString()): ScorecardRound {
  let next = applyRoundLabelMutation(round, { roundName: input.roundName, courseName: input.courseName }, now);
  next = applyRoundSetupMutation(next, { holeCount: input.holeCount }, now);
  next = applyPlayerCountMutation(next, input.playerCount, now);
  for (const [index, player] of next.players.entries()) {
    next = applyPlayerMutation(next, player.id, { name: input.names[index] ?? '' }, now);
  }
  return next;
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
  const holes = ensureHoles(round.holes, round.settings.holeCount, round.players).map((hole) => {
    if (hole.holeNumber !== targetHoleNumber) {
      return hole;
    }
    return { ...hole, memo, penalties: penaltiesFromMemo(memo, round.players, hole.penalties) };
  });

  return stampRound({ ...round, holes }, now);
}

export function applyHolePenaltyMutation(
  round: ScorecardRound,
  holeNumber: number,
  playerId: string,
  kind: 'ob' | 'hazard',
  delta = 1,
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

    const current = hole.penalties.find((penalty) => penalty.playerId === playerId) ?? { playerId, ob: 0, hazard: 0 };
    const next = { ...current, [kind]: clampInteger(current[kind] + delta, 0, 20) };
    const kept = hole.penalties.filter((penalty) => penalty.playerId !== playerId);
    const penalties = next.ob || next.hazard ? [...kept, next].sort(sortPenalties(round.players)) : kept;
    return { ...hole, penalties, memo: memoWithPenaltyCounts(hole.memo, round.players, penalties), scores: hole.scores.map(stripAddedPenalty) };
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

    const nextScore = stripAddedPenalty(normalizeScoreInput(playerId, score));
    return { ...hole, scores: [...withoutPlayer, nextScore].sort(sortScores(round.players)) };
  });

  return stampRound({ ...round, holes }, now);
}

export type ScorecardHoleScoreInput =
  | { readonly strokes: number; readonly entryMode?: 'manual' }
  | { readonly strokes: number; readonly entryMode: 'on-putt'; readonly onGreenShots: number; readonly putts: number; readonly puttsAssumed?: boolean }
  | { readonly strokes: 1; readonly entryMode: 'hio'; readonly onGreenShots: 1; readonly putts: 0; readonly holeInOne: true };

export function penaltyBadgeText(mark: Pick<HolePenaltyMark, 'ob' | 'hazard'> | undefined): string {
  return penaltyParts(mark).map((part) => `${part.label} ${part.count}회`).join(' · ');
}

export type HoleScoreBreakdown = {
  readonly strokes: number | null;
  readonly relativeLabel: string;
  readonly badges: readonly string[];
  readonly summary: string;
};

export function describeHoleScore(par: number, score: ScorecardHoleScore | undefined, penalty: HolePenaltyMark | undefined): HoleScoreBreakdown {
  const badges = penaltyParts(penalty).map((part) => `${part.label} ${part.count}회`);
  if (!score) {
    return { strokes: null, relativeLabel: '—', badges, summary: badges.join(' · ') };
  }

  const strokes = playingStrokes(score);
  const relative = strokes - par;
  const relativeLabel = relativeScoreLabel(relative);
  const call = scoreCall(relative);
  const marks = badges.join(' · ');
  if (score.entryMode === 'manual') {
    return { strokes, relativeLabel, badges, summary: [`직접 ${strokes}타`, call, marks].filter(Boolean).join(' · ') };
  }

  const onGreenShots = score.onGreenShots ?? 0;
  const putts = score.putts ?? 0;
  return {
    strokes,
    relativeLabel,
    badges,
    summary: [`${onGreenShots}온 + ${putts}펏 = ${strokes}타`, call, marks].filter(Boolean).join(' · '),
  };
}

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
    cells: normalizedRound.players.map((player) => {
      const score = scoreForPlayer(normalizedRound, hole.holeNumber, player.id);
      const penalty = hole.penalties.find((mark) => mark.playerId === player.id);
      return cellViewForScore(player.id, hole.holeNumber, hole.par, score, penalty);
    }),
  }));

  return {
    roundId: normalizedRound.id,
    players: normalizedRound.players,
    holes,
    reviews: normalizedRound.players.map((player) => buildPlayerReview(normalizedRound, player)),
    memoHighlights: normalizedRound.holes.flatMap((hole) => {
      const memo = userTypedHoleMemo(hole.memo);
      return memo ? [{ holeNumber: hole.holeNumber, memo }] : [];
    }),
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
  let frontHoles = 0;
  let backHoles = 0;
  let girPutts = 0;
  let girPuttHoles = 0;
  let birdieOrBetter = 0;
  let parOrBetter = 0;
  let obCount = 0;
  let hazardCount = 0;
  let par3Strokes = 0;
  let par3Holes = 0;
  let par4Strokes = 0;
  let par4Holes = 0;
  let par5Strokes = 0;
  let par5Holes = 0;
  const lostStrokeHoles: ScorecardLostStroke[] = [];
  const holeResults: { holeNumber: number; relative: number }[] = [];

  for (const hole of round.holes) {
    const penalty = hole.penalties.find((mark) => mark.playerId === player.id && (mark.ob > 0 || mark.hazard > 0));
    if (penalty) {
      obCount += penalty.ob;
      hazardCount += penalty.hazard;
      lostStrokeHoles.push({ holeNumber: hole.holeNumber, label: penaltyBadgeText(penalty) });
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
      frontHoles += 1;
    } else {
      backRelative += relative;
      backHoles += 1;
    }
    counts[scoreTypeKey(relative)] += 1;
    if (relative <= -1) {
      birdieOrBetter += 1;
    }
    if (relative <= 0) {
      parOrBetter += 1;
    }
    holeResults.push({ holeNumber: hole.holeNumber, relative });
    if (hole.par === 3) {
      par3Strokes += score.strokes;
      par3Holes += 1;
    } else if (hole.par === 4) {
      par4Strokes += score.strokes;
      par4Holes += 1;
    } else {
      par5Strokes += score.strokes;
      par5Holes += 1;
    }

    if (score.entryMode === 'on-putt' || score.entryMode === 'hio') {
      if (typeof score.onGreenShots === 'number') {
        onGreenTotal += score.onGreenShots;
        onGreenCount += 1;
        girOpportunities += 1;
        const reachedGreen = score.onGreenShots <= hole.par - 2;
        if (reachedGreen) {
          girHits += 1;
        } else {
          parSaveOpportunities += 1;
          if (relative <= 0) {
            parSaves += 1;
          }
        }
        if (reachedGreen && typeof score.putts === 'number') {
          girPutts += score.putts;
          girPuttHoles += 1;
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

  const resultsByHole = new Map(holeResults.map((result) => [result.holeNumber, result.relative]));
  let bounceBackChances = 0;
  let bounceBackMade = 0;
  for (const result of holeResults) {
    if (result.relative < 1) {
      continue;
    }
    const nextRelative = resultsByHole.get(result.holeNumber + 1);
    if (nextRelative === undefined) {
      continue;
    }
    bounceBackChances += 1;
    if (nextRelative <= -1) {
      bounceBackMade += 1;
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
    strokesPerHole: completedHoles > 0 ? roundToOneDecimal(totalStrokes / completedHoles) : null,
    puttsPerGir: girPuttHoles > 0 ? roundToOneDecimal(girPutts / girPuttHoles) : null,
    birdieOrBetterRate: completedHoles > 0 ? roundToOneDecimal((birdieOrBetter / completedHoles) * 100) : null,
    bogeyAvoidance: completedHoles > 0 ? roundToOneDecimal((parOrBetter / completedHoles) * 100) : null,
    bounceBackRate: bounceBackChances > 0 ? roundToOneDecimal((bounceBackMade / bounceBackChances) * 100) : null,
    par3Average: par3Holes > 0 ? roundToOneDecimal(par3Strokes / par3Holes) : null,
    par4Average: par4Holes > 0 ? roundToOneDecimal(par4Strokes / par4Holes) : null,
    par5Average: par5Holes > 0 ? roundToOneDecimal(par5Strokes / par5Holes) : null,
    obCount,
    hazardCount,
    onePuttRate: puttCount > 0 ? roundToOneDecimal((onePuttCount / puttCount) * 100) : null,
    threePuttRate: puttCount > 0 ? roundToOneDecimal((threePuttCount / puttCount) * 100) : null,
    frontHoles,
    backHoles,
  };
}

type MutableScoreTypeCounts = { -readonly [K in keyof ScoreTypeCounts]: number };

function cellViewForScore(
  playerId: string,
  holeNumber: number,
  par: number,
  score: ScorecardHoleScore | undefined,
  penalty: HolePenaltyMark | undefined,
): ScorecardCellView {
  const badge = penaltyBadgeText(penalty);
  if (!score) {
    return { playerId, holeNumber, main: '—', sub: '', badge };
  }

  const relative = score.strokes - par;
  return {
    playerId,
    holeNumber,
    main: relativeScoreLabel(relative),
    sub: score.entryMode === 'manual' ? '' : `온 ${score.onGreenShots ?? 0} · 펏 ${score.putts ?? 0}`,
    badge,
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
      penalties: (stored.penalties ?? []).filter((penalty) => activePlayerIds.has(penalty.playerId)).map((penalty) => coercePenalty(penalty)).filter((penalty) => penalty.ob > 0 || penalty.hazard > 0),
      scores: stored.scores.filter((score) => activePlayerIds.has(score.playerId)).map((score) => stripAddedPenalty(normalizeStoredScore(score))),
      memo: memoWithPenaltyCounts(stored.memo, players, (stored.penalties ?? []).filter((penalty) => activePlayerIds.has(penalty.playerId)).map((penalty) => coercePenalty(penalty))),
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

  const includedPenaltyStrokes = readIncludedPenalty(value);

  if (entryMode === 'hio') {
    return { playerId, strokes: 1, entryMode: 'hio', onGreenShots: 1, putts: 0, holeInOne: true, ...(includedPenaltyStrokes === undefined ? {} : { includedPenaltyStrokes }) };
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
      ...(includedPenaltyStrokes === undefined ? {} : { includedPenaltyStrokes }),
    };
  }

  return { playerId, strokes, entryMode: 'manual', ...(includedPenaltyStrokes === undefined ? {} : { includedPenaltyStrokes }) };
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

function penaltyParts(mark: Pick<HolePenaltyMark, 'ob' | 'hazard'> | undefined): readonly { readonly label: string; readonly count: number }[] {
  if (!mark) {
    return [];
  }
  return [
    mark.ob > 0 ? { label: 'OB', count: mark.ob } : null,
    mark.hazard > 0 ? { label: '해저드', count: mark.hazard } : null,
  ].filter((part): part is { readonly label: string; readonly count: number } => part !== null);
}

function playingStrokes(score: ScorecardHoleScore): number {
  if ((score.entryMode === 'on-putt' || score.entryMode === 'hio') && typeof score.onGreenShots === 'number' && typeof score.putts === 'number') {
    return clampInteger(score.onGreenShots + score.putts, 1, maximumScorecardStrokes);
  }
  const already = typeof score.includedPenaltyStrokes === 'number' ? score.includedPenaltyStrokes : 0;
  return clampInteger(score.strokes - already, 1, maximumScorecardStrokes);
}

function stripAddedPenalty(score: ScorecardHoleScore): ScorecardHoleScore {
  return { ...score, strokes: playingStrokes(score), includedPenaltyStrokes: 0 };
}

function scoreCall(relative: number): string {
  if (relative <= -2) return `이글 ${relativeScoreLabel(relative)}`;
  if (relative === -1) return '버디 -1';
  if (relative === 0) return '파';
  if (relative === 1) return '보기 +1';
  if (relative === 2) return '더블 +2';
  return relativeScoreLabel(relative);
}

function coerceCount(value: unknown): number {
  if (value === true) return 1;
  if (typeof value === 'number' && Number.isFinite(value)) return clampInteger(value, 0, 20);
  return 0;
}

function coercePenalty(mark: { playerId: string; ob: unknown; hazard: unknown }): HolePenaltyMark {
  return { playerId: mark.playerId, ob: coerceCount(mark.ob), hazard: coerceCount(mark.hazard) };
}

const penaltyLinePattern = /^(?:(.+?)\s+)?(OB|해저드)\s+(\d+)회\s*$/;

export function userTypedHoleMemo(memo: string): string {
  return memo.split('\n').map((line) => line.trim()).filter((line) => line && !penaltyLinePattern.test(line)).join('\n');
}

function memoWithPenaltyCounts(memo: string, players: readonly ScorecardPlayer[], penalties: readonly HolePenaltyMark[]): string {
  const freeText = userTypedHoleMemo(memo);
  const multiple = players.length > 1;
  const managed = players.flatMap((player, index) => {
    const mark = penalties.find((penalty) => penalty.playerId === player.id);
    if (!mark || (mark.ob <= 0 && mark.hazard <= 0)) return [];
    const prefix = multiple ? `${player.name.trim() || `${index + 1}번`} ` : '';
    return [
      mark.ob > 0 ? `${prefix}OB ${mark.ob}회` : '',
      mark.hazard > 0 ? `${prefix}해저드 ${mark.hazard}회` : '',
    ].filter(Boolean);
  });
  return [...managed, freeText].filter(Boolean).join('\n');
}

function penaltiesFromMemo(memo: string, players: readonly ScorecardPlayer[], existing: readonly HolePenaltyMark[]): readonly HolePenaltyMark[] {
  const counts = new Map(players.map((player) => [player.id, { ob: 0, hazard: 0 }]));
  let sawLine = false;
  for (const line of memo.split('\n')) {
    const match = penaltyLinePattern.exec(line.trim());
    if (!match) continue;
    sawLine = true;
    const named = match[1]?.trim();
    const kind = match[2] === 'OB' ? 'ob' : 'hazard';
    const count = clampInteger(Number(match[3]), 0, 20);
    const player = named
      ? players.find((candidate, index) => (candidate.name.trim() || `${index + 1}번`) === named)
      : players.length === 1 ? players[0] : undefined;
    const target = player ? counts.get(player.id) : undefined;
    if (target) target[kind] = count;
  }
  if (!sawLine) return existing;
  return players.flatMap((player) => {
    const count = counts.get(player.id) ?? { ob: 0, hazard: 0 };
    return count.ob > 0 || count.hazard > 0 ? [{ playerId: player.id, ob: count.ob, hazard: count.hazard }] : [];
  });
}

function readIncludedPenalty(value: Record<string, unknown>): number | undefined {
  if (typeof value.includedPenaltyStrokes !== 'number' || !Number.isFinite(value.includedPenaltyStrokes)) {
    return undefined;
  }
  return clampInteger(value.includedPenaltyStrokes, 0, 20);
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
    const mark = coercePenalty({ playerId: entry.playerId, ob: entry.ob, hazard: entry.hazard });
    return mark.ob > 0 || mark.hazard > 0 ? mark : null;
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
