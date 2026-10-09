import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get, run } from './db.js';
import {
  auth,
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from './auth.js';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'medrem' });
});

function publicUser(row) {
  if (!row) return null;
  const { password_hash: _hash, ...user } = row;
  return user;
}

function ageFromBirthdate(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function fail(res, err, fallback = 'Something went wrong. Please try again.') {
  const status = err?.status || 500;
  res.status(status).json({ error: err?.message || fallback });
}

function ownedRecord(res, table, id, userId) {
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid id.' });
    return null;
  }
  const row = get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!row || row.user_id !== userId) {
    res.status(404).json({ error: 'Not found.' });
    return null;
  }
  return row;
}

// ---------- auth ----------

app.post('/api/auth/signup', (req, res) => {
  try {
    const { name, email, password, gender, birthdate, address, profilePicture } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password) {
      throw Object.assign(new Error('Name, email and password are required.'), { status: 400 });
    }
    if (password.length < 6) {
      throw Object.assign(new Error('Password must be at least 6 characters.'), { status: 400 });
    }
    const normEmail = email.toLowerCase().trim();
    if (get('SELECT id FROM users WHERE email = ?', [normEmail])) {
      throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
    }
    run(
      `INSERT INTO users (name, email, password_hash, gender, birthdate, age, address, profile_picture)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        normEmail,
        hashPassword(password),
        gender || null,
        birthdate || null,
        ageFromBirthdate(birthdate),
        (address || '').trim(),
        profilePicture || null,
      ]
    );
    const user = get('SELECT * FROM users WHERE email = ?', [normEmail]);
    const token = createSession(user.id);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = get('SELECT * FROM users WHERE email = ?', [
      String(email || '').toLowerCase().trim(),
    ]);
    if (!user) {
      throw Object.assign(new Error('No account found with this email.'), { status: 404 });
    }
    if (!verifyPassword(String(password || ''), user.password_hash)) {
      throw Object.assign(new Error('Incorrect password. Please try again.'), { status: 401 });
    }
    const token = createSession(user.id);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/auth/logout', auth, (req, res) => {
  destroySession(req.token);
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json(publicUser(req.user));
});

app.put('/api/auth/profile', auth, (req, res) => {
  try {
    const fields = req.body || {};
    const cols = [];
    const vals = [];
    const set = (col, val) => {
      cols.push(`${col} = ?`);
      vals.push(val);
    };
    if (fields.name !== undefined) set('name', String(fields.name).trim());
    if (fields.email !== undefined) {
      const normEmail = String(fields.email).toLowerCase().trim();
      const taken = get('SELECT id FROM users WHERE email = ? AND id != ?', [normEmail, req.user.id]);
      if (taken) {
        throw Object.assign(new Error('That email is already used by another account.'), {
          status: 409,
        });
      }
      set('email', normEmail);
    }
    if (fields.gender !== undefined) set('gender', fields.gender);
    if (fields.birthdate !== undefined) {
      set('birthdate', fields.birthdate);
      set('age', ageFromBirthdate(fields.birthdate));
    }
    if (fields.address !== undefined) set('address', String(fields.address).trim());
    if (fields.profilePicture !== undefined) set('profile_picture', fields.profilePicture || null);
    if (cols.length) {
      vals.push(req.user.id);
      run(`UPDATE users SET ${cols.join(', ')} WHERE id = ?`, vals);
    }
    res.json(publicUser(get('SELECT * FROM users WHERE id = ?', [req.user.id])));
  } catch (err) {
    fail(res, err);
  }
});

app.put('/api/auth/password', auth, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!verifyPassword(String(currentPassword || ''), req.user.password_hash)) {
      throw Object.assign(new Error('Current password is incorrect.'), { status: 401 });
    }
    if (String(newPassword || '').length < 6) {
      throw Object.assign(new Error('New password must be at least 6 characters.'), { status: 400 });
    }
    run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(newPassword), req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// ---------- medications ----------

function decodeMed(m) {
  return {
    ...m,
    times: JSON.parse(m.times || '[]'),
    days: JSON.parse(m.days || '[0,1,2,3,4,5,6]'),
  };
}

app.get('/api/meds', auth, (req, res) => {
  const meds = all('SELECT * FROM medications WHERE user_id = ? ORDER BY name', [req.user.id]);
  res.json(meds.map(decodeMed));
});

app.post('/api/meds', auth, (req, res) => {
  try {
    const med = req.body || {};
    if (!med.name?.trim() || !med.dosage?.trim()) {
      throw Object.assign(new Error('Name and dosage are required.'), { status: 400 });
    }
    if (!Array.isArray(med.times) || !med.times.length) {
      throw Object.assign(new Error('Add at least one time.'), { status: 400 });
    }
    run(
      `INSERT INTO medications (user_id, name, dosage, times, days, instructions, start_date, remind_before, refill_total, refill_remaining, low_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        med.name.trim(),
        med.dosage.trim(),
        JSON.stringify(med.times),
        JSON.stringify(Array.isArray(med.days) && med.days.length ? med.days : [0, 1, 2, 3, 4, 5, 6]),
        med.instructions || null,
        med.startDate || null,
        Number(med.remindBefore) || 0,
        med.refillTotal || null,
        med.refillTotal || null,
        med.lowThreshold ?? 5,
      ]
    );
    const id = get('SELECT MAX(id) AS id FROM medications').id;
    res.status(201).json({ id });
  } catch (err) {
    fail(res, err);
  }
});

