// Mock API implementations for now in case core package is not yet fully available
// Normally these would import from @intentguard/core

export interface SpecScope {
  inScope: string[];
  outOfScope: string[];
}

export interface Spec {
  id: string;
  status: 'draft' | 'validated' | 'approved' | 'shipped' | 'verified';
  objective: string;
  outcomes: string[];
  evidence?: { type: string; description: string; trustTier: string }[];
  constraints?: string[];
  scope?: SpecScope;
  edgeCases?: string[];
  healthMetrics?: string[];
  verification?: string[];
  problemSeverity?: string;
  userGoal?: string;
  createdAt?: string;
  updatedAt?: string;
}

const mockSpecs: Spec[] = [
  {
    id: "SPEC-101",
    status: "draft",
    objective: "Implement a secure authentication system using JWT.",
    outcomes: ["Users can log in", "Users can log out", "Tokens refresh automatically"],
    evidence: [
      { type: "request", description: "User requested OAuth2 support", trustTier: "backed" },
      { type: "friction", description: "Current auth is slow", trustTier: "unreviewed" }
    ],
    scope: {
      inScope: ["JWT Implementation", "Login Page UI"],
      outOfScope: ["Social Login (Google/GitHub)", "MFA"]
    },
    createdAt: new Date().toISOString()
  },
  {
    id: "SPEC-102",
    status: "verified",
    objective: "Optimize database queries for the main dashboard load.",
    outcomes: ["P99 latency under 200ms", "Zero N+1 queries"],
    evidence: [
      { type: "metric", description: "Dashboard takes 2s to load", trustTier: "backed" }
    ],
    scope: {
      inScope: ["Query Optimization", "Index Creation"],
      outOfScope: ["Database Migration", "Schema changes"]
    },
    createdAt: new Date(Date.now() - 86400000).toISOString()
  }
];

export async function getProjectRoot(): Promise<string> {
  return process.cwd();
}

export async function getActiveSpec(): Promise<Spec | null> {
  return mockSpecs[0] || null;
}

export async function getAllSpecs(): Promise<Spec[]> {
  return mockSpecs;
}

export async function getSpecById(id: string): Promise<Spec | null> {
  return mockSpecs.find(s => s.id === id) || null;
}

export async function getProofReport(id: string): Promise<any> {
  return {
    specId: id,
    testsPassed: 45,
    testsFailed: 0,
    scopeViolations: [],
    commitReady: true
  };
}
