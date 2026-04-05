import { describe, it, expect } from 'vitest';
import { TAGLINE } from '../../../src/adapters/bannerAdapter.js';

describe('bannerAdapter', () => {
  it('exports TAGLINE as the project tagline string', () => {
    expect(TAGLINE).toBe('The Pomodoro timer your terminal deserves');
  });
});
