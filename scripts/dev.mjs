import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const children = [];

const BACKEND_PORT = Number(process.env.PORT) || 3000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const VITE_BIN = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const SHOULD_OPEN = process.env.MEDREM_NO_OPEN !== '1';

let shuttingDown = false;
let viteUrl = null;
let viteBuf = '';

async function backendAlreadyRunning() {
  for (const path of ['/api/health', '/api/auth/me']) {
    try {
      const res = await fetch(`${BACKEND_URL}${path}`, { signal: AbortSignal.timeout(1500) });
      if (path === '/api/health') {
        const data = await res.json().catch(() => null);
        if (data?.app === 'medrem') return true;
      } else if (res.status === 401 || res.status === 200) {
        return true;
      }
    } catch {
      /* backend not reachable on this path — try the next probe */
    }
  }
  return false;
}

function openBrowser(url) {
  try {
    if (isWindows) {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    /* opening the browser is best-effort */
  }
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (isWindows) {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    /* ignore cleanup errors */
  }
}

function launch(cmd, args, name, { stdio = 'inherit', onData } = {}) {
  const child = spawn(cmd, args, { cwd: root, stdio });
  if (onData && child.stdout) child.stdout.on('data', onData);
  child.on('error', (err) => {
    if (name === 'tunnel') {
      console.warn(`[dev] public link unavailable: ${err.message} — LAN still works`);
      return;
    }
    console.error(`[dev] failed to start ${name}: ${err.message}`);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown || name === 'tunnel') return;
    console.error(`[dev] ${name} exited (code=${code}, signal=${signal}) — stopping everything`);
    shutdown(code ?? 0);
  });
  children.push({ child, name });
  return child;
}

function handleViteData(chunk) {
  process.stdout.write(chunk);
  if (viteUrl) return;
  viteBuf += chunk.toString();
  if (viteBuf.length > 8192) viteBuf = viteBuf.slice(-4096);
  const clean = viteBuf.replace(/\x1b\[[0-9;]*m/g, '');
  const match = clean.match(/https?:\/\/localhost:(\d+)\//);
  if (!match) return;
  viteUrl = match[0];
  if (SHOULD_OPEN) {
    console.log(`\n[dev] opening ${viteUrl} in your browser…\n`);
    openBrowser(viteUrl);
  } else {
    console.log(`\n[dev] MedRem is ready — open ${viteUrl}\n`);
  }
}

function launchTunnel() {
  const bin = join(root, 'scripts', 'cloudflared.exe');
  if (!existsSync(bin)) {
    console.warn('[dev] scripts/cloudflared.exe not found — public link disabled (LAN still works)');
    return;
  }
  const child = spawn(bin, ['tunnel', '--url', viteUrl || 'http://localhost:5173'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.on('error', (err) => {
    console.warn(`[dev] public link unavailable: ${err.message} — LAN still works`);
  });
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.warn(`[dev] public link stopped (code=${code}) — LAN still works`);
    }
  });
  let announced = false;
  let buf = '';
  child.stderr.on('data', (chunk) => {
    buf += chunk.toString();
    if (buf.length > 8192) buf = buf.slice(-4096);
    const m = buf.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !announced) {
      announced = true;
      const url = m[0];
      console.log('\n============================================================');
      console.log('  MedRem is live — open this link on ANY phone or computer:');
      console.log(`\n      ${url}\n`);
      console.log('  HTTPS link, works anywhere while this window stays open.');
      console.log('  (The link changes every time you restart.)');
      console.log('============================================================\n');
    }
  });
  children.push({ child, name: 'tunnel' });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[dev] shutting down MedRem and freeing its ports…');
  for (const { child } of children) killTree(child);
  setTimeout(() => process.exit(code), 400);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => {
  for (const { child } of children) killTree(child);
});

if (await backendAlreadyRunning()) {
  console.log(
    `[dev] a MedRem server is already running on ${BACKEND_URL} — reusing it instead of ` +
      'starting a second one.'
  );
} else {
  launch(process.execPath, ['server/index.js'], 'server');
}

launch(process.execPath, [VITE_BIN], 'vite', {
  stdio: ['inherit', 'pipe', 'inherit'],
  onData: handleViteData,
});

launchTunnel();
