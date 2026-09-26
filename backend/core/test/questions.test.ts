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
  });
});
