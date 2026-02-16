/**
 * elo.ts — ELO Rating & Tier System
 * ===================================
 * Chess-style ELO calculation + automatic tier promotion.
 */

// ─── Tier Definitions ───

export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Legend';

export const TIER_THRESHOLDS: Record<Tier, [number, number]> = {
  Bronze:  [0, 1099],
  Silver:  [1100, 1299],
  Gold:    [1300, 1499],
  Diamond: [1500, 1799],
  Legend:  [1800, Infinity],
};

export const INITIAL_ELO = 1000;
const DEFAULT_K = 32;

// ─── ELO Calculation ───

export interface EloResult {
  winnerElo: number;
  loserElo: number;
  winnerDelta: number;
  loserDelta: number;
}

export function calculateElo(
  winnerElo: number,
  loserElo: number,
  K: number = DEFAULT_K,
): EloResult {
  const expectedWin = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  const expectedLose = 1 - expectedWin;

  const winnerDelta = Math.round(K * (1 - expectedWin));
  const loserDelta = Math.round(K * (0 - expectedLose));

  return {
    winnerElo: winnerElo + winnerDelta,
    loserElo: loserElo + loserDelta,
    winnerDelta,
    loserDelta,
  };
}

// ─── Tier Resolution ───

export function getTierFromElo(elo: number): Tier {
  for (const [tier, [min, max]] of Object.entries(TIER_THRESHOLDS)) {
    if (elo >= min && elo <= max) {
      return tier as Tier;
    }
  }
  return 'Bronze';
}

export function canIPO(tier: Tier): boolean {
  return tier === 'Diamond' || tier === 'Legend';
}

// ─── Tier Display ───

const TIER_EMOJIS: Record<Tier, string> = {
  Bronze:  '🥉',
  Silver:  '🥈',
  Gold:    '🥇',
  Diamond: '💎',
  Legend:  '👑',
};

export function getTierEmoji(tier: Tier): string {
  return TIER_EMOJIS[tier] ?? '🥉';
}