app.put('/api/meds/:id', auth, (req, res) => {
  try {
    const existing = ownedRecord(res, 'medications', Number(req.params.id), req.user.id);
    if (!existing) return;
    const med = req.body || {};
    run(
      `UPDATE medications SET name = ?, dosage = ?, times = ?, days = ?, instructions = ?,
       start_date = ?, remind_before = ?, refill_total = ?, refill_remaining = ?, low_threshold = ? WHERE id = ?`,
      [
        String(med.name || '').trim(),
        String(med.dosage || '').trim(),
        JSON.stringify(med.times || []),
        JSON.stringify(Array.isArray(med.days) && med.days.length ? med.days : existing.days && JSON.parse(existing.days).length ? JSON.parse(existing.days) : [0, 1, 2, 3, 4, 5, 6]),
        med.instructions || null,
        med.startDate || null,
        Number(med.remindBefore) || 0,
        med.refillTotal || null,
        med.refillRemaining ?? null,
        med.lowThreshold ?? 5,
        existing.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

app.delete('/api/meds/:id', auth, (req, res) => {
  const existing = ownedRecord(res, 'medications', Number(req.params.id), req.user.id);
  if (!existing) return;
  run('DELETE FROM dose_logs WHERE med_id = ?', [existing.id]);
  run('DELETE FROM medications WHERE id = ?', [existing.id]);
  res.json({ ok: true });
});

// ---------- dose logs ----------

app.get('/api/logs', auth, (req, res) => {
  const date = String(req.query.date || '');
  if (!date) return res.status(400).json({ error: 'A date is required.' });
  res.json(all('SELECT * FROM dose_logs WHERE user_id = ? AND dose_date = ?', [req.user.id, date]));
});

app.post('/api/logs', auth, (req, res) => {
  try {
    const { medId, date, time, status } = req.body || {};
    const med = ownedRecord(res, 'medications', Number(medId), req.user.id);
    if (!med) return;
    if (!date || !time || !['taken', 'skipped', 'missed'].includes(status)) {
      throw Object.assign(new Error('Invalid dose entry.'), { status: 400 });
    }
    const existing = get(
      'SELECT status FROM dose_logs WHERE med_id = ? AND dose_date = ? AND dose_time = ?',
      [med.id, date, time]
    );
    run(
      `INSERT INTO dose_logs (user_id, med_id, dose_date, dose_time, status, logged_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (med_id, dose_date, dose_time)
       DO UPDATE SET status = excluded.status, logged_at = datetime('now')`,
      [req.user.id, med.id, date, time, status]
    );
    if (status === 'taken' && (!existing || existing.status !== 'taken')) {
      run(
        `UPDATE medications SET refill_remaining = refill_remaining - 1
         WHERE id = ? AND refill_remaining IS NOT NULL AND refill_remaining > 0`,
        [med.id]
      );
    }
    if (existing && existing.status === 'taken' && status !== 'taken') {
      run(
        `UPDATE medications SET refill_remaining = refill_remaining + 1
         WHERE id = ? AND refill_total IS NOT NULL`,
        [med.id]
      );
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

app.delete('/api/logs', auth, (req, res) => {
  const medId = Number(req.query.medId);
  const date = String(req.query.date || '');
  const time = String(req.query.time || '');
  const med = ownedRecord(res, 'medications', medId, req.user.id);
  if (!med) return;
  const existing = get(
    'SELECT status FROM dose_logs WHERE med_id = ? AND dose_date = ? AND dose_time = ?',
    [med.id, date, time]
  );
  if (existing?.status === 'taken') {
    run(
      `UPDATE medications SET refill_remaining = refill_remaining + 1
       WHERE id = ? AND refill_total IS NOT NULL`,
      [med.id]
    );
  }
  run('DELETE FROM dose_logs WHERE med_id = ? AND dose_date = ? AND dose_time = ?', [
    med.id,
    date,
    time,
  ]);
  res.json({ ok: true });
});

// ---------- checkups ----------

app.get('/api/checkups', auth, (req, res) => {
  res.json(
    all('SELECT * FROM checkups WHERE user_id = ? ORDER BY datetime ASC', [req.user.id])
  );
});

app.post('/api/checkups', auth, (req, res) => {
  try {
    const c = req.body || {};
    if (!c.doctor?.trim() || !c.datetime) {
      throw Object.assign(new Error('Doctor and date/time are required.'), { status: 400 });
    }
    run(
      `INSERT INTO checkups (user_id, title, doctor, specialty, datetime, remind_before, location, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        c.title || null,
        c.doctor.trim(),
        c.specialty || null,
        c.datetime,
        Number(c.remindBefore) || 60,
        c.location || null,
        c.notes || null,
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

app.put('/api/checkups/:id', auth, (req, res) => {
  try {
    const existing = ownedRecord(res, 'checkups', Number(req.params.id), req.user.id);
    if (!existing) return;
    const c = req.body || {};
    run(
      'UPDATE checkups SET title = ?, doctor = ?, specialty = ?, datetime = ?, remind_before = ?, location = ?, notes = ? WHERE id = ?',
      [
        c.title || null,
        String(c.doctor || '').trim(),
        c.specialty || null,
        c.datetime,
        Number(c.remindBefore) || 60,
        c.location || null,
        c.notes || null,
        existing.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

app.delete('/api/checkups/:id', auth, (req, res) => {
  const existing = ownedRecord(res, 'checkups', Number(req.params.id), req.user.id);
  if (!existing) return;
  run('DELETE FROM checkups WHERE id = ?', [existing.id]);
  res.json({ ok: true });
});

// ---------- static app ----------

app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(join(dist, 'index.html'));
  } else {
    next();
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.error('[api]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Server error. Please try again.',
    });
  } else {
    console.error(err);
    res.status(500).send('Server error');
  }
});

const server = app.listen(PORT, () => {
  if (!server.listening) return;
  console.log(`MedRem server running at http://localhost:${PORT}`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use — another MedRem server is still running. Close it (or run: taskkill /f /im node.exe) and try again.`
    );
  } else {
    console.error(`Server failed to start: ${err.message}`);
  }
  process.exit(1);
});
