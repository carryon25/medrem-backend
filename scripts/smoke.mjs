import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.MEDREM_URL || 'http://localhost:3000/';
const ORIGIN = new URL(BASE).origin;
const EMAIL = `maria${Date.now()}@example.com`;
const PORT = 9333;
const PROFILE = `${process.env.TEMP}\\medrem-e2e-${Date.now()}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--window-size=420,900',
  'about:blank',
]);
chrome.stderr.on('data', () => {});

let ws;
let msgId = 0;
const pending = new Map();

function connect() {
  return new Promise((resolve, reject) => {
    let connecting = false;
    const timer = setInterval(async () => {
      if (connecting) return;
      try {
        const list = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
        const page = list.find((t) => t.type === 'page');
        if (!page) return;
        connecting = true;
        clearInterval(timer);
        const socket = new WebSocket(page.webSocketDebuggerUrl);
        socket.onopen = () => {
          ws = socket;
          resolve();
        };
        socket.onclose = (e) => console.log('[ws closed]', e.reason || e.code);
        socket.onerror = () => reject(new Error('WebSocket connection failed'));
        socket.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
          }
          if (msg.method === 'Runtime.exceptionThrown') {
            const d = msg.params.exceptionDetails;
            console.log('[page exception]', d.exception?.description || d.text);
          }
          if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
            console.log('[http]', msg.params.response.status, msg.params.response.url);
          }
        };
      } catch {
        /* retry */
      }
    }, 300);
    setTimeout(() => {
      clearInterval(timer);
      reject(new Error('Could not connect to Chrome DevTools'));
    }, 15000);
  });
}

function send(method, params = {}) {
  return new Promise((resolve) => {
    if (ws.readyState !== WebSocket.OPEN) {
      console.log(`[send while ${ws.readyState}] ${method}`);
    }
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  const details = res.result?.exceptionDetails;
  if (details) throw new Error(details.exception?.description || JSON.stringify(details));
  return res.result.result.value;
}

async function goto(hash) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`);
  await sleep(700);
}

const bodyText = () => evaluate('document.body.innerText');

const SETTER = (sel, value) => `
(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return 'MISSING: ' + ${JSON.stringify(sel)};
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype
    : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto.prototype || proto, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`;

function assert(cond, label) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

