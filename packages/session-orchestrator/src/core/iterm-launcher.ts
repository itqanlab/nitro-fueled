import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface LaunchOptions {
  prompt: string;
  workingDirectory: string;
  label: string;
  model: string;
}

export interface LaunchResult {
  pid: number;
  itermSessionId: string;
}

export async function launchInIterm(opts: LaunchOptions): Promise<LaunchResult> {
  const escapedPrompt = opts.prompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "'\\''");

  const command = [
    `cd '${opts.workingDirectory}'`,
    '&&',
    'claude',
    '--dangerously-skip-permissions',
    '--model', opts.model,
    `'${escapedPrompt}'`,
  ].join(' ');

  // Escape for AppleScript double-quoted string context
  const asCommand = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const asLabel = opts.label.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const result = await createNewWindowScript(asCommand, asLabel);

  const parts = result.split('||');
  const itermSessionId = parts[0];
  const tty = parts[1];

  // Wait briefly then find the PID of the claude process on this specific tty
  await new Promise((r) => setTimeout(r, 2000));
  const pid = await findClaudePidByTty(tty);
  return { pid, itermSessionId };
}

/** Create a new iTerm window for each worker */
async function createNewWindowScript(asCommand: string, asLabel: string): Promise<string> {
  const script = `
tell application "iTerm"
  set newWindow to (create window with default profile)
  tell current session of current tab of newWindow
    set name to "${asLabel}"
    write text "${asCommand}"
  end tell
  set newSession to current session of current tab of newWindow
  set sessionId to unique ID of newSession
  set sessionTty to tty of newSession
  return sessionId & "||" & sessionTty
end tell
  `.trim();

  const { stdout } = await execFileAsync('osascript', ['-e', script]);
  return stdout.trim();
}

/** Find claude PID by the specific tty of its iTerm session */
async function findClaudePidByTty(tty: string): Promise<number> {
  const ttyName = tty.replace('/dev/', '');

  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));

    // macOS pgrep -t doesn't work reliably, use ps -t instead
    const { stdout } = await execFileAsync('ps', ['-t', ttyName, '-o', 'pid,comm'], {
      timeout: 5000,
    }).catch(() => ({ stdout: '' }));

    const lines = stdout.trim().split('\n');
    const claudePids: number[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('claude')) {
        const pid = parseInt(trimmed.split(/\s+/)[0], 10);
        if (!isNaN(pid)) claudePids.push(pid);
      }
    }
    if (claudePids.length > 0) return Math.max(...claudePids);
  }

  throw new Error(`Could not find claude process on tty ${ttyName}`);
}

export async function killProcess(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 'SIGTERM');
    // Give it 5s to clean up, then force kill
    await new Promise((r) => setTimeout(r, 5000));
    try {
      process.kill(pid, 0); // Check if still alive
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already dead — good
    }
    return true;
  } catch {
    return false;
  }
}

export async function closeItermSession(itermSessionId: string): Promise<boolean> {
  if (!itermSessionId) return false;

  const script = `
tell application "iTerm"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if unique ID of aSession is "${itermSessionId}" then
          tell aSession to close
          return "closed"
        end if
      end repeat
    end repeat
  end repeat
  return "not_found"
end tell
  `.trim();

  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script]);
    return stdout.trim() === 'closed';
  } catch {
    return false;
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
