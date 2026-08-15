import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const serverPath = resolve(import.meta.dirname, 'static-server.mjs');
const playwrightPath = resolve(projectRoot, '../../node_modules/@playwright/test/cli.js');

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolveExit) => {
    const timer = setTimeout(() => resolveExit(null), timeoutMs);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolveExit(code);
    });
  });
}

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:4173/demo/index.html');
      if (response.ok) return;
    } catch {
      // The server process is still binding. Retry until the explicit deadline.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error('The vanilla Gantt test server did not become ready within 10 seconds.');
}

const server = spawn(process.execPath, [serverPath], {
  cwd: projectRoot,
  stdio: ['ignore', 'inherit', 'inherit'],
  windowsHide: true,
});

let exitCode = 1;
try {
  await waitForServer();
  const runner = spawn(process.execPath, [playwrightPath, 'test', '--config', 'playwright.config.mjs'], {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
  exitCode = await waitForExit(runner, 120_000);
  if (exitCode === null) {
    runner.kill('SIGTERM');
    throw new Error('Playwright did not exit within 120 seconds.');
  }
} finally {
  server.kill('SIGTERM');
  if (await waitForExit(server, 1_000) === null) server.kill('SIGKILL');
}

process.exitCode = exitCode;
