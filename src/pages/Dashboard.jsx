import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData, toDateStr } from '../context/DataContext';
import Avatar from '../components/Avatar';
import InstallButton from '../components/InstallButton';
import { formatDateTime, formatDays, formatLead, formatTime } from '../utils/format';
import { permissionState, requestPermission } from '../utils/notify';

export default function Dashboard() {
  const { user } = useAuth();
  const { meds, logs, checkups, markDose, undoDose, pushToast } = useData();
  const [showAllCheckups, setShowAllCheckups] = useState(false);

  const now = new Date();
  const todayStr = toDateStr(now);
  const weekday = (now.getDay() + 6) % 7;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const schedule = useMemo(() => {
    return meds
      .filter((m) => m.days.includes(weekday))
      .filter((m) => !m.start_date || m.start_date <= todayStr)
      .flatMap((m) =>
        m.times.map((t) => {
          const log = logs.find(
            (l) => l.med_id === m.id && l.dose_date === todayStr && l.dose_time === t
          );
          const [h, min] = t.split(':').map(Number);
          const minutes = h * 60 + min;
          let status = log?.status || (minutes < nowMinutes ? 'missed' : 'upcoming');
          if (log && minutes > nowMinutes + 1) status = log.status;
          return { med: m, time: t, status, minutes };
        })
      )
      .sort((a, b) => a.minutes - b.minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meds, logs, weekday, todayStr]);

  const taken = schedule.filter((s) => s.status === 'taken').length;
  const nextDose = schedule.find((s) => s.status === 'upcoming' || s.status === 'missed');
  const upcoming = checkups.filter((c) => new Date(c.datetime) >= now);
  const nextCheckup = upcoming[0];
  const shownCheckups = showAllCheckups ? upcoming : upcoming.slice(0, 3);
  const lowMeds = meds.filter(
    (m) => m.refill_remaining != null && m.refill_remaining <= (m.low_threshold ?? 5)
  );
  const notStarted = meds.filter((m) => m.start_date && m.start_date > todayStr);

  const askNotifications = async () => {
    const res = await requestPermission();
    pushToast(
      res === 'granted'
        ? 'Reminders are on — keep MedRem open (or installed) to get alerts.'
        : res === 'unsupported'
          ? 'This browser does not support notifications.'
          : 'Notifications were blocked. Allow them in your browser settings.'
    );
  };

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="stack">
      <section className="card hero">
        <div>
          <h1>
            {greeting}, {user.name.split(' ')[0]}
          </h1>
          <p className="muted">
            {todayStr} · {schedule.length} dose{schedule.length === 1 ? '' : 's'} scheduled today,{' '}
            {taken} taken
          </p>
          {permissionState() === 'granted' ? (
            <p className="hero-note">
              Reminder notifications are on · alerts arrive while MedRem is open (install the app
              for the most reliable reminders).
            </p>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={askNotifications}>
              Turn on reminder notifications
            </button>
          )}
          <div className="hero-install">
            <InstallButton className="btn btn-light btn-sm" />
          </div>
        </div>
        <Avatar user={user} size={72} />
      </section>

      <section className="stat-grid">
        <div className="card stat">
          <span className="stat-label">Doses today</span>
          <strong>
            {taken}/{schedule.length}
          </strong>
        </div>
        <div className="card stat">
          <span className="stat-label">Next dose</span>
          <strong>{nextDose ? `${formatTime(nextDose.time)}` : '—'}</strong>
          <span className="stat-sub">{nextDose ? `${nextDose.med.name} · ${nextDose.med.dosage}` : 'Nothing left today'}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Next check-up</span>
          <strong>{nextCheckup ? formatDateTime(nextCheckup.datetime).split(',')[0] : '—'}</strong>
          <span className="stat-sub">{nextCheckup ? `${nextCheckup.doctor}` : 'No appointments scheduled'}</span>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Today&apos;s schedule</h2>
          <Link to="/medications" className="btn btn-outline btn-sm">
            Manage meds
          </Link>
        </div>
        {schedule.length === 0 ? (
          <p className="empty">
            No medications scheduled today. <Link to="/medications">Add your first medication</Link>.
          </p>
        ) : (
          <div className="dose-list">
            {schedule.map(({ med, time, status }) => (
              <div className={`dose-row row-${status}`} key={`${med.id}-${time}`}>
                <div className="dose-time">{formatTime(time)}</div>
                <div className="dose-info">
                  <strong>{med.name}</strong>
                  <span>
                    {med.dosage}
                    {med.instructions ? ` · ${med.instructions}` : ''}
                  </span>
                </div>
                <span className={`badge badge-${status}`}>{status}</span>
                <div className="dose-actions">
                  {status !== 'taken' && (
                    <button className="btn btn-primary btn-sm" onClick={() => markDose(med.id, time, 'taken')}>
                      Take
                    </button>
                  )}
                  {status !== 'skipped' && status !== 'taken' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => markDose(med.id, time, 'skipped')}>
                      Skip
                    </button>
                  )}
                  {(status === 'taken' || status === 'skipped') && (
                    <button className="btn btn-ghost btn-sm" onClick={() => undoDose(med.id, time)}>
                      Undo
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {notStarted.length > 0 && (
          <p className="muted schedule-note">
            {notStarted
              .map((m) => `${m.name} starts ${m.start_date}`)
              .join(' · ')}{' '}
            — not yet scheduled or reminded.
          </p>
        )}
      </section>

      <div className="two-col">
        <section className="card">
          <div className="section-head">
            <h2>Upcoming check-ups</h2>
            <Link to="/checkups" className="btn btn-outline btn-sm">
              Manage
            </Link>
          </div>
          {shownCheckups.length === 0 ? (
            <p className="empty">
              No check-ups scheduled. <Link to="/checkups">Schedule one</Link>.
            </p>
          ) : (
            <ul className="checkup-list">
              {shownCheckups.map((c) => (
                <li key={c.id}>
                  <div>
                    <strong>{c.title || 'Check-up'}</strong>
                    <span className="muted">{formatDateTime(c.datetime)}</span>
                    <span className="muted">Reminder: {formatLead(c.remind_before)}</span>
                  </div>
                  <div className="checkup-doctor">
                    <strong>{c.doctor}</strong>
                    <span className="muted">
                      {[c.specialty, c.location].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {upcoming.length > 3 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAllCheckups((v) => !v)}>
              {showAllCheckups ? 'Show fewer' : `Show all (${upcoming.length})`}
            </button>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <h2>Refill alerts</h2>
          </div>
          {lowMeds.length === 0 ? (
            <p className="empty">All medications have enough supply.</p>
          ) : (
            <ul className="refill-list">
              {lowMeds.map((m) => (
                <li key={m.id}>
                  <strong>{m.name}</strong>
                  <span className="muted">{m.dosage}</span>
                  <span className="badge badge-missed">
                    {m.refill_remaining ?? 0} left (alert at {m.low_threshold ?? 5})
                  </span>
                  <span className="muted">{formatDays(m.days)} · {m.times.map(formatTime).join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
