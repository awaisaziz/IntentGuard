import { describe, it, expect } from 'vitest';
import { checkScope, checkScopeMultiple } from '../src/scope/checker.js';

describe('Scope Fence Checker', () => {
  const scope = {
    inScope: ['src/booking/**', 'packages/ui/components/SeatMap.tsx'],
    outOfScope: ['src/auth/**', 'src/billing/**', '**/secret.key']
  };

  it('allows file within inScope', () => {
    const res = checkScope('src/booking/SeatSelector.ts', scope);
    expect(res.allowed).toBe(true);
  });

  it('blocks file within outOfScope explicitly', () => {
    const res = checkScope('src/auth/login.ts', scope);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('outOfScope');
  });

  it('blocks file that is in outOfScope even if inScope is broad', () => {
    const broadScope = {
      inScope: ['src/**'],
      outOfScope: ['src/billing/**']
    };
    const res = checkScope('src/billing/stripe.ts', broadScope);
    expect(res.allowed).toBe(false);
  });

  it('blocks file not matched by inScope', () => {
    const res = checkScope('database/migration.sql', scope);
    expect(res.allowed).toBe(false);
  });

  it('checks multiple files correctly', () => {
    const results = checkScopeMultiple(
      ['src/booking/seats.ts', 'src/auth/token.ts', 'database/schema.ts'],
      scope
    );
    expect(results[0].allowed).toBe(true);
    expect(results[1].allowed).toBe(false);
    expect(results[2].allowed).toBe(false);
  });
});
