import { describe, it, expect } from 'vitest';
import { generateQuestions } from '../src/questions/generator.js';
import type { IntentSpec } from '../src/schema/intentspec.js';

describe('Question Generator', () => {
  it('identifies missing sections as critical questions', () => {
    const incompleteSpec: IntentSpec = {
      id: 'intent-q',
      status: 'draft',
      objective: 'Short',
      outcomes: []
    };
    const questions = generateQuestions(incompleteSpec);
    expect(questions.length).toBeGreaterThanOrEqual(4);
    expect(questions.some(q => q.section === 'objective')).toBe(true);
    expect(questions.some(q => q.section === 'outcomes')).toBe(true);
    expect(questions.some(q => q.section === 'scope')).toBe(true);
    expect(questions[0].severity).toBe('critical');
  });

  it('asks about the spec\'s own weak spots instead of generic gaps', () => {
    const spec: IntentSpec = {
      id: 'intent-q2',
      status: 'draft',
      rawRequest: 'improve the booking flow and make it better',
      objective: 'improve the booking flow and make it better',
      outcomes: ['Booking feels faster', 'Checkout returns a confirmation number'],
      scope: { inScope: ['src/booking/**'], outOfScope: [] },
      evidence: [{ type: 'observation', excerpt: 'slow page', source: 'src/booking/page.tsx' }],
    };
    const questions = generateQuestions(spec);
    const text = questions.map(q => q.question).join('\n');
    expect(text).toContain('only restates the request');
    expect(text).toContain('"Booking feels faster"');
    expect(text).not.toContain('"Checkout returns a confirmation number"');
    expect(text).toContain('Scope allows src/booking/**. Which nearby areas must NOT change?');
    expect(questions.find(q => q.section === 'edgeCases')?.question).toContain('"Booking feels faster"');
  });

  it('asks nothing critical about a complete spec', () => {
    const spec: IntentSpec = {
      id: 'intent-q3',
      status: 'draft',
      objective: 'Let travellers reserve a free cabin seat before payment to cut support calls.',
      outcomes: ['lockSeat() returns the seat number for a free seat'],
      scope: { inScope: ['src/booking/**'], outOfScope: ['src/billing/**'] },
      edgeCases: [{ scenario: 'Seat taken meanwhile', expectedBehavior: 'Return an error' }],
      verification: ['Unit test for lockSeat'],
      constraints: ['No new dependencies'],
      healthMetrics: ['Existing booking tests pass'],
      evidence: [{ type: 'metric', excerpt: '24% checkout drop-off', source: 'analytics' }],
    };
    expect(generateQuestions(spec)).toEqual([]);
  });
});
