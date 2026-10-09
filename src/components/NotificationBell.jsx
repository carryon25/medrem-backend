import { useEffect, useRef, useState } from 'react';
import { useData, toDateStr } from '../context/DataContext';
import { formatDateTime, formatLead, formatTime, timeAgo } from '../utils/format';
import { permissionState, requestPermission } from '../utils/notify';

export default function NotificationBell() {
  const { meds, logs, checkups, alerts, unreadCount, markAlertsRead, clearAlerts, pushToast } =
    useData();
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [permission, setPermission] = useState(permissionState);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    setConfirmClear(false);
    if (next) setPermission(permissionState());
  };

  const enableNotifications = async () => {
    const res = await requestPermission();
    setPermission(res);
    pushToast(
      res === 'granted'
        ? 'Notifications enabled — you will be alerted before each dose and check-up.'
        : res === 'unsupported'
          ? 'This browser does not support notifications.'
          : 'Notifications are blocked. Allow them in your browser settings.'
    );
  };

  const now = new Date();
  const today = toDateStr(now);
  const weekday = (now.getDay() + 6) % 7;

  const nextDoses = meds
    .filter((m) => m.days.includes(weekday))
    .filter((m) => !m.start_date || m.start_date <= today)
    .flatMap((m) => m.times.map((t) => ({ med: m, time: t })))
    .filter(
      ({ med, time }) =>
        !logs.some(
          (l) =>
            l.med_id === med.id &&
            l.dose_date === today &&
            l.dose_time === time &&
            (l.status === 'taken' || l.status === 'skipped')
        )
    )
    .map(({ med, time }) => {
      const [h, m] = time.split(':').map(Number);
      return { med, time, minutes: h * 60 + m };
    })
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, 4);

  const nextCheckups = checkups
    .filter((c) => new Date(c.datetime) >= now)
    .slice(0, 3);

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        className={`bell-btn ${open ? 'active' : ''}`}
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
            <span className="muted">{unreadCount > 0 ? `${unreadCount} new` : 'All caught up'}</span>
            {unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={markAlertsRead}>
                Mark all as read
              </button>
            )}
          </div>

          {permission === 'granted' ? (
            <div className="bell-status">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Notifications are on — you&apos;ll be alerted before every dose and check-up.
            </div>
          ) : permission !== 'unsupported' ? (
            <div className="bell-enable">
              <p>Enable notifications so you never miss a dose or check-up.</p>
              <button className="btn btn-primary btn-sm" onClick={enableNotifications}>
                Enable notifications
              </button>
            </div>
          ) : (
            <div className="bell-enable">
              <p>This browser does not support notifications. In-app alerts will still appear.</p>
            </div>
          )}
          <p className="bell-note">
            Reminders are delivered while MedRem is open (installed app or browser tab). With the
            app fully closed, alerts may not arrive — keep MedRem open for reliable reminders.
          </p>

          <div className="bell-section">
            <div className="bell-section-head">
              <h4>Upcoming schedule</h4>
            </div>
            {nextDoses.length === 0 && nextCheckups.length === 0 ? (
              <p className="bell-empty">Nothing else scheduled today.</p>
            ) : (
              <>
                {nextDoses.map(({ med, time }) => (
                  <div className="bell-item" key={`${med.id}-${time}`}>
                    <span className="bell-item-time">{formatTime(time)}</span>
                    <div className="bell-item-body">
                      <strong>{med.name}</strong>
                      <span>
                        {med.dosage} · Reminder: {formatLead(med.remind_before)}
                      </span>
                    </div>
                  </div>
                ))}
                {nextCheckups.map((c) => (
                  <div className="bell-item" key={c.id}>
                    <span className="bell-item-time">
                      {formatDateTime(c.datetime).split(',')[0]}
                    </span>
                    <div className="bell-item-body">
                      <strong>{c.title || 'Check-up'}</strong>
                      <span>
                        {c.doctor} · {formatDateTime(c.datetime)} · Reminder:{' '}
                        {formatLead(c.remind_before)}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="bell-section">
            <div className="bell-section-head">
              <h4>Recent alerts</h4>
              {alerts.length > 0 &&
                (confirmClear ? (
                  <span className="bell-confirm">
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        clearAlerts();
                        setConfirmClear(false);
                      }}
                    >
                      Clear
                    </button>
                  </span>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(true)}>
                    Clear
                  </button>
                ))}
            </div>
            {alerts.length === 0 ? (
              <p className="bell-empty">
                No alerts yet — you will be notified before each dose and check-up.
              </p>
            ) : (
              alerts.slice(0, 8).map((a) => (
                <div className={`bell-item bell-alert ${a.read ? '' : 'unread'}`} key={a.id + a.at}>
                  <div className="bell-item-body">
                    <strong>{a.title}</strong>
                    <span>{a.body}</span>
                  </div>
                  <span className="bell-when">{timeAgo(a.at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
