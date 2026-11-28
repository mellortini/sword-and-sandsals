export type StatusKind = 'torn' | 'stunned' | 'burning' | 'soaked' | 'feared' | 'taped' | 'slowed' | 'netted';

export interface StatusTick {
  kind: StatusKind;
  healthDelta: number;
  turnsRemaining: number;
  skipped: boolean;
}

export interface StatusEffect {
  readonly kind: StatusKind;
  readonly turns: number;
  readonly stacks: number;
}

/** Resistance is the percentage of duration removed, rounded to a whole turn. */
export type StatusResistances = Readonly<Partial<Record<StatusKind, number>>>;

const RULES: Readonly<Record<StatusKind, { turns: number; maxStacks: number }>> = {
  torn: { turns: 3, maxStacks: 3 },
  stunned: { turns: 1, maxStacks: 1 },
  burning: { turns: 3, maxStacks: 3 },
  soaked: { turns: 2, maxStacks: 2 },
  feared: { turns: 2, maxStacks: 2 },
  taped: { turns: 3, maxStacks: 3 },
  slowed: { turns: 2, maxStacks: 1 },
  // #258: caught in a thrown net, the fighter spends the next turn getting out of it
  netted: { turns: 1, maxStacks: 1 },
};

export function applyStatus(
  statuses: readonly StatusEffect[], kind: StatusKind, resistances: StatusResistances = {},
): readonly StatusEffect[] {
  const rule = RULES[kind];
  const configuredResistance = resistances[kind] ?? 0;
  const resistance = Number.isFinite(configuredResistance) ? configuredResistance : 0;
  const turns = Math.round(rule.turns * (1 - Math.min(100, Math.max(0, resistance)) / 100));
  if (turns <= 0) return statuses;

  const existing = statuses.find((effect) => effect.kind === kind);
  const effect: StatusEffect = {
    kind, turns: Math.max(turns, existing?.turns ?? 0), stacks: Math.min(rule.maxStacks, (existing?.stacks ?? 0) + 1),
  };
  return existing ? statuses.map((entry) => entry === existing ? effect : entry) : [...statuses, effect];
}

export function advanceStatusDurations(statuses: readonly StatusEffect[]): readonly StatusEffect[] {
  return statuses.map((effect) => ({ ...effect, turns: effect.turns - 1 }));
}

export function statusModifiers(statuses: readonly StatusEffect[]): {
  armourMultiplier: number; movementMultiplier: number; accuracyPenalty: number;
} {
  const soaked = statuses.find((effect) => effect.kind === 'soaked')?.stacks ?? 0;
  const feared = statuses.find((effect) => effect.kind === 'feared')?.stacks ?? 0;
  const slowed = statuses.some((effect) => effect.kind === 'slowed');
  return {
    armourMultiplier: 1 - 0.2 * soaked,
    movementMultiplier: (1 - 0.2 * soaked) * (slowed ? 0.75 : 1),
    accuracyPenalty: 10 * feared,
  };
}

/** Damage ticks precede healing; tape cannot revive a fallen fighter. */
export function tickStatuses(statuses: readonly StatusEffect[], health: number, maxHealth: number): {
  health: number; skip: boolean; ticks: StatusTick[];
} {
  const soaked = statuses.some((effect) => effect.kind === 'soaked');
  const ticks: StatusTick[] = [];
  let skip = false;
  for (const kind of ['torn', 'burning', 'taped', 'stunned', 'netted', 'soaked', 'feared', 'slowed'] as const) {
    const effect = statuses.find((entry) => entry.kind === kind);
    if (!effect || health === 0) continue;
    let delta = 0;
    if (kind === 'torn') delta = -2 * effect.stacks;
    if (kind === 'burning') delta = -(soaked ? 2 : 4) * effect.stacks;
    if (kind === 'taped') delta = 3 * effect.stacks;
    const nextHealth = Math.max(0, Math.min(maxHealth, health + delta));
    const skipped = kind === 'stunned' || kind === 'netted';
    ticks.push({ kind, healthDelta: nextHealth - health, turnsRemaining: effect.turns - 1, skipped });
    health = nextHealth;
    skip ||= skipped;
  }
  return { health, skip, ticks };
}
