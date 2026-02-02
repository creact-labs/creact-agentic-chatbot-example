import { readFile, writeFile, mkdir, rm, access, rename } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { Backend, DeploymentState, AuditLogEntry } from '@creact-labs/creact';

export interface FileBackendOptions {
  directory: string;
  prettyPrint?: boolean;
}

export class FileBackend implements Backend {
  private directory: string;
  private prettyPrint: boolean;

  constructor(options: FileBackendOptions) {
    this.directory = options.directory;
    this.prettyPrint = options.prettyPrint ?? true;
  }

  private getStatePath(stackName: string): string {
    return join(this.directory, `${stackName}.json`);
  }

  private getLockPath(stackName: string): string {
    return join(this.directory, `${stackName}.lock`);
  }

  private getAuditPath(stackName: string): string {
    return join(this.directory, `${stackName}.audit.json`);
  }

  private async ensureDirectory(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async getState(stackName: string): Promise<DeploymentState | null> {
    const path = this.getStatePath(stackName);

    if (!(await this.fileExists(path))) {
      return null;
    }

    try {
      const content = await readFile(path, 'utf-8');
      const state: DeploymentState = JSON.parse(content);

      // Only clear outputs for truly ephemeral runtime resources (Express app, Response objects).
      // Everything else (ChatModel, Tool, Memory) stores its state in CReact outputs.
      const ephemeralTypes = ['HttpServer', 'ChatHandler'];
      if (state?.nodes) {
        for (const node of state.nodes) {
          if (ephemeralTypes.includes(node.constructType)) {
            delete node.outputs;
          }
        }
      }

      return state;
    } catch (error) {
      console.warn(`Failed to read state file ${path}:`, error);
      return null;
    }
  }

  async saveState(stackName: string, state: DeploymentState): Promise<void> {
    await this.ensureDirectory();

    const path = this.getStatePath(stackName);
    const tempPath = join(this.directory, `.${stackName}.${randomUUID()}.tmp`);
    const content = this.prettyPrint
      ? JSON.stringify(state, null, 2)
      : JSON.stringify(state);

    // Atomic write: write to temp file, then rename
    await writeFile(tempPath, content, 'utf-8');
    await rename(tempPath, path);
  }

  async acquireLock(stackName: string, holder: string, ttlSeconds: number): Promise<boolean> {
    await this.ensureDirectory();

    const lockPath = this.getLockPath(stackName);
    const expiresAt = Date.now() + ttlSeconds * 1000;

    if (await this.fileExists(lockPath)) {
      try {
        const content = await readFile(lockPath, 'utf-8');
        const lock = JSON.parse(content);

        if (lock.expiresAt > Date.now() && lock.holder !== holder) {
          return false;
        }
      } catch {
        // Corrupted lock file, treat as expired
      }
    }

    await writeFile(
      lockPath,
      JSON.stringify({ holder, expiresAt }, null, 2),
      'utf-8'
    );

    return true;
  }

  async releaseLock(stackName: string): Promise<void> {
    const lockPath = this.getLockPath(stackName);

    if (await this.fileExists(lockPath)) {
      await rm(lockPath);
    }
  }

  async appendAuditLog(stackName: string, entry: AuditLogEntry): Promise<void> {
    await this.ensureDirectory();

    const auditPath = this.getAuditPath(stackName);
    let logs: AuditLogEntry[] = [];

    if (await this.fileExists(auditPath)) {
      try {
        const content = await readFile(auditPath, 'utf-8');
        logs = JSON.parse(content);
      } catch {
        logs = [];
      }
    }

    logs.push(entry);

    const content = this.prettyPrint
      ? JSON.stringify(logs, null, 2)
      : JSON.stringify(logs);

    await writeFile(auditPath, content, 'utf-8');
  }

  async getAuditLog(stackName: string, limit?: number): Promise<AuditLogEntry[]> {
    const auditPath = this.getAuditPath(stackName);

    if (!(await this.fileExists(auditPath))) {
      return [];
    }

    try {
      const content = await readFile(auditPath, 'utf-8');
      const logs: AuditLogEntry[] = JSON.parse(content);

      if (limit) {
        return logs.slice(-limit);
      }

      return logs;
    } catch {
      return [];
    }
  }

  async deleteStack(stackName: string): Promise<void> {
    const paths = [
      this.getStatePath(stackName),
      this.getLockPath(stackName),
      this.getAuditPath(stackName),
    ];

    for (const path of paths) {
      if (await this.fileExists(path)) {
        await rm(path);
      }
    }
  }
}
