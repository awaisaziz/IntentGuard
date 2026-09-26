import type { IntentSpec, Question } from '../schema/intentspec.js';
import { generateSpecId } from '../utils/id.js';

export function generateQuestions(spec: IntentSpec): Question[] {
  const questions: Question[] = [];

  if (!spec.objective || spec.objective.length < 30) {
    questions.push({
      id: generateSpecId(),
      section: 'objective',
      question: 'The objective seems vague. Could you provide more specific details?',
      severity: 'critical'
    });
  }

  if (!spec.outcomes || spec.outcomes.length === 0) {
    questions.push({
      id: generateSpecId(),
      section: 'outcomes',
      question: 'There are no outcomes defined. What are the specific measurable results expected?',
      severity: 'critical'
    });
  } else {
    const vagueOutcomes = spec.outcomes.filter(o => !o.match(/\d/)); // arbitrary heuristic for measurability
    if (vagueOutcomes.length > 0) {
      questions.push({
        id: generateSpecId(),
        section: 'outcomes',
        question: 'Some outcomes do not appear strictly measurable. Can we add numbers or clear boolean states?',
        severity: 'important'
      });
    }
  }

  if (!spec.scope || (!spec.scope.inScope.length && !spec.scope.outOfScope.length)) {
    questions.push({
      id: generateSpecId(),
      section: 'scope',
      question: 'Scope is completely undefined. What areas of the codebase are safe to touch, and what should be avoided?',
      severity: 'important'
    });
  }

  if (!spec.edgeCases || spec.edgeCases.length === 0) {
    questions.push({
      id: generateSpecId(),
      section: 'edgeCases',
      question: 'No edge cases identified. Are there any error states or unusual inputs to consider?',
      severity: 'important'
    });
  }

  if (!spec.verification || spec.verification.length === 0) {
    questions.push({
      id: generateSpecId(),
      section: 'verification',
      question: 'How should this intent be verified manually or automatically once implemented?',
      severity: 'important'
    });
  }

  if (!spec.evidence || spec.evidence.length === 0) {
    questions.push({
      id: generateSpecId(),
      section: 'evidence',
      question: 'Is there any user feedback, metric, or observation that prompted this work?',
      severity: 'nice-to-have'
    });
  }

  return questions;
}
