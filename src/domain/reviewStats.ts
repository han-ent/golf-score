import { relativeScoreLabel, type ScorecardPlayerReview } from './scorecard';

export type ReviewStatUnit = 'strokes' | 'decimal' | 'relative' | 'percent' | 'count';

export type ReviewStat = {
  readonly id: string;
  readonly label: string;
  readonly display: string;
  readonly formula: string;
  readonly explanation: string;
  readonly numeric: number | null;
  readonly unit: ReviewStatUnit;
};

type StatDefinition = {
  readonly id: string;
  readonly label: string;
  readonly unit: ReviewStatUnit;
  readonly formula: string;
  readonly explanation: string;
};

const statDefinitions: readonly StatDefinition[] = [
  {
    id: 'totalStrokes',
    label: '총타',
    unit: 'strokes',
    formula: '완료 홀의 타수 합',
    explanation: '온, 퍼트, 벌타를 더한 타수입니다. OB는 +2, 해저드는 +1입니다.',
  },
  {
    id: 'strokesPerHole',
    label: '홀당 타수',
    unit: 'decimal',
    formula: '총타 ÷ 완료 홀',
    explanation: '홀 수가 다른 라운드와 비교할 때 쓰는 평균 타수입니다.',
  },
  {
    id: 'frontRelative',
    label: '전반',
    unit: 'relative',
    formula: '1–9번 홀의 (타수 − 파) 합',
    explanation: '전반에서 기록한 홀만 더합니다. 벌타가 포함된 타수입니다.',
  },
  {
    id: 'backRelative',
    label: '후반',
    unit: 'relative',
    formula: '10–18번 홀의 (타수 − 파) 합',
    explanation: '후반에서 기록한 홀만 더합니다.',
  },
  {
    id: 'averageOnGreenShots',
    label: '온 평균',
    unit: 'decimal',
    formula: '온 합 ÷ 온을 기록한 홀',
    explanation: '그린에 올라가기까지 친 샷의 평균입니다. 직접 타수만 있는 홀은 빠집니다.',
  },
  {
    id: 'averagePutts',
    label: '홀당 퍼트',
    unit: 'decimal',
    formula: '퍼트 합 ÷ 퍼트를 기록한 홀',
    explanation: '홀당 퍼트입니다. 온만 누르면 기본 2퍼트가 포함됩니다.',
  },
  {
    id: 'puttsPerGir',
    label: '파온 퍼트',
    unit: 'decimal',
    formula: '파온 홀의 퍼트 합 ÷ 파온 홀',
    explanation: '규정 타수에 그린에 올라간 홀에서만 평균 퍼트를 냅니다.',
  },
  {
    id: 'girRate',
    label: '파온율',
    unit: 'percent',
    formula: '파온 홀 ÷ 온을 기록한 홀 × 100',
    explanation: '정규 타수 안에 그린에 올렸는지입니다. 파3은 1온, 파4는 2온, 파5는 3온 이하입니다. 샷으로 그린까지 가는 능력이고, 퍼트와 벌타는 넣지 않습니다. 파온을 놓친 뒤 파로 막는 것은 스크램블링(파세이브)입니다.',
  },
  {
    id: 'scrambling',
    label: '스크램블링(파세이브)',
    unit: 'percent',
    formula: '파온 실패 후 파 이하 ÷ 파온 실패 홀 × 100',
    explanation: '파온을 놓친 홀에서 파 이하로 막아낸 비율입니다. 파온 실패 홀만 대상입니다. 그린을 놓친 뒤 숏게임으로 살려내는 능력입니다. 예: 파4 3온 1펏 파 → 파온 실패, 스크램블링 성공.',
  },
  {
    id: 'birdieOrBetterRate',
    label: '버디 이상',
    unit: 'percent',
    formula: '(버디 + 이글 이하) ÷ 완료 홀 × 100',
    explanation: '파보다 한 타 이상 적게 친 홀의 비율입니다.',
  },
  {
    id: 'bogeyAvoidance',
    label: '보기 회피',
    unit: 'percent',
    formula: '파 이하 홀 ÷ 완료 홀 × 100',
    explanation: '보기 이상을 만들지 않은 홀의 비율입니다.',
  },
  {
    id: 'bounceBackRate',
    label: '바운스백',
    unit: 'percent',
    formula: '보기 이상 다음 홀의 버디 이상 ÷ 그 다음 홀 × 100',
    explanation: '보기 이상을 친 바로 다음 홀에서 버디 이상을 한 비율입니다. 다음 홀 기록이 없으면 기회에서 빠집니다.',
  },
  {
    id: 'par3Average',
    label: '파3 평균',
    unit: 'decimal',
    formula: '파3 홀 타수 합 ÷ 파3 기록 홀',
    explanation: '파3에서 친 평균 타수입니다. 벌타가 포함됩니다.',
  },
  {
    id: 'par4Average',
    label: '파4 평균',
    unit: 'decimal',
    formula: '파4 홀 타수 합 ÷ 파4 기록 홀',
    explanation: '파4에서 친 평균 타수입니다. 벌타가 포함됩니다.',
  },
  {
    id: 'par5Average',
    label: '파5 평균',
    unit: 'decimal',
    formula: '파5 홀 타수 합 ÷ 파5 기록 홀',
    explanation: '파5에서 친 평균 타수입니다. 벌타가 포함됩니다.',
  },
  {
    id: 'onePutt',
    label: '1퍼트',
    unit: 'percent',
    formula: '1퍼트 홀 ÷ 퍼트를 기록한 홀 × 100',
    explanation: '퍼트를 기록한 홀 가운데 한 번에 홀아웃한 비율입니다. 횟수도 함께 보여 줍니다.',
  },
  {
    id: 'threePutt',
    label: '3퍼트',
    unit: 'percent',
    formula: '3퍼트 이상 홀 ÷ 퍼트를 기록한 홀 × 100',
    explanation: '퍼트를 기록한 홀 가운데 세 번 이상 퍼트한 비율입니다.',
  },
  {
    id: 'obCount',
    label: 'OB 횟수',
    unit: 'count',
    formula: '표시한 OB 횟수의 합',
    explanation: '타수에 더하지 않습니다. 온 타수에 이미 포함된 벌타를 홀 메모로 센 횟수입니다.',
  },
  {
    id: 'hazardCount',
    label: '해저드 횟수',
    unit: 'count',
    formula: '표시한 해저드 횟수의 합',
    explanation: '타수에 더하지 않습니다. 온 타수에 이미 포함된 벌타를 홀 메모로 센 횟수입니다.',
  },
];

