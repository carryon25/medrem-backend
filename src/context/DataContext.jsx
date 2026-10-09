import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { listCheckups, listMeds, logDose, removeLog, todayLogs } from '../db/api';
import { formatDateTime, formatTime, leadPhrase } from '../utils/format';
import { showNotification } from '../utils/notify';

const DataContext = createContext(null);

export const pad = (n) => String(n).padStart(2, '0');
export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTimeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const WINDOW_MS = 3 * 60 * 1000;
const NOTIFIED_KEY = 'medrem.notified';
const ALERTS_KEY = 'medrem.alerts';

function loadAlerts() {
  try {
    return JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAlerts(list) {
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(list));
  } catch {
    // storage full / private mode
  }
}

function loadNotified() {
  try {
    const all = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}');
    const cutoff = Date.now() - 48 * 3600 * 1000;
    return Object.fromEntries(Object.entries(all).filter(([, t]) => t > cutoff));
  } catch {
    return {};
  }
}

function markNotified(key) {
  const all = loadNotified();
  all[key] = Date.now();
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(all));
  } catch {
    // storage full / private mode — reminders still work for this session
  }
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [meds, setMeds] = useState([]);
  const [logs, setLogs] = useState([]);
  const [checkups, setCheckups] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [alerts, setAlerts] = useState(loadAlerts);

  const refresh = useCallback(async () => {
    if (!user) {
      setMeds([]);
      setLogs([]);
      setCheckups([]);
      return;
    }
    const [m, l, c] = await Promise.all([
      listMeds(user.id),
      todayLogs(user.id, toDateStr(new Date())),
      listCheckups(user.id),
    ]);
    setMeds(m);
    setLogs(l);
    setCheckups(c);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pushToast = useCallback((text) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 8000);
  }, []);

  const markDose = useCallback(
    async (medId, time, status) => {
      const now = new Date();
      try {
        await logDose(user.id, medId, toDateStr(now), time, status);
        await refresh();
        if (status === 'taken') pushToast('Dose marked as taken.');
        if (status === 'skipped') pushToast('Dose marked as skipped.');
      } catch (err) {
        pushToast(err.message || 'Could not save that dose.');
      }
    },
    [user, refresh, pushToast]
  );

  const undoDose = useCallback(
    async (medId, time) => {
      try {
        await removeLog(medId, toDateStr(new Date()), time);
        await refresh();
        pushToast('Dose cleared — no longer recorded as taken or skipped.');
      } catch (err) {
        pushToast(err.message || 'Could not undo that dose.');
      }
    },
    [refresh, pushToast]
  );

  useEffect(() => {
    if (!user) return undefined;

    const fire = (key, title, body) => {
      const notified = loadNotified();
      if (notified[key]) return;
      markNotified(key);
      showNotification(title, { body, tag: key }).catch(() => {});
      pushToast(body);
      setAlerts((prev) => {
        const next = [{ id: key, title, body, at: Date.now(), read: false }, ...prev].slice(0, 30);
        saveAlerts(next);
        return next;
      });
    };

    const check = (windowMs = WINDOW_MS) => {
      const nowMs = Date.now();
      const now = new Date(nowMs);
      const today = toDateStr(now);
      const weekday = (now.getDay() + 6) % 7;

      for (const med of meds) {
        if (!med.days.includes(weekday)) continue;
        if (med.start_date && med.start_date > today) continue;
        const lead = Number(med.remind_before) || 0;
        for (const time of med.times) {
          const [h, m] = time.split(':').map(Number);
          const due = new Date(now);
          due.setHours(h, m, 0, 0);
          const notifyAt = due.getTime() - lead * 60000;
          const diff = nowMs - notifyAt;
          if (diff < 0 || diff >= windowMs) continue;
          const logged = logs.some(
            (l) => l.med_id === med.id && l.dose_date === today && l.dose_time === time
          );
          if (logged) continue;
          const when = lead ? `Reminder: ${med.name} (${med.dosage}) ${leadPhrase(lead)}, at ${formatTime(time)}.` : `It's time for ${med.name} (${med.dosage}) at ${formatTime(time)}.`;
          fire(`med|${med.id}|${today}|${time}|${lead}`, 'Medication reminder', when);
        }
      }

      for (const c of checkups) {
        const whenMs = new Date(c.datetime).getTime();
        if (Number.isNaN(whenMs)) continue;
        const lead = Number(c.remind_before ?? 60);
        const notifyAt = whenMs - lead * 60000;
        const diff = nowMs - notifyAt;
        if (diff < 0 || diff >= windowMs) continue;
        const details = [c.specialty, c.location].filter(Boolean).join(' · ');
        fire(
          `chk|${c.id}|${c.datetime}|${lead}`,
          'Check-up reminder',
          `Check-up ${leadPhrase(lead)} with ${c.doctor} at ${formatDateTime(c.datetime)}${details ? ` (${details})` : ''}.`
        );
      }
    };

    const CATCH_UP_MS = 30 * 60 * 1000;
    check(CATCH_UP_MS);
    const onWake = () => {
      if (!document.hidden) check(CATCH_UP_MS);
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    const timer = setInterval(() => check(WINDOW_MS), 15000);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [user, meds, logs, checkups, pushToast]);

  const markAlertsRead = useCallback(() => {
    setAlerts((prev) => {
      if (prev.every((a) => a.read)) return prev;
      const next = prev.map((a) => ({ ...a, read: true }));
      saveAlerts(next);
      return next;
    });
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    saveAlerts([]);
  }, []);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const value = useMemo(
    () => ({
      meds,
      logs,
      checkups,
      refresh,
      toasts,
      pushToast,
      markDose,
      undoDose,
      alerts,
      unreadCount,
      markAlertsRead,
      clearAlerts,
    }),
    [meds, logs, checkups, refresh, toasts, pushToast, markDose, undoDose, alerts, unreadCount, markAlertsRead, clearAlerts]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
