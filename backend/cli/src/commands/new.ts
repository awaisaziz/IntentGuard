import inquirer from 'inquirer';
import {
  SpecStore,
  getRepoRoot,
  loadConfig,
  gatherEvidence,
  resolveProvider,
  generateSpecId,
  generateTimestamp,
  computeReadiness,
  specToMarkdown,
  type IntentSpec
} from '@intentguard/core';
import { withSpinner } from '../ui/spinner.js';
import { formatReadiness, header, warning, error as formatError } from '../ui/formatters.js';

/**
 * Drafts a new IntentSpec from a request.
 * @param request The user's request
 */
export async function newCommand(request: string): Promise<void> {
  try {
    const repoRoot = await getRepoRoot();
    const config = await loadConfig(repoRoot);
    
    const evidence = await withSpinner('Gathering evidence...', async () => {
      return await gatherEvidence(repoRoot, request);
    });
    
    const draft = await withSpinner('Drafting IntentSpec...', async () => {
      const provider = resolveProvider(config);
      return await provider.draft(request, evidence);
    });
    
    const spec: IntentSpec = {
      id: generateSpecId(),
      status: 'draft',
      createdAt: generateTimestamp(),
      updatedAt: generateTimestamp(),
      objective: draft.objective || request,
      outcomes: draft.outcomes || [],
      evidence: draft.evidence || [
        {
          id: 'ev-1',
          type: 'request',
          excerpt: request,
          anchors: ['objective']
        }
      ],
      scope: draft.scope || { inScope: evidence.affectedFiles, outOfScope: [] },
      edgeCases: draft.edgeCases || [],
      constraints: draft.constraints || [],
      healthMetrics: draft.healthMetrics || [],
      verification: draft.verification || [],
      rawRequest: request,
      ...draft
    };
    
    const store = new SpecStore(repoRoot);
    await store.init();
    const { spec: savedSpec, redactions } = await store.save(spec);
    Object.assign(spec, savedSpec);
    await store.setActive(spec.id);
    if (redactions.length > 0) {
      console.log(warning(`Redacted ${redactions.length} personal/secret value(s) before saving: ${redactions.map(r => r.path).join(', ')}`));
    }
    
    console.log(header('New IntentSpec Drafted'));
    console.log(specToMarkdown(spec));
    console.log('\n');
    
    const { refine } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'refine',
        message: 'Would you like to refine this spec?',
        default: false
      }
    ]);
    
    if (refine) {
      const { objective } = await inquirer.prompt([
        {
          type: 'input',
          name: 'objective',
          message: 'Objective:',
          default: spec.objective
        }
      ]);
      spec.objective = objective;
      spec.updatedAt = generateTimestamp();
      await store.save(spec);
    }
    
    console.log(header('Readiness Check'));
    const readiness = computeReadiness(spec);
    console.log(formatReadiness(readiness));
    
  } catch (err: any) {
    console.error(formatError(`Failed to create new spec: ${err.message}`));
    process.exit(1);
  }
}