const definitionById = new Map(statDefinitions.map((definition) => [definition.id, definition]));

export function reviewStatDefinition(id: string): StatDefinition | undefined {
  return definitionById.get(id);
}

export function reviewStatIds(): readonly string[] {
  return statDefinitions.map((definition) => definition.id);
}

export function reviewStatsFor(review: ScorecardPlayerReview): readonly ReviewStat[] {
  const scored = review.completedHoles > 0;
  return statDefinitions.map((definition) => {
    const numeric = numericFor(review, definition.id);
    return {
      ...definition,
      numeric,
      display: displayFor(review, definition.id, definition.unit, numeric, scored),
    };
  });
}

export function formatStatValue(value: number, unit: ReviewStatUnit): string {
  const rounded = roundToOneDecimal(value);
  if (unit === 'percent') {
    return `${rounded}%`;
  }
  if (unit === 'relative') {
    return relativeScoreLabel(rounded);
  }
  return `${rounded}`;
}

export function formatStatDelta(delta: number, unit: ReviewStatUnit): string {
  const rounded = roundToOneDecimal(delta);
  if (rounded === 0) {
    return unit === 'percent' ? '0%p' : '0';
  }
  const sign = rounded > 0 ? '+' : '';
  return unit === 'percent' ? `${sign}${rounded}%p` : `${sign}${rounded}`;
}

function displayFor(review: ScorecardPlayerReview, id: string, unit: ReviewStatUnit, numeric: number | null, scored: boolean): string {
  if (!scored || numeric === null) {
    return '—';
  }
  if (id === 'onePutt') {
    return `${review.onePuttCount}회 · ${formatStatValue(numeric, 'percent')}`;
  }
  if (id === 'threePutt') {
    return `${review.threePuttCount}회 · ${formatStatValue(numeric, 'percent')}`;
  }
  if (id === 'obCount' || id === 'hazardCount') {
    return `${numeric}회`;
  }
  if (id === 'totalStrokes') {
    return `${numeric}타`;
  }
  return formatStatValue(numeric, unit);
}

function numericFor(review: ScorecardPlayerReview, id: string): number | null {
  switch (id) {
    case 'totalStrokes':
      return review.completedHoles > 0 ? review.totalStrokes : null;
    case 'strokesPerHole':
      return review.strokesPerHole;
    case 'frontRelative':
      return review.frontHoles > 0 ? review.frontRelative : null;
    case 'backRelative':
      return review.backHoles > 0 ? review.backRelative : null;
    case 'averageOnGreenShots':
      return review.averageOnGreenShots;
    case 'averagePutts':
      return review.averagePutts;
    case 'puttsPerGir':
      return review.puttsPerGir;
    case 'girRate':
      return review.girRate;
    case 'scrambling':
      return review.parSaveRate;
    case 'birdieOrBetterRate':
      return review.birdieOrBetterRate;
    case 'bogeyAvoidance':
      return review.bogeyAvoidance;
    case 'bounceBackRate':
      return review.bounceBackRate;
    case 'par3Average':
      return review.par3Average;
    case 'par4Average':
      return review.par4Average;
    case 'par5Average':
      return review.par5Average;
    case 'onePutt':
      return review.onePuttRate;
    case 'threePutt':
      return review.threePuttRate;
    case 'obCount':
      return review.completedHoles > 0 ? review.obCount : null;
    case 'hazardCount':
      return review.completedHoles > 0 ? review.hazardCount : null;
    default:
      return null;
  }
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