try {
  await connect();
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');

  await send('Page.navigate', { url: BASE });
  await sleep(2500);

  let text = await bodyText();
  assert(text.includes('Welcome back'), 'login page renders');
  assert(await evaluate('!!location.hash.includes("/login")'), 'root redirects to login when logged out');
  assert(
    await evaluate(`!!document.querySelector('link[rel="manifest"]')`),
    'web app manifest linked (phone installable)'
  );
  assert(
    await evaluate(`navigator.serviceWorker.getRegistration().then((r) => !!r)`),
    'service worker registered (offline / PWA)'
  );

  await goto('#/signup');
  text = await bodyText();
  assert(text.includes('Create your account'), 'signup page renders');

  const setterResults = [];
  setterResults.push(await evaluate(SETTER('input[placeholder="e.g. Maria Santos"]', 'Maria Santos')));
  setterResults.push(await evaluate(SETTER('input[type="email"]', EMAIL)));
  setterResults.push(await evaluate(SETTER('input[autocomplete="new-password"]', 'secret123')));
  setterResults.push(await evaluate(SETTER('input[placeholder="Repeat password"]', 'secret123')));
  setterResults.push(await evaluate(SETTER('select', 'Female')));
  setterResults.push(await evaluate(SETTER('input[type="date"]', '1985-04-12')));
  setterResults.push(
    await evaluate(SETTER('textarea', '123 Rizal St, Quezon City, Metro Manila'))
  );
  assert(setterResults.every((r) => r === 'ok'), `signup fields filled (${setterResults.join(', ')})`);

  const age = await evaluate(
    `document.querySelectorAll('input[readonly]')[0].value`
  );
  assert(age === '41', `age auto-calculated from birthdate (got "${age}")`);

  await evaluate('document.querySelector("form.auth-card").requestSubmit()');
  await sleep(2500);

  text = await bodyText();
  assert(text.includes("Today's schedule"), 'signup logs in and dashboard renders');
  assert(text.includes('Maria'), 'dashboard greets the new user');
  const sessionId = await evaluate(`localStorage.getItem('medrem.session')`);
  assert(Boolean(sessionId), 'session stored after signup');

  assert(
    await evaluate(`!!document.querySelector('.theme-toggle')`),
    'dark mode toggle button shown in top bar'
  );
  await evaluate(`document.querySelector('.theme-toggle').click()`);
  await sleep(300);
  assert(
    (await evaluate(`document.documentElement.dataset.theme`)) === 'dark',
    'dark mode turns on when toggled'
  );
  await evaluate(`document.querySelector('.theme-toggle').click()`);
  await sleep(300);
  assert(
    (await evaluate(`document.documentElement.dataset.theme`)) === 'light',
    'light mode restores when toggled again'
  );

  assert(
    await evaluate(`!document.querySelector('.topbar-back')`),
    'back arrow hidden on dashboard home'
  );

  await goto('#/medications');
  text = await bodyText();
  assert(text.includes('Medicines'), 'medications page renders');
  assert(
    await evaluate(`!!document.querySelector('.topbar-back')`),
    'back arrow shown in top app bar'
  );

  await evaluate(
    'Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("+ Add medication")).click()'
  );
  await sleep(400);
  await evaluate(SETTER('input[placeholder="e.g. Amoxicillin"]', 'Amoxicillin'));
  await evaluate(SETTER('input[placeholder="e.g. 500 mg, 1 tablet"]', '500 mg, 1 capsule'));
  const doseTime = await evaluate(`(() => {
    const offset = new Date().getHours() >= 22 ? 30 : 90;
    const d = new Date(Date.now() + offset * 60000);
    let h = d.getHours();
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + '|' + String(d.getMinutes()).padStart(2, '0') + '|' + period;
  })()`);
  const [dHour, dMinute, dPeriod] = doseTime.split('|');
  const doseLabel = `${dHour}:${dMinute} ${dPeriod}`;
  await evaluate(SETTER('form.form select[aria-label="Hour"]', dHour));
  await evaluate(SETTER('form.form select[aria-label="Minute"]', dMinute));
  await evaluate(SETTER('form.form select[aria-label="AM or PM"]', dPeriod));
  await evaluate(SETTER('form.form select:not([aria-label])', '15'));
  await evaluate('document.querySelector("form.form").requestSubmit()');
  await sleep(900);

  text = await bodyText();
  assert(text.includes('Amoxicillin'), 'medication saved and listed');
  assert(text.includes(doseLabel), `dose time displayed in AM/PM format (${doseLabel})`);
  assert(text.includes('15 minutes before'), 'advance medication reminder displayed');
  assert(text.includes('Every day'), 'medication schedule shown');

  await evaluate(
    'Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("+ Add medication")).click()'
  );
  await sleep(400);
  await evaluate(SETTER('input[placeholder="e.g. Amoxicillin"]', 'Ibuprofen'));
  await evaluate(SETTER('input[placeholder="e.g. 500 mg, 1 tablet"]', '200 mg'));
  await evaluate(SETTER('form.form input[type="date"]', '2027-01-01'));
  await evaluate('document.querySelector("form.form").requestSubmit()');
  await sleep(900);

  text = await bodyText();
  assert(text.includes('Ibuprofen'), 'future-dated medication saved and listed');
  assert(text.includes('Starts 2027-01-01'), 'future start date badge shown on medication card');

  await evaluate(`document.querySelector('.topbar-back').click()`);
  await sleep(600);
  assert(
    (await evaluate(`location.hash`)) === '#/dashboard',
    'back arrow returns to dashboard'
  );

  await goto('#/checkups');
  await evaluate(
    'Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("+ Schedule check-up")).click()'
  );
  await sleep(400);
  await evaluate(SETTER('input[placeholder="e.g. Dr. Sarah Lee"]', 'Dr. Sarah Lee'));
  await evaluate(SETTER('form.form input[type="date"]', '2026-11-05'));
  await evaluate(SETTER('form.form select[aria-label="Hour"]', '2'));
  await evaluate(SETTER('form.form select[aria-label="Minute"]', '30'));
  await evaluate(SETTER('form.form select[aria-label="AM or PM"]', 'PM'));
  await evaluate(SETTER('form.form select:not([aria-label])', '1440'));
  await evaluate('document.querySelector("form.form").requestSubmit()');
  await sleep(900);

  text = await bodyText();
  assert(text.includes('Dr. Sarah Lee'), 'check-up with doctor saved');
  assert(text.includes('2:30 PM'), 'check-up time displayed in AM/PM format');
  assert(text.includes('1 day before'), 'advance check-up reminder displayed');

  await evaluate(`document.querySelector('.bell-btn').click()`);
  await sleep(300);
  text = await bodyText();
  assert(await evaluate(`!!document.querySelector('.bell-panel')`), 'notification bell panel opens');
  assert(
    text.toLowerCase().includes('upcoming schedule'),
    'bell shows upcoming schedule section'
  );
  assert(text.includes('Amoxicillin'), 'bell lists upcoming medication');
  assert(
    !text.includes('Ibuprofen'),
    'bell hides medication before its start date'
  );
  assert(
    await evaluate(`!!document.querySelector('.bell-enable')`),
    'bell offers enable-notifications button'
  );
  await evaluate(`document.querySelector('.bell-btn').click()`);
  await sleep(250);
  assert(await evaluate(`!document.querySelector('.bell-panel')`), 'bell panel closes again');

  await send('Browser.setPermission', {
    permission: { name: 'notifications' },
    setting: 'granted',
    origin: ORIGIN,
  });
  await send('Browser.setPermission', {
    permission: { name: 'notifications' },
    setting: 'granted',
    origin: ORIGIN,
  });
  await sleep(300);
  if ((await evaluate(`Notification.permission`)) !== 'granted') {
    await evaluate(`document.querySelector('.bell-btn').click()`);
    await sleep(250);
    if (await evaluate(`!!document.querySelector('.bell-enable button')`)) {
      await evaluate(`document.querySelector('.bell-enable button').click()`);
      await sleep(500);
    }
    await evaluate(`document.querySelector('.bell-btn').click()`);
  }
  assert(
    (await evaluate(`Notification.permission`)) === 'granted',
    'notifications permission granted'
  );

  const swShow = await evaluate(`(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return 'no-registration';
      await reg.showNotification('MedRem test', {
        body: 'testing phone notifications',
        tag: 'smoke-test',
      });
      return 'ok';
    } catch (e) {
      return 'error: ' + e.message;
    }
  })()`);
  assert(
    swShow === 'ok',
    `notification displayed from service worker / phone path (${swShow})`
  );

  await evaluate(`document.querySelector('.bell-btn').click()`);
  await sleep(250);
  assert(
    await evaluate(`!document.querySelector('.bell-enable')`),
    'enable prompt hidden once permission granted'
  );
  assert(
    await evaluate(`!!document.querySelector('.bell-status')`),
    'bell shows notifications-are-on status'
  );
  assert(
    (await bodyText()).includes('fully closed'),
    'bell explains background/closed-app limitation'
  );
  await evaluate(`document.querySelector('.bell-btn').click()`);
  await sleep(200);

  await evaluate(
    `localStorage.setItem('medrem.alerts', JSON.stringify([{ id: 'test|1', title: 'Medication reminder', body: 'Injected test alert', at: Date.now(), read: false }]))`
  );
  await send('Page.navigate', { url: BASE });
  await sleep(2000);
  text = await bodyText();
  assert(text.includes("Today's schedule"), 'still logged in after alert injection reload');
  assert(
    (await evaluate(`document.querySelector('.bell-badge')?.textContent || ''`)).trim() === '1',
    'unread badge shows alert count'
  );

  await evaluate(`document.querySelector('.bell-btn').click()`);
  await sleep(300);
  text = await bodyText();
  assert(text.includes('Injected test alert'), 'alert listed in panel');
  assert(text.includes('Mark all as read'), 'mark-all-as-read option offered');
  assert(await evaluate(`!!document.querySelector('.bell-alert.unread')`), 'alert styled as unread');
  assert(
    (await evaluate(`JSON.parse(localStorage.getItem('medrem.alerts'))[0].read`)) === false,
    'opening the panel does not auto-mark alerts as read'
  );

  await evaluate(
    `Array.from(document.querySelectorAll('.bell-head button')).find(b => b.textContent.includes('Mark all as read')).click()`
  );
  await sleep(300);
  assert(
    (await evaluate(`JSON.parse(localStorage.getItem('medrem.alerts'))[0].read`)) === true,
    'mark all as read works'
  );
  assert(await evaluate(`!document.querySelector('.bell-badge')`), 'badge clears after marking read');
  assert(
    (await bodyText()).includes('All caught up'),
    'head shows all-caught-up after marking read'
  );

  await evaluate(
    `Array.from(document.querySelectorAll('.bell-section-head button')).find(b => b.textContent.trim() === 'Clear').click()`
  );
  await sleep(250);
  assert(await evaluate(`!!document.querySelector('.bell-confirm')`), 'clear asks for confirmation');
  await evaluate(`document.querySelectorAll('.bell-confirm button')[0].click()`);
  await sleep(250);
  assert(
    (await evaluate(`JSON.parse(localStorage.getItem('medrem.alerts')).length`)) === 1,
    'cancel keeps alerts'
  );
  assert(
    await evaluate(`!document.querySelector('.bell-confirm')`),
    'confirmation closes on cancel'
  );

  await evaluate(
    `Array.from(document.querySelectorAll('.bell-section-head button')).find(b => b.textContent.trim() === 'Clear').click()`
  );
  await sleep(250);
  await evaluate(`document.querySelectorAll('.bell-confirm button')[1].click()`);
  await sleep(250);
  assert(
    (await evaluate(`JSON.parse(localStorage.getItem('medrem.alerts')).length`)) === 0,
    'confirmed clear removes alerts'
  );
  assert(await evaluate(`!document.querySelector('.bell-badge')`), 'badge hidden after clear');
  await evaluate(`document.querySelector('.bell-btn').click()`);
  await sleep(200);

  await goto('#/dashboard');
  text = await bodyText();
  assert(text.includes('Amoxicillin'), 'dashboard shows todays medication schedule');
  assert(text.includes('Dr. Sarah Lee'), 'dashboard shows next check-up doctor');
  assert(
    (await evaluate(
      `Array.from(document.querySelectorAll('.dose-row')).some((r) => r.textContent.includes('Ibuprofen'))`
    )) === false,
    'medication hidden from todays schedule before start date'
  );
  assert(
    text.includes('Ibuprofen starts 2027-01-01'),
    'dashboard notes medication that has not started yet'
  );
  assert(
    text.includes('Reminder notifications are on'),
    'dashboard shows notification-enabled status'
  );

  const undoFlow = await evaluate(`(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const row = () =>
      Array.from(document.querySelectorAll('.dose-row')).find((r) =>
        r.textContent.includes('Amoxicillin')
      );
    const clickBtn = (label) => {
      const r = row();
      if (!r) return 'no-row';
      const btn = Array.from(r.querySelectorAll('.dose-actions .btn')).find(
        (b) => b.textContent.trim() === label
      );
      if (!btn) return 'no-' + label;
      btn.click();
      return 'ok';
    };
    const badge = () => row()?.querySelector('.badge')?.textContent.trim() || 'no-row';
    const out = [];
    out.push(clickBtn('Take'));
    await pause(500);
    out.push(badge());
    out.push(clickBtn('Undo'));
    await pause(500);
    out.push(badge());
    out.push(clickBtn('Skip'));
    await pause(500);
    out.push(badge());
    out.push(clickBtn('Undo'));
    await pause(500);
    out.push(badge());
    return out.join('|');
  })()`);
  assert(
    undoFlow === 'ok|taken|ok|upcoming|ok|skipped|ok|upcoming',
    `take/skip undo returns dose to unrecorded (got ${undoFlow})`
  );

  await goto('#/profile');
  text = await bodyText();
  assert(text.includes(EMAIL), 'profile shows account email');
  assert(text.includes('123 Rizal St'), 'profile shows saved address');
  assert(text.includes('Appearance'), 'appearance settings shown');
  assert(text.includes('Match system'), 'system/light/dark choices shown');
  await evaluate(
    `Array.from(document.querySelectorAll('.segmented button')).find((b) => b.textContent === 'Dark').click()`
  );
  await sleep(300);
  assert(
    (await evaluate(`document.documentElement.dataset.theme`)) === 'dark',
    'dark mode selectable from profile'
  );
  assert(
    (await evaluate(`localStorage.getItem('medrem.theme')`)) === 'dark',
    'theme choice persisted'
  );
  assert(
    text.toLowerCase().includes('add to home screen') || text.toLowerCase().includes('download app'),
    'download/install app option shown'
  );

  await send('Page.navigate', { url: BASE });
  await sleep(2000);
  text = await bodyText();
  assert(text.includes("Today's schedule"), 'reload keeps user logged in (SQLite persisted)');

  assert(await evaluate('location.hash') === '#/dashboard', 'still on dashboard after reload');

  console.log('\nAll smoke tests passed.');
} catch (err) {
  console.error(err.message || err);
  try {
    const tail = await evaluate('document.body.innerText.slice(0, 600)');
    console.error('--- page text at failure ---\n' + tail + '\n---');
  } catch {
    /* page unavailable */
  }
  process.exitCode = 1;
} finally {
  ws?.close();
  spawn('taskkill', ['/pid', String(chrome.pid), '/t', '/f']);
  setTimeout(() => {
    try {
      rmSync(PROFILE, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch {
      /* temp folder cleanup is best-effort */
    }
    process.exit(process.exitCode || 0);
  }, 1500);
}
