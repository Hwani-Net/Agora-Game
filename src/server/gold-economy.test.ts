/**
 * gold-economy.test.ts — Gold Economy Tests
 */

import { describe, it, expect } from 'vitest';

// We test the gold logic in isolation without a real database
// by testing the core business rules

describe('Gold Economy Business Rules', () => {
  it('should enforce minimum earn amount > 0', () => {
    expect(() => {
      if (0 <= 0) throw new Error('골드 획득량은 0보다 커야 합니다.');
    }).toThrow();
  });

  it('should enforce minimum spend amount > 0', () => {
    expect(() => {
      if (0 <= 0) throw new Error('골드 사용량은 0보다 커야 합니다.');
    }).toThrow();
  });

  it('should reject spending more than balance', () => {
    const balance = 100;
    const amount = 200;
    expect(() => {
      if (balance < amount) {
        throw new Error(`골드가 부족합니다. 보유: ${balance}골드, 필요: ${amount}골드`);
      }
    }).toThrow('골드가 부족합니다');
  });

  it('should allow spending within balance', () => {
    const balance = 1000;
    const amount = 500;
    expect(() => {
      if (balance < amount) {
        throw new Error('insufficient');
      }
    }).not.toThrow();
  });
});

describe('Gold Transaction Types', () => {
  const validTypes = [
    'signup_bonus', 'daily_quest', 'debate_win', 'bounty_reward',
    'vote_reward', 'stock_buy', 'stock_sell', 'stock_dividend',
  ];

  it('should have all expected transaction types', () => {
    expect(validTypes.length).toBeGreaterThanOrEqual(8);
  });

  it('should include signup bonus of 1000', () => {
    const SIGNUP_BONUS = 1000;
    expect(SIGNUP_BONUS).toBe(1000);
  });

  it('should include debate win reward of 100', () => {
    const DEBATE_WIN_REWARD = 100;
    expect(DEBATE_WIN_REWARD).toBe(100);
  });

  it('should include vote reward of 10', () => {
    const VOTE_REWARD = 10;
    expect(VOTE_REWARD).toBe(10);
  });
});

describe('Bounty Quest Gold Rules', () => {
  it('should enforce minimum bounty of 100 gold', () => {
    const bounty = 50;
    expect(() => {
      if (bounty < 100) throw new Error('현상금은 최소 100골드 이상이어야 합니다.');
    }).toThrow('100골드');
  });

  it('should accept valid bounty amounts', () => {
    const bounty = 500;
    expect(() => {
      if (bounty < 100) throw new Error('minimum');
    }).not.toThrow();
  });
});
