import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toDateStr, useData } from '../context/DataContext';
import MedForm from '../components/MedForm';
import { addMed, deleteMed, updateMed } from '../db/api';
import { formatDays, formatLead, formatTime } from '../utils/format';

export default function Medications() {
  const { user } = useAuth();
  const { meds, refresh, pushToast } = useData();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const todayStr = toDateStr(new Date());

  const save = async (values) => {
    try {
      if (editing) {
        await updateMed(editing.id, values);
        pushToast('Medication updated.');
      } else {
        await addMed(user.id, values);
        pushToast('Medication added.');
      }
      setEditing(null);
      setShowForm(false);
      refresh();
    } catch (err) {
      pushToast(err.message || 'Could not save the medication.');
    }
  };

  const remove = async (med) => {
    if (window.confirm(`Delete ${med.name}? Its dose history will also be removed.`)) {
      try {
        await deleteMed(med.id);
        pushToast('Medication deleted.');
        refresh();
      } catch (err) {
        pushToast(err.message || 'Could not delete the medication.');
      }
    }
  };

  const startEdit = (med) => {
    setEditing(med);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="stack">
      <div className="section-head">
        <div>
          <h1>Medicines</h1>
          <p className="muted">Medicine, dosage, times and schedule.</p>
        </div>
        {!showForm && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            + Add medication
          </button>
        )}
      </div>

      {showForm && (
        <MedForm
          initial={editing}
          onSave={save}
          onCancel={() => {
            setEditing(null);
            setShowForm(false);
          }}
        />
      )}

      {meds.length === 0 && !showForm ? (
        <div className="card empty-card">
          <p className="empty">No medications yet. Add your first one to start getting reminders.</p>
        </div>
      ) : (
        <div className="med-grid">
          {meds.map((m) => {
            const low =
              m.refill_remaining != null && m.refill_remaining <= (m.low_threshold ?? 5);
            const notStarted = m.start_date && m.start_date > todayStr;
            return (
              <article className="card med-card" key={m.id}>
                <div className="section-head">
                  <div>
                    <h3>{m.name}</h3>
                    <p className="muted">{m.dosage}</p>
                  </div>
                  <div className="med-badges">
                    {notStarted && (
                      <span className="badge badge-upcoming">Starts {m.start_date}</span>
                    )}
                    <span className={`badge ${low ? 'badge-missed' : 'badge-taken'}`}>
                      {m.refill_remaining != null ? `${m.refill_remaining} left` : 'No refill count'}
                    </span>
                  </div>
                </div>

                <dl className="detail-list">
                  <div>
                    <dt>Time</dt>
                    <dd>{m.times.map(formatTime).join(' · ')}</dd>
                  </div>
                  <div>
                    <dt>Schedule</dt>
                    <dd>{formatDays(m.days)}</dd>
                  </div>
                  <div>
                    <dt>Reminder</dt>
                    <dd>{formatLead(m.remind_before)}</dd>
                  </div>
                  {m.instructions && (
                    <div>
                      <dt>Instructions</dt>
                      <dd>{m.instructions}</dd>
                    </div>
                  )}
                  {m.start_date && (
                    <div>
                      <dt>Starts</dt>
                      <dd>{m.start_date}</dd>
                    </div>
                  )}
                </dl>

                {m.refill_total != null && (
                  <div className="progress" aria-label="Refill level">
                    <div
                      className={`progress-fill ${low ? 'low' : ''}`}
                      style={{ width: `${Math.max(2, Math.round(((m.refill_remaining ?? 0) / m.refill_total) * 100))}%` }}
                    />
                  </div>
                )}

                <div className="card-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => startEdit(m)}>
                    Edit
                  </button>
                  <button className="btn btn-ghost btn-sm danger" onClick={() => remove(m)}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
