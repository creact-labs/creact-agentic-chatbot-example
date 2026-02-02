import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const run = promisify(exec);

const LIMITS = {
  memory: '512m',
  cpus: '1.0',
  buildTimeout: 300000,  // 5 minutes for builds
  execTimeout: 60000,    // 60 seconds for commands
  maxBuffer: 10 * 1024 * 1024  // 10MB
};

/**
 * Build a Docker image from Dockerfile content
 * @param dockerfile - Dockerfile content
 * @param tag - Image tag
 * @param volumeName - Optional volume to copy files from into build context
 */
export async function buildImage(
  dockerfile: string,
  tag: string,
  volumeName?: string
): Promise<{ success: boolean; imageId?: string; log: string }> {
  const buildDir = `/tmp/docker-build-${randomUUID()}`;
  
  try {
    // Create build context directory
    await mkdir(buildDir, { recursive: true });
    
    // If volume exists, copy its contents to build context
    // This allows COPY commands in Dockerfile to work
    if (volumeName) {
      try {
        // Create a temp container to access the volume
        const tempContainer = `temp-copy-${randomUUID()}`;
        await run(`docker create --name ${tempContainer} -v ${volumeName}:/source alpine:latest`);
        
        // Copy files from volume to build context
        await run(`docker cp ${tempContainer}:/source/. ${buildDir}/`).catch(() => {});
        
        // Remove temp container
        await run(`docker rm ${tempContainer}`).catch(() => {});
      } catch {
        // Volume might not exist yet or be empty, that's ok
      }
    }
    
    // Write Dockerfile (overwrite if copied from volume)
    await writeFile(join(buildDir, 'Dockerfile'), dockerfile);
    
    // Build image
    const { stdout, stderr } = await run(
      `docker build -t ${tag} ${buildDir}`,
      { timeout: LIMITS.buildTimeout, maxBuffer: LIMITS.maxBuffer }
    );
    
    // Get image ID
    const { stdout: imageId } = await run(
      `docker images -q ${tag}`
    );
    
    return {
      success: true,
      imageId: imageId.trim(),
      log: stdout + (stderr ? `\n${stderr}` : '')
    };
  } catch (err: any) {
    return {
      success: false,
      log: err.stdout || '' + '\n' + (err.stderr || err.message)
    };
  } finally {
    // Cleanup build directory
    await rm(buildDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Create a container from an image with a mounted volume
 * @param networkEnabled - If true, container can access the internet (default: false for security)
 */
export async function createContainerFromImage(
  imageId: string,
  name: string,
  volumeName: string,
  networkEnabled: boolean = false
): Promise<string> {
  const networkFlag = networkEnabled ? '' : '--network=none';
  const { stdout } = await run(`
    docker create \
      --name ${name} \
      --memory=${LIMITS.memory} \
      --cpus=${LIMITS.cpus} \
      ${networkFlag} \
      --workdir=/workspace \
      --mount source=${volumeName},target=/workspace \
      ${imageId} \
      sleep infinity
  `);
  
  return stdout.trim();
}

/**
 * Create a Docker volume
 */
export async function createVolume(name: string): Promise<void> {
  await run(`docker volume create ${name}`);
}

/**
 * Remove a Docker volume
 */
export async function removeVolume(name: string): Promise<void> {
  await run(`docker volume rm ${name}`).catch(() => {});
}

/**
 * Start a container
 */
export async function startContainer(name: string): Promise<void> {
  await run(`docker start ${name}`);
}

/**
 * Stop a container
 */
export async function stopContainer(name: string): Promise<void> {
  await run(`docker stop -t 5 ${name}`).catch(() => {});
}

/**
 * Remove a container
 */
export async function removeContainer(name: string): Promise<void> {
  await run(`docker rm -f ${name}`).catch(() => {});
}

/**
 * Remove a Docker image
 */
export async function removeImage(imageId: string): Promise<void> {
  await run(`docker rmi -f ${imageId}`).catch(() => {});
}

/**
 * Execute a command in a container
 */
export async function execInContainer(
  name: string,
  command: string,
  timeout: number = LIMITS.execTimeout
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await run(
      `docker exec ${name} sh -c ${JSON.stringify(command)}`,
      { timeout, maxBuffer: LIMITS.maxBuffer }
    );
    return { stdout, stderr, code: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || err.message,
      code: err.code || 1
    };
  }
}

/**
 * Copy a file to a container
 */
export async function copyToContainer(
  name: string,
  localPath: string,
  containerPath: string
): Promise<void> {
  await run(`docker cp ${localPath} ${name}:${containerPath}`);
}

/**
 * Copy a file from a container
 */
export async function copyFromContainer(
  name: string,
  containerPath: string,
  localPath: string
): Promise<void> {
  await run(`docker cp ${name}:${containerPath} ${localPath}`);
}

/**
 * Check if a container is running
 */
export async function isContainerRunning(name: string): Promise<boolean> {
  try {
    const { stdout } = await run(
      `docker inspect -f '{{.State.Running}}' ${name}`
    );
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Check if a container exists
 */
export async function containerExists(name: string): Promise<boolean> {
  try {
    await run(`docker inspect ${name}`);
    return true;
  } catch {
    return false;
  }
}
