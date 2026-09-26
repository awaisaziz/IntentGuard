export interface DiffStat {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export function parseChangedFiles(diffOutput: string): string[] {
  return diffOutput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

export function parseDiffStat(statOutput: string): DiffStat {
  const match = statOutput.match(/(\d+)\s+files? changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/i);
  if (!match) {
    return { filesChanged: 0, insertions: 0, deletions: 0 };
  }
  return {
    filesChanged: parseInt(match[1], 10),
    insertions: match[2] ? parseInt(match[2], 10) : 0,
    deletions: match[3] ? parseInt(match[3], 10) : 0,
  };
}
