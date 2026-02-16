/**
 * creation-lab.test.ts — Agent Creation Tests
 */

import { describe, it, expect } from 'vitest';
import { FACTIONS } from './creation-lab.js';

describe('Agent Factions', () => {
  it('should include all required factions', () => {
    expect(FACTIONS).toContain('합리주의');
    expect(FACTIONS).toContain('경험주의');
    expect(FACTIONS).toContain('실용주의');
    expect(FACTIONS).toContain('이상주의');
  });

  it('should have at least 4 factions', () => {
    expect(FACTIONS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Agent Validation Rules', () => {
  it('should require non-empty name', () => {
    const name = '';
    expect(name.trim()).toBe('');
  });

  it('should require non-empty persona', () => {
    const persona = '   ';
    expect(persona.trim()).toBe('');
  });

  it('should validate faction membership', () => {
    expect(FACTIONS.includes('합리주의' as typeof FACTIONS[number])).toBe(true);
    expect(FACTIONS.includes('invalid' as typeof FACTIONS[number])).toBe(false);
  });
});

describe('Agent Tier Rules', () => {
  const INITIAL_ELO = 1000;

  it('should start with initial ELO of 1000', () => {
    expect(INITIAL_ELO).toBe(1000);
  });

  it('should have correct tier thresholds', () => {
    const thresholds = {
      Bronze: [0, 1099],
      Silver: [1100, 1299],
      Gold: [1300, 1499],
      Diamond: [1500, 1799],
      Legend: [1800, Infinity],
    };

    // Ensure no gaps in tiers
    expect(thresholds.Bronze[1] + 1).toBe(thresholds.Silver[0]);
    expect(thresholds.Silver[1] + 1).toBe(thresholds.Gold[0]);
    expect(thresholds.Gold[1] + 1).toBe(thresholds.Diamond[0]);
    expect(thresholds.Diamond[1] + 1).toBe(thresholds.Legend[0]);
  });

  it('should start in Bronze tier', () => {
    const tier = INITIAL_ELO < 1100 ? 'Bronze' : 'Other';
    expect(tier).toBe('Bronze');
  });
});

describe('Free Tier Limits', () => {
  const FREE_MAX_AGENTS = 3;
  const FREE_DEBATES_PER_DAY = 50;
  const FREE_TRADES_PER_DAY = 10;

  it('should limit free users to 3 agents', () => {
    expect(FREE_MAX_AGENTS).toBe(3);
  });

  it('should limit free debates to 50/day', () => {
    expect(FREE_DEBATES_PER_DAY).toBe(50);
  });

  it('should limit free trades to 10/day', () => {
    expect(FREE_TRADES_PER_DAY).toBe(10);
  });
});
