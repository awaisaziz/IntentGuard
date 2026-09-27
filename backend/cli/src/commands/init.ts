import { DEFAULT_CONFIG, SpecStore, detectProjectInfo, getRepoRoot, saveConfig } from '@intentguard/core';
import { success, error } from '../ui/formatters.js';
import { formatCommandError } from './mcp-setup.js';

/**
 * Initializes IntentGuard in the current project.
 */
export async function initCommand(): Promise<void> {
  try {
    const repoRoot = await getRepoRoot();
    
    const store = new SpecStore(repoRoot);
    await store.init();
    
    const projectInfo = await detectProjectInfo(repoRoot);
    await saveConfig(repoRoot, { ...DEFAULT_CONFIG, projectName: projectInfo.projectName });
    
    console.log(success(`Initialized IntentGuard in ${repoRoot}`));
    if (projectInfo.projectName) {
      console.log(`Detected project: ${projectInfo.projectName}`);
    }
  } catch (err) {
    console.error(error(`Failed to initialize IntentGuard: ${formatCommandError(err)}`));
    process.exit(1);
  }
}
