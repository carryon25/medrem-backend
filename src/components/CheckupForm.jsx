import { useState } from 'react';
import DateTimeInput from './DateTimeInput';

export default function CheckupForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial
      ? { ...initial, remindBefore: initial.remind_before ?? 60 }
      : { title: '', doctor: '', specialty: '', datetime: '', remindBefore: 60, location: '', notes: '' }
  );
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.doctor.trim()) return setError('Doctor or physician name is required.');
    if (!form.datetime || !form.datetime.split('T')[0]) return setError('Date and time are required.');
    onSave(form);
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h3>{initial ? 'Edit check-up' : 'Schedule check-up'}</h3>
      {error && <p className="form-error">{error}</p>}

      <div className="grid-2">
        <label>
          Check-up title (optional)
          <input value={form.title} onChange={set('title')} placeholder="e.g. Follow-up consultation" />
        </label>
        <label>
          Doctor / physician *
          <input value={form.doctor} onChange={set('doctor')} placeholder="e.g. Dr. Sarah Lee" />
        </label>
        <label>
          Specialty (optional)
          <input value={form.specialty} onChange={set('specialty')} placeholder="e.g. Cardiologist" />
        </label>
        <label>
          Date & time *
          <DateTimeInput value={form.datetime} onChange={(v) => setForm((f) => ({ ...f, datetime: v }))} />
        </label>
        <label>
          Location (optional)
          <input value={form.location} onChange={set('location')} placeholder="e.g. City Clinic, Room 4" />
        </label>
        <label>
          Remind me
          <select value={form.remindBefore} onChange={(e) => setForm((f) => ({ ...f, remindBefore: e.target.value }))}>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="120">2 hours before</option>
            <option value="1440">1 day before</option>
          </select>
        </label>
        <label>
          Notes (optional)
          <input value={form.notes} onChange={set('notes')} placeholder="e.g. Bring lab results" />
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {initial ? 'Save changes' : 'Add check-up'}
        </button>
      </div>
    </form>
  );
}
