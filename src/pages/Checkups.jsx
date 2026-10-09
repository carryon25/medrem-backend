import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import CheckupForm from '../components/CheckupForm';
import { addCheckup, deleteCheckup, updateCheckup } from '../db/api';
import { formatDateTime, formatLead } from '../utils/format';

export default function Checkups() {
  const { user } = useAuth();
  const { checkups, refresh, pushToast } = useData();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const now = new Date();
  const upcoming = checkups.filter((c) => new Date(c.datetime) >= now);
  const past = checkups.filter((c) => new Date(c.datetime) < now).reverse();

  const save = async (values) => {
    try {
      if (editing) {
        await updateCheckup(editing.id, values);
        pushToast('Check-up updated.');
      } else {
        await addCheckup(user.id, values);
        pushToast('Check-up scheduled.');
      }
      setEditing(null);
      setShowForm(false);
      refresh();
    } catch (err) {
      pushToast(err.message || 'Could not save the check-up.');
    }
  };

  const remove = async (c) => {
    if (window.confirm(`Delete the check-up with ${c.doctor}?`)) {
      try {
        await deleteCheckup(c.id);
        pushToast('Check-up deleted.');
        refresh();
      } catch (err) {
        pushToast(err.message || 'Could not delete the check-up.');
      }
    }
  };

  const startEdit = (c) => {
    setEditing(c);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderList = (items, emptyText) =>
    items.length === 0 ? (
      <p className="empty">{emptyText}</p>
    ) : (
      <ul className="checkup-list">
        {items.map((c) => (
          <li key={c.id}>
            <div>
              <strong>{c.title || 'Check-up'}</strong>
              <span className="muted">{formatDateTime(c.datetime)}</span>
              <span className="muted">Reminder: {formatLead(c.remind_before)}</span>
              {c.notes && <span className="muted">{c.notes}</span>}
            </div>
            <div className="checkup-doctor">
              <strong>{c.doctor}</strong>
              <span className="muted">{c.specialty || 'Physician'}</span>
              <span className="muted">{c.location || 'Location to be confirmed'}</span>
            </div>
            <div className="card-actions">
              <button className="btn btn-outline btn-sm" onClick={() => startEdit(c)}>
                Edit
              </button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => remove(c)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="stack">
      <div className="section-head">
        <div>
          <h1>Check-ups</h1>
          <p className="muted">Schedule of follow-up visits and your doctor or physician.</p>
        </div>
        {!showForm && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            + Schedule check-up
          </button>
        )}
      </div>

      {showForm && (
        <CheckupForm
          initial={editing}
          onSave={save}
          onCancel={() => {
            setEditing(null);
            setShowForm(false);
          }}
        />
      )}

      <section className="card">
        <h2>Upcoming</h2>
        {renderList(upcoming, 'No upcoming check-ups.')}
      </section>

      <section className="card">
        <h2>Past visits</h2>
        {renderList(past, 'No past check-ups yet.')}
      </section>
    </div>
  );
}
