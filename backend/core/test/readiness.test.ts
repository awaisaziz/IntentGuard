import { describe, it, expect } from 'vitest';
import { computeReadiness } from '../src/readiness/scorer.js';
import type { IntentSpec } from '../src/schema/intentspec.js';

describe('Readiness Scorer', () => {
  const minimalSpec: IntentSpec = {
    id: 'test-1',
    status: 'draft',
    objective: 'Short',
    outcomes: []
  };

  it('fails minimal spec and reports blockers', () => {
    const result = computeReadiness(minimalSpec);
    expect(result.ready).toBe(false);
    expect(result.score).toBeLessThan(30);
    expect(result.blockers.length).toBeGreaterThanOrEqual(4);
  });

  it('scores completely empty spec with 0', () => {
    const emptySpec: IntentSpec = {
      id: 'test-empty',
      status: 'draft',
      objective: '',
      outcomes: []
    };
    const result = computeReadiness(emptySpec);
    expect(result.ready).toBe(false);
    expect(result.score).toBe(0);
  });

  it('scores full spec with 100% readiness', () => {
    const fullSpec: IntentSpec = {
      id: 'test-full',
      status: 'draft',
      objective: 'Users currently cannot select seats during booking flow resulting in 20% abandonment.',
      outcomes: [
        'User can view seat map and select an available seat in under 30 seconds',
        'Selected seat is reserved in state and confirmed on checkout'
      ],
      evidence: [
        {
          id: 'ev-1',
          type: 'friction',
          excerpt: 'User ticket #402: I had no way to choose my seat row.'
        }
      ],
      scope: {
        inScope: ['src/booking/seats/**', 'src/components/SeatMap.tsx'],
        outOfScope: ['src/billing/**', 'src/auth/**']
      },
      edgeCases: [
        {
          scenario: 'Two users attempt to select the same seat concurrently',
          expectedBehavior: 'First request succeeds, second receives a real-time conflict notification'
        }
      ],
      healthMetrics: ['Checkout conversion does not regress below 85%'],
      verification: ['Run seats.test.ts and verify seat reservation lock test passes']
    };

    const result = computeReadiness(fullSpec);
    expect(result.ready).toBe(true);
    expect(result.score).toBe(100);
    expect(result.blockers.length).toBe(0);
  });
});
