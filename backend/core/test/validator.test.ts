import { describe, it, expect } from 'vitest';
import { isValidSpec, validateSpec } from '../src/schema/validator.js';

describe('IntentSpec Schema Validator', () => {
  it('validates a correct IntentSpec', () => {
    const valid = {
      id: 'intent-abc123',
      status: 'draft',
      objective: 'Implement seat reservation',
      outcomes: ['Seats are selectable and locked']
    };
    expect(isValidSpec(valid)).toBe(true);
    expect(() => validateSpec(valid)).not.toThrow();
  });

  it('rejects an invalid status or missing required fields', () => {
    const invalid = {
      id: 'intent-bad',
      status: 'non-existent-status',
      objective: 'Missing outcomes'
    };
    expect(isValidSpec(invalid)).toBe(false);
    expect(() => validateSpec(invalid)).toThrow();
  });
});
