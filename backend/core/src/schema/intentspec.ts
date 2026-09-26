export type SpecStatus = 'draft' | 'validated' | 'approved' | 'shipped' | 'verified';
export type ProblemSeverity = 'low' | 'medium' | 'high' | 'critical';
export type EvidenceType = 'friction' | 'quote' | 'observation' | 'metric' | 'request';
export type EvidenceTrust = 'high' | 'medium' | 'low';

export interface Evidence {
  id?: string;
  type: EvidenceType;
  source?: string;
  excerpt: string;
  trust?: EvidenceTrust;
  anchors?: string[];
}

export interface EdgeCase {
  id?: string;
  scenario: string;
  expectedBehavior: string;
}

export interface Scope {
  inScope: string[];
  outOfScope: string[];
}

export interface IntentSpec {
  id: string;
  status: SpecStatus;
  version?: number;
  objective: string;
  problemSeverity?: ProblemSeverity;
  userGoal?: string;
  outcomes: string[];
  healthMetrics?: string[];
  verification?: string[];
  scope?: Scope;
  constraints?: string[];
  edgeCases?: EdgeCase[];
  evidence?: Evidence[];
  strategicAlignment?: 'high' | 'medium' | 'low' | 'deviation';
  alignmentNotes?: string;
  createdAt?: number;
  updatedAt?: number;
  
  rawRequest?: string;
  readinessScore?: number;
  proofReport?: string;
}

export interface ReadinessGate {
  name: string;
  weight: number;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface ReadinessScore {
  score: number;
  ready: boolean;
  gates: ReadinessGate[];
  blockers: string[];
}

export interface OutcomeCheck {
  outcome: string;
  status: 'pass' | 'fail' | 'untested';
  testFile?: string;
  testResult?: TestResult;
}

export interface HealthCheck {
  metric: string;
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  details?: string;
}

export interface TestResult {
  file: string;
  passed: boolean;
  output?: string;
}

export interface VerificationResult {
  passed: boolean;
  scopeViolations: string[];
  outcomesChecked: OutcomeCheck[];
  healthMetricsChecked: HealthCheck[];
  testsRun: TestResult[];
}

export interface ProofReport {
  specId: string;
  timestamp: number;
  verification: VerificationResult;
  summary: string;
  commitReady: boolean;
}

export interface ScopeCheckResult {
  allowed: boolean;
  filePath: string;
  reason: string;
  matchedRule?: string;
}

export interface GatheredEvidence {
  affectedFiles: string[];
  relatedTests: string[];
  relatedDocs: string[];
  currentBehavior: string;
}

export interface Question {
  id: string;
  section: string;
  question: string;
  severity: 'critical' | 'important' | 'nice-to-have';
  context?: string;
}

export interface PrivacyConfig {
  /** Redact emails, phone numbers, credentials, and local user paths before a spec is written. Default true. */
  redactSpecs?: boolean;
  /** Same for proof reports, whose test output can echo local paths. Default true. */
  redactReports?: boolean;
}

export interface IntentConfig {
  projectName?: string;
  llmProvider: string;
  readinessThreshold: number;
  specDir: string;
  reportDir: string;
  privacy?: PrivacyConfig;
  /**
   * Named project checks, e.g. `{ "test": "pnpm test" }`. The chat agent can only run
   * commands listed here, by name, so the developer decides what may execute.
   */
  commands?: Record<string, string>;
}
