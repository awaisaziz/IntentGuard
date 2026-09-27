import inquirer from 'inquirer';
import { SpecStore, getRepoRoot, verify, commitWithSpec } from '@intentguard/core';
import { withSpinner } from '../ui/spinner.js';
import { success, error, warning } from '../ui/formatters.js';
import { formatCommandError } from './mcp-setup.js';

/**
 * Commits current changes using the specified spec.
 * @param specId Optional ID of the spec (defaults to active)
 */
export async function commitCommand(specId?: string): Promise<void> {
  try {
    const repoRoot = await getRepoRoot();
    const store = new SpecStore(repoRoot);
    
    const spec = specId ? await store.load(specId) : await store.loadActive();
    if (!spec) {
      throw new Error(specId ? `Spec ${specId} not found.` : 'No active spec found.');
    }
    
    if (spec.status !== 'approved' && spec.status !== 'shipped' && spec.status !== 'verified') {
      console.log(warning(`Spec ${spec.id} status is '${spec.status}'. Normally it should be 'approved' before committing.`));
    }
    
    const verification = await withSpinner('Running quick verification...', async () => {
      return await verify(repoRoot, spec);
    });
    
    if (!verification.passed) {
      throw new Error('Verification failed. Please fix the issues before committing.');
    }
    
    const defaultMsg = `feat: ${spec.objective.substring(0, 50)} [intent:${spec.id}]`;
    const { confirmMsg } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmMsg',
        message: `Use commit message: "${defaultMsg}"?`,
        default: true
      }
    ]);
    
    let commitMessage = defaultMsg;
    if (!confirmMsg) {
      const { customMsg } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customMsg',
          message: 'Enter commit message:',
          validate: (input: string) => input.trim().length > 0 || 'Message cannot be empty.'
        }
      ]);
      commitMessage = customMsg;
      if (!commitMessage.includes(`[intent:${spec.id}]`)) {
        commitMessage += ` [intent:${spec.id}]`;
      }
    }
    
    await withSpinner('Committing changes...', async () => {
      await commitWithSpec(repoRoot, commitMessage, spec.id);
    });
    
    spec.status = 'shipped';
    await store.save(spec);
    
    console.log(success(`Committed changes for ${spec.id}`));
  } catch (err) {
    console.error(error(`Commit failed: ${formatCommandError(err)}`));
    process.exit(1);
  }
}
