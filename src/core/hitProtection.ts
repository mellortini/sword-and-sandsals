export const MAX_PROTECTED_MISSES = 3;
const GUARANTEE_THRESHOLD = 35;

function schedule(base: number, first: number): number[] {
  const step = base >= GUARANTEE_THRESHOLD ? 10 : Math.min(10, Math.floor(base / 4), base - 5);
  return [
    Math.max(5, first),
    Math.max(5, Math.min(95, first + step)),
    Math.max(5, Math.min(95, first + 2 * step)),
    base >= GUARANTEE_THRESHOLD ? 100 : Math.max(5, Math.min(95, first + 3 * step)),
  ];
}

function rate([first, second, third, tail]: number[]): number {
  const miss = 1 - first / 100;
  const missTwice = miss * (1 - second / 100);
  // One attempt, then conditional attempts after each miss. The last probability repeats.
  return 100 / (1 + miss + missTwice + missTwice * (1 - third / 100) * 100 / tail);
}

const SCHEDULES = Array.from({ length: 91 }, (_, index) => {
  const base = index + 5;
  let low = 0;
  let high = base;
  while (high - low > 1) {
    const candidate = Math.floor((low + high) / 2);
    if (rate(schedule(base, candidate)) < base) low = candidate;
    else high = candidate;
  }
  const lowSchedule = schedule(base, low);
  const highSchedule = schedule(base, high);
  return Math.abs(rate(lowSchedule) - base) < Math.abs(rate(highSchedule) - base) ? lowSchedule : highSchedule;
});

export function protectedHitChance(base: number, consecutiveMisses: number): number {
  return SCHEDULES[base - 5][Math.min(consecutiveMisses, MAX_PROTECTED_MISSES)];
}
