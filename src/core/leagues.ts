export const LEAGUE_MAX_TIER = {
  bronze: 2,
  silver: 4,
  gold: 6,
  champion: 8,
  legend: 10,
} as const;

export type League = keyof typeof LEAGUE_MAX_TIER;
