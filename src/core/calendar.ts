/**
 * Kalendarz (#291, docs/SCENARIUSZ.md 5.8): dzień mija przy walce, odpoczynku, lochu i podróży; sklepy nie
 * zabierają czasu. Brak globalnego limitu dni.
 */
export type TimedActivity = 'fight' | 'rest' | 'dungeon' | 'travel';

/** Ile dni może zabrać dana czynność; bez podanej liczby mija najmniej. */
export const ACTIVITY_DAYS: Readonly<Record<TimedActivity, { readonly min: number; readonly max: number }>> = {
  fight: { min: 1, max: 1 },
  rest: { min: 1, max: 1 },
  dungeon: { min: 1, max: 2 },
  travel: { min: 2, max: 3 },
};

export const FIRST_DAY = 1;

export function dayAfter(day: number, activity: TimedActivity, days: number = ACTIVITY_DAYS[activity].min): number {
  const { min, max } = ACTIVITY_DAYS[activity];
  if (!Number.isSafeInteger(day) || day < FIRST_DAY) throw new RangeError('Day must be a positive safe integer.');
  if (!Number.isInteger(days) || days < min || days > max) {
    throw new RangeError(`A ${activity} takes ${min} to ${max} days.`);
  }
  return Math.min(Number.MAX_SAFE_INTEGER, day + days);
}
