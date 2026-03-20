import fs from 'fs/promises';
import path from 'path';
import { readSettings } from '@/lib/settings-storage';

export interface WorkspaceFile {
  name: string;
  relativePath: string;
  size: number;
}

async function getWorkspaceRoot(): Promise<string> {
  const settings = await readSettings();
  return settings.workspacePath
    ? path.resolve(settings.workspacePath)
    : path.join(process.cwd(), 'workspace');
}

const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

export async function getWorkspaceDir(flowId: string): Promise<string> {
  if (!SAFE_ID_RE.test(flowId)) throw new Error(`Invalid flowId: ${flowId}`);
  const root = await getWorkspaceRoot();
  return path.join(root, flowId);
}

export async function initWorkspace(flowId: string): Promise<void> {
  const dir = await getWorkspaceDir(flowId);
  await fs.mkdir(path.join(dir, 'memory'), { recursive: true });
  await fs.mkdir(path.join(dir, 'runs'), { recursive: true });

  // Create default files if they don't exist
  const progressFile = path.join(dir, 'progress.md');
  try {
    await fs.access(progressFile);
  } catch {
    await fs.writeFile(progressFile, `# Progress\n\n## Recent Activity\n\n## Current Status\n\n## Next Steps\n`, 'utf-8');
  }

  const featuresFile = path.join(dir, 'features.json');
  try {
    await fs.access(featuresFile);
  } catch {
    await fs.writeFile(featuresFile, JSON.stringify({ features: [] }, null, 2), 'utf-8');
  }

  const sharedMemory = path.join(dir, 'memory', 'shared.md');
  try {
    await fs.access(sharedMemory);
  } catch {
    await fs.writeFile(sharedMemory, `# Shared Memory\n\nFlow-level shared context goes here.\n`, 'utf-8');
  }
}

export async function readWorkspaceFile(flowId: string, filename: string): Promise<string> {
  const dir = await getWorkspaceDir(flowId);
  const fullPath = path.resolve(dir, filename);
  if (!fullPath.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error('Invalid file path');
  }
  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch {
    return '';
  }
}

export async function writeWorkspaceFile(flowId: string, filename: string, content: string): Promise<void> {
  const dir = await getWorkspaceDir(flowId);
  const fullPath = path.resolve(dir, filename);
  if (!fullPath.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error('Invalid file path');
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');
}

export async function updateProgress(flowId: string, nodeName: string, outcome: string): Promise<void> {
  const dir = await getWorkspaceDir(flowId);
  const progressFile = path.join(dir, 'progress.md');
  let existing = '';
  try {
    existing = await fs.readFile(progressFile, 'utf-8');
  } catch {
    existing = `# Progress\n\n## Recent Activity\n\n## Current Status\n\n## Next Steps\n`;
  }

  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const entry = `- [${timestamp}] ${nodeName}: ${outcome}`;

  // Insert after "## Recent Activity"
  const updated = existing.replace(
    /## Recent Activity\n/,
    `## Recent Activity\n${entry}\n`,
  );
  await fs.mkdir(path.dirname(progressFile), { recursive: true });
  await fs.writeFile(progressFile, updated, 'utf-8');
}

/** Pattern matching internal/metadata files that should be hidden from the file listing */
const INTERNAL_FILE_RE = /^(memory\/|runs\/|progress\.md$|features\.json$|shared\.md$|docs\/)/;

/** Format a byte size into a human-readable string (e.g. "45.2 KB") */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function buildSessionContext(flowId: string, nodeId: string): Promise<string> {
  if (!SAFE_ID_RE.test(nodeId)) {
    throw new Error(`Invalid nodeId: ${nodeId}`);
  }
  const [progress, featuresRaw, nodeMemory, sharedMemory, allFiles] = await Promise.all([
    readWorkspaceFile(flowId, 'progress.md'),
    readWorkspaceFile(flowId, 'features.json'),
    readWorkspaceFile(flowId, `memory/${nodeId}.md`),
    readWorkspaceFile(flowId, 'memory/shared.md'),
    listFiles(flowId),
  ]);

  const dir = await getWorkspaceDir(flowId);
  // Ensure workspace directory exists
  await fs.mkdir(dir, { recursive: true });

  const parts: string[] = ['[Workspace Context]'];
  parts.push(`## Output Directory\nSave ALL generated files (documents, images, presentations, etc.) to:\n\`${dir}\`\nUse this absolute path in your code. Do NOT save files to the project root or temp directories.`);
  if (progress) parts.push(`## Progress\n${progress}`);
  if (featuresRaw) {
    try {
      const { features } = JSON.parse(featuresRaw);
      if (features?.length) {
        const summary = (features as { passes: boolean; description: string }[]).map((f) => `- [${f.passes ? 'x' : ' '}] ${f.description}`).join('\n');
        parts.push(`## Task Checklist\n${summary}`);
      }
    } catch { /* ignore */ }
  }
  if (sharedMemory) parts.push(`## Shared Memory\n${sharedMemory}`);
  if (nodeMemory) parts.push(`## Your Private Memory\n${nodeMemory}`);

  // Build workspace file listing (exclude internal/metadata files)
  const userFiles = allFiles.filter(f => !INTERNAL_FILE_RE.test(f.relativePath));
  if (userFiles.length > 0) {
    const fileLines = userFiles.map(f => `- ${f.relativePath} (${formatFileSize(f.size)})`).join('\n');
    parts.push(`## Workspace Files\nThe following files currently exist in the workspace:\n${fileLines}\n\nIf you need to verify document existence or content, check this list first.`);
  } else {
    parts.push(`## Workspace Files\nNo files in workspace yet.`);
  }

  parts.push('[End Workspace Context]');

  return parts.join('\n\n');
}

export async function removeWorkspace(flowId: string): Promise<void> {
  const dir = await getWorkspaceDir(flowId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // workspace may not exist — that's fine
  }
}

export async function listFiles(flowId: string): Promise<WorkspaceFile[]> {
  const dir = await getWorkspaceDir(flowId);
  const results: WorkspaceFile[] = [];

  async function walk(currentDir: string, prefix: string) {
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true }) as import('fs').Dirent[];
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryName = entry.name as string;
      if (entryName === 'runs') continue; // skip run outputs to keep list manageable
      const rel = prefix ? `${prefix}/${entryName}` : entryName;
      if (entry.isDirectory()) {
        await walk(path.join(currentDir, entryName), rel);
      } else {
        try {
          const stat = await fs.stat(path.join(currentDir, entryName));
          results.push({ name: entryName, relativePath: rel, size: stat.size });
        } catch { /* ignore */ }
      }
    }
  }

  await walk(dir, '');
  return results;
}
