/**
 * elo.test.ts — ELO Rating System Tests
 */

import { describe, it, expect } from 'vitest';
import { calculateElo, getTierFromElo, canIPO } from './elo.js';

describe('calculateElo', () => {
  it('should increase winner ELO and decrease loser ELO', () => {
    const result = calculateElo(1000, 1000);
    expect(result.winnerElo).toBeGreaterThan(1000);
    expect(result.loserElo).toBeLessThan(1000);
    expect(result.winnerDelta).toBeGreaterThan(0);
    expect(result.loserDelta).toBeLessThan(0);
  });

  it('should give equal change for equal ELOs', () => {
    const result = calculateElo(1000, 1000);
    // Expected win = 0.5, so delta = 32 * (1 - 0.5) = 16
    expect(result.winnerDelta).toBe(16);
    expect(result.loserDelta).toBe(-16);
  });

  it('should give smaller change when higher ELO wins', () => {
    const resultHighWins = calculateElo(1400, 1000);
    const resultEqualWins = calculateElo(1000, 1000);
    expect(resultHighWins.winnerDelta).toBeLessThan(resultEqualWins.winnerDelta);
  });

  it('should give larger change for upset wins', () => {
    const resultUpset = calculateElo(800, 1200);
    const resultExpected = calculateElo(1200, 800);
    expect(resultUpset.winnerDelta).toBeGreaterThan(resultExpected.winnerDelta);
  });

  it('should always produce integers', () => {
    const result = calculateElo(1234, 1567);
    expect(Number.isInteger(result.winnerElo)).toBe(true);
    expect(Number.isInteger(result.loserElo)).toBe(true);
  });
});

describe('getTierFromElo', () => {
  it('should return Bronze for low ELO', () => {
    expect(getTierFromElo(500)).toBe('Bronze');
    expect(getTierFromElo(1000)).toBe('Bronze');
    expect(getTierFromElo(1099)).toBe('Bronze');
  });

  it('should return Silver for 1100-1299', () => {
    expect(getTierFromElo(1100)).toBe('Silver');
    expect(getTierFromElo(1200)).toBe('Silver');
    expect(getTierFromElo(1299)).toBe('Silver');
  });

  it('should return Gold for 1300-1499', () => {
    expect(getTierFromElo(1300)).toBe('Gold');
    expect(getTierFromElo(1499)).toBe('Gold');
  });

  it('should return Diamond for 1500-1799', () => {
    expect(getTierFromElo(1500)).toBe('Diamond');
    expect(getTierFromElo(1799)).toBe('Diamond');
  });

  it('should return Legend for 1800+', () => {
    expect(getTierFromElo(1800)).toBe('Legend');
    expect(getTierFromElo(2500)).toBe('Legend');
  });
});

describe('canIPO', () => {
  it('should allow IPO for Diamond and Legend', () => {
    expect(canIPO('Diamond')).toBe(true);
    expect(canIPO('Legend')).toBe(true);
  });

  it('should not allow IPO for lower tiers', () => {
    expect(canIPO('Bronze')).toBe(false);
    expect(canIPO('Silver')).toBe(false);
    expect(canIPO('Gold')).toBe(false);
  });
});
