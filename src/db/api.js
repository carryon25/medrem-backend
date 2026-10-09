const SESSION_KEY = 'medrem.session';

function token() {
  return localStorage.getItem(SESSION_KEY);
}

function setToken(value) {
  if (value) localStorage.setItem(SESSION_KEY, value);
  else localStorage.removeItem(SESSION_KEY);
}

async function req(method, path, body) {
  const headers = {};
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      'Cannot reach the MedRem server. Make sure MedRem is running on your laptop and your phone is on the same Wi-Fi.'
    );
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    throw new Error(
      data?.error ||
        'The MedRem server returned an unexpected response. Restart MedRem on your laptop and try again.'
    );
  }
  if (data === null) {
    throw new Error(
      'The MedRem server returned an unexpected response. Restart MedRem on your laptop and try again.'
    );
  }
  return data;
}

export function ageFromBirthdate(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// ---------- auth ----------

export async function createUser(data) {
  const res = await req('POST', '/auth/signup', data);
  setToken(res.token);
  return res.user;
}

export async function authenticate(email, password) {
  const res = await req('POST', '/auth/login', { email, password });
  setToken(res.token);
  return res.user;
}

export async function getPublicUser() {
  return req('GET', '/auth/me');
}

export async function endSession() {
  try {
    if (token()) await req('POST', '/auth/logout');
  } finally {
    setToken(null);
  }
}

export async function updateUser(fields) {
  return req('PUT', '/auth/profile', fields);
}

export async function changePassword(_id, currentPassword, newPassword) {
  await req('PUT', '/auth/password', { currentPassword, newPassword });
}

// ---------- medications ----------

export function listMeds() {
  return req('GET', '/meds');
}

export function addMed(_userId, med) {
  return req('POST', '/meds', med);
}

export function updateMed(id, med) {
  return req('PUT', `/meds/${id}`, med);
}

export function deleteMed(id) {
  return req('DELETE', `/meds/${id}`);
}

// ---------- dose logs ----------

export function todayLogs(_userId, date) {
  return req('GET', `/logs?date=${encodeURIComponent(date)}`);
}

export function logDose(_userId, medId, date, time, status) {
  return req('POST', '/logs', { medId, date, time, status });
}

export function removeLog(medId, date, time) {
  return req(
    'DELETE',
    `/logs?medId=${medId}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`
  );
}

// ---------- checkups ----------

export function listCheckups() {
  return req('GET', '/checkups');
}

export function addCheckup(_userId, c) {
  return req('POST', '/checkups', c);
}

export function updateCheckup(id, c) {
  return req('PUT', `/checkups/${id}`, c);
}

export function deleteCheckup(id) {
  return req('DELETE', `/checkups/${id}`);
}
