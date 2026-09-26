import { z } from 'zod';
import type { IntentSpec } from './intentspec.js';

export const intentSpecSchema = z.object({
  id: z.string(),
  status: z.enum(['draft', 'validated', 'approved', 'shipped', 'verified']).default('draft'),
  version: z.number().int().optional().default(1),
  objective: z.string(),
  problemSeverity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  userGoal: z.string().optional(),
  outcomes: z.array(z.string()).min(1),
  healthMetrics: z.array(z.string()).optional(),
  verification: z.array(z.string()).optional(),
  scope: z.object({
    inScope: z.array(z.string()),
    outOfScope: z.array(z.string()),
  }).optional(),
  constraints: z.array(z.string()).optional(),
  edgeCases: z.array(z.object({
    id: z.string().optional(),
    scenario: z.string(),
    expectedBehavior: z.string()
  })).optional(),
  evidence: z.array(z.object({
    id: z.string().optional(),
    type: z.enum(['friction', 'quote', 'observation', 'metric', 'request']),
    source: z.string().optional(),
    excerpt: z.string(),
    anchors: z.array(z.string()).optional()
  })).optional(),
  strategicAlignment: z.enum(['high', 'medium', 'low', 'deviation']).optional(),
  alignmentNotes: z.string().optional(),
  createdAt: z.number().int().optional(),
  updatedAt: z.number().int().optional(),
  rawRequest: z.string().optional(),
  readinessScore: z.number().optional(),
  proofReport: z.string().optional()
});

/**
 * Validates data against the IntentSpec schema.
 * @param data Data to validate
 * @returns Validated IntentSpec
 * @throws {Error} if validation fails
 */
export function validateSpec(data: unknown): IntentSpec {
  return intentSpecSchema.parse(data) as IntentSpec;
}

/**
 * Type guard for IntentSpec
 * @param data Data to check
 * @returns true if data is valid IntentSpec
 */
export function isValidSpec(data: unknown): data is IntentSpec {
  return intentSpecSchema.safeParse(data).success;
}
