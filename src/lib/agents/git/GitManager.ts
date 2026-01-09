// Git Manager - Handles git operations for agent sandboxes
// Provides version control for agent-generated changes

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  insertions: number;
  deletions: number;
}

export interface DiffResult {
  commitHash: string;
  files: FileDiff[];
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}

export interface FileDiff {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion' | 'header';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export class GitManager {
  private sandboxId: string;
  private workingDir: string;

  constructor(sandboxId: string, workingDir: string = '/workspace') {
    this.sandboxId = sandboxId;
    this.workingDir = workingDir;
  }

  /**
   * Initialize git repository
   */
  async init(): Promise<void> {
    await this.execute('git init');
    await this.execute('git config user.name "Swiss Agent"');
    await this.execute('git config user.email "agent@swissbrain.ai"');
    
    // Create initial commit
    await this.execute('git add -A');
    await this.execute('git commit -m "Initial commit" --allow-empty');
  }

  /**
   * Stage all changes
   */
  async stageAll(): Promise<void> {
    await this.execute('git add -A');
  }

  /**
   * Stage specific files
   */
  async stage(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    await this.execute(`git add ${paths.map(p => `"${p}"`).join(' ')}`);
  }

  /**
   * Commit staged changes
   */
  async commit(message: string): Promise<CommitInfo | null> {
    try {
      await this.execute(`git commit -m "${this.escapeMessage(message)}"`);
      return this.getLatestCommit();
    } catch (error) {
      // No changes to commit
      if (String(error).includes('nothing to commit')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get list of changed files (unstaged)
   */
  async getChangedFiles(): Promise<FileChange[]> {
    const output = await this.execute('git status --porcelain');
    const lines = output.trim().split('\n').filter(Boolean);
    
    return lines.map(line => {
      const status = line.substring(0, 2).trim();
      const path = line.substring(3);
      
      return {
        path,
        status: this.parseStatus(status),
        insertions: 0,
        deletions: 0,
      };
    });
  }

  /**
   * Get commit history
   */
  async getHistory(limit: number = 50): Promise<CommitInfo[]> {
    const format = '%H|%h|%s|%an|%ae|%aI|%d';
    const output = await this.execute(
      `git log --format="${format}" -n ${limit}`
    );
    
    const lines = output.trim().split('\n').filter(Boolean);
    
    return lines.map(line => {
      const [hash, shortHash, message, author, email, dateStr] = line.split('|');
      return {
        hash,
        shortHash,
        message,
        author,
        email,
        date: new Date(dateStr),
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
      };
    });
  }

  /**
   * Get latest commit
   */
  async getLatestCommit(): Promise<CommitInfo | null> {
    const history = await this.getHistory(1);
    return history[0] || null;
  }

  /**
   * Get diff for a specific commit
   */
  async getDiff(commitHash: string): Promise<DiffResult> {
    const output = await this.execute(
      `git show ${commitHash} --format="" --patch --stat`
    );
    
    return this.parseDiff(commitHash, output);
  }

  /**
   * Get diff between two commits
   */
  async getDiffBetween(fromHash: string, toHash: string): Promise<DiffResult> {
    const output = await this.execute(
      `git diff ${fromHash}..${toHash} --patch --stat`
    );
    
    return this.parseDiff(toHash, output);
  }

  /**
   * Get unstaged diff
   */
  async getUnstagedDiff(): Promise<DiffResult> {
    const output = await this.execute('git diff --patch --stat');
    return this.parseDiff('unstaged', output);
  }

  /**
   * Revert to a specific commit
   */
  async revertTo(commitHash: string): Promise<CommitInfo> {
    // Create a revert commit
    await this.execute(`git revert --no-commit ${commitHash}..HEAD`);
    return this.commit(`Revert to ${commitHash.substring(0, 7)}`);
  }

  /**
   * Hard reset to a specific commit (destructive)
   */
  async resetTo(commitHash: string): Promise<void> {
    await this.execute(`git reset --hard ${commitHash}`);
  }

  /**
   * Check if there are uncommitted changes
   */
  async hasChanges(): Promise<boolean> {
    const output = await this.execute('git status --porcelain');
    return output.trim().length > 0;
  }

  /**
   * Get current branch
   */
  async getCurrentBranch(): Promise<string> {
    const output = await this.execute('git rev-parse --abbrev-ref HEAD');
    return output.trim();
  }

  /**
   * Execute git command
   */
  private async execute(command: string): Promise<string> {
    // In production, this would call the sandbox execution API
    console.log(`[Git] ${command}`);
    
    // Simulated response for development
    if (command.includes('git log')) {
      return this.simulateLog();
    }
    if (command.includes('git status')) {
      return '';
    }
    if (command.includes('git show') || command.includes('git diff')) {
      return this.simulateDiff();
    }
    
    return '';
  }

  /**
   * Parse git status character to FileChange status
   */
  private parseStatus(status: string): FileChange['status'] {
    switch (status) {
      case 'A': return 'added';
      case 'M': return 'modified';
      case 'D': return 'deleted';
      case 'R': return 'renamed';
      default: return 'modified';
    }
  }

  /**
   * Parse diff output
   */
  private parseDiff(commitHash: string, output: string): DiffResult {
    const files: FileDiff[] = [];
    let stats = { filesChanged: 0, insertions: 0, deletions: 0 };

    // Parse stat line
    const statMatch = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    if (statMatch) {
      stats = {
        filesChanged: parseInt(statMatch[1]) || 0,
        insertions: parseInt(statMatch[2]) || 0,
        deletions: parseInt(statMatch[3]) || 0,
      };
    }

    // Parse file diffs (simplified)
    const diffSections = output.split(/^diff --git/m).slice(1);
    for (const section of diffSections) {
      const pathMatch = section.match(/a\/(.*?) b\/(.*?)\n/);
      if (pathMatch) {
        const hunks: DiffHunk[] = [];
        const hunkMatches = section.matchAll(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@(.*?)\n([\s\S]*?)(?=@@|$)/g);
        
        for (const hunkMatch of hunkMatches) {
          const lines: DiffLine[] = [];
          const content = hunkMatch[6] || '';
          
          content.split('\n').forEach(line => {
            if (line.startsWith('+')) {
              lines.push({ type: 'addition', content: line.substring(1) });
            } else if (line.startsWith('-')) {
              lines.push({ type: 'deletion', content: line.substring(1) });
            } else if (line.startsWith(' ')) {
              lines.push({ type: 'context', content: line.substring(1) });
            }
          });

          hunks.push({
            oldStart: parseInt(hunkMatch[1]),
            oldLines: parseInt(hunkMatch[2]) || 1,
            newStart: parseInt(hunkMatch[3]),
            newLines: parseInt(hunkMatch[4]) || 1,
            lines,
          });
        }

        files.push({
          path: pathMatch[2],
          oldPath: pathMatch[1] !== pathMatch[2] ? pathMatch[1] : undefined,
          status: 'modified',
          hunks,
        });
      }
    }

    return { commitHash, files, stats };
  }

  /**
   * Escape commit message for shell
   */
  private escapeMessage(message: string): string {
    return message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  /**
   * Simulate git log for development
   */
  private simulateLog(): string {
    const now = new Date();
    return [
      `abc1234|abc1234|Add user authentication|Swiss Agent|agent@swissbrain.ai|${new Date(now.getTime() - 1000 * 60 * 30).toISOString()}|`,
      `def5678|def5678|Update API endpoints|Swiss Agent|agent@swissbrain.ai|${new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString()}|`,
      `ghi9012|ghi9012|Initial project setup|Swiss Agent|agent@swissbrain.ai|${new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString()}|`,
    ].join('\n');
  }

  /**
   * Simulate diff for development
   */
  private simulateDiff(): string {
    return `diff --git a/src/App.tsx b/src/App.tsx
index abc1234..def5678 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,5 +1,7 @@
 import React from 'react';
+import { AuthProvider } from './auth';
 
 function App() {
-  return <div>Hello</div>;
+  return (
+    <AuthProvider>
+      <div>Hello World</div>
+    </AuthProvider>
+  );
 }

 1 file changed, 6 insertions(+), 1 deletion(-)`;
  }
}

// Factory function
export function createGitManager(sandboxId: string, workingDir?: string): GitManager {
  return new GitManager(sandboxId, workingDir);
}
