import { useState } from 'react';
import { DAY_LABELS } from '../utils/format';
import TimeInput from './TimeInput';

const empty = {
  name: '',
  dosage: '',
  times: ['08:00'],
  days: [0, 1, 2, 3, 4, 5, 6],
  instructions: '',
  startDate: '',
  remindBefore: 0,
  refillTotal: '',
  lowThreshold: 5,
};

export default function MedForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial
      ? {
          ...initial,
          startDate: initial.start_date ?? '',
          refillTotal: initial.refill_total ?? '',
          lowThreshold: initial.low_threshold ?? 5,
          remindBefore: initial.remind_before ?? 0,
        }
      : empty
  );
  const [error, setError] = useState('');

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const toggleDay = (d) =>
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort(),
    }));

  const setTime = (i, value) =>
    setForm((f) => {
      const times = [...f.times];
      times[i] = value;
      return { ...f, times };
    });

  const submit = (e) => {
    e.preventDefault();
    const times = [...new Set(form.times.filter(Boolean))].sort();
    if (!form.name.trim() || !form.dosage.trim()) return setError('Name and dosage are required.');
    if (!times.length) return setError('Add at least one time.');
    if (!form.days.length) return setError('Select at least one day.');
    onSave({
      ...form,
      name: form.name,
      dosage: form.dosage,
      times,
      refillTotal: form.refillTotal === '' ? null : Number(form.refillTotal),
      lowThreshold: Number(form.lowThreshold) || 5,
      remindBefore: Number(form.remindBefore) || 0,
      refillRemaining: initial
        ? form.refillTotal === ''
          ? null
          : Math.min(initial.refill_remaining ?? 0, Number(form.refillTotal))
        : undefined,
    });
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h3>{initial ? 'Edit medication' : 'Add medication'}</h3>
      {error && <p className="form-error">{error}</p>}

      <div className="grid-2">
        <label>
          Medicine name
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Amoxicillin" />
        </label>
        <label>
          Dosage
          <input value={form.dosage} onChange={(e) => set('dosage', e.target.value)} placeholder="e.g. 500 mg, 1 tablet" />
        </label>
      </div>

      <fieldset>
        <legend>Times</legend>
        {form.times.map((t, i) => (
          <div className="time-row" key={i}>
            <TimeInput value={t} onChange={(v) => setTime(i, v)} />
            {form.times.length > 1 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, times: f.times.filter((_, x) => x !== i) }))}>
                Remove
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => set('times', [...form.times, '12:00'])}>
          + Add time
        </button>
      </fieldset>

      <fieldset>
        <legend>Repeat on</legend>
        <div className="days">
          {DAY_LABELS.map((label, d) => (
            <button
              type="button"
              key={label}
              className={`day-chip ${form.days.includes(d) ? 'active' : ''}`}
              onClick={() => toggleDay(d)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid-2">
        <label>
          Remind me
          <select value={form.remindBefore} onChange={(e) => set('remindBefore', e.target.value)}>
            <option value="0">At the scheduled time</option>
            <option value="5">5 minutes before</option>
            <option value="10">10 minutes before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
          </select>
        </label>
        <label>
          Instructions (optional)
          <input value={form.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="e.g. Take with food" />
        </label>
        <label>
          Start date (optional)
          <input type="date" value={form.startDate || ''} onChange={(e) => set('startDate', e.target.value)} />
        </label>
        <label>
          Pills in bottle
          <input type="number" min="0" value={form.refillTotal} onChange={(e) => set('refillTotal', e.target.value)} placeholder="e.g. 30" />
        </label>
        <label>
          Low-refill alert at
          <input type="number" min="0" value={form.lowThreshold} onChange={(e) => set('lowThreshold', e.target.value)} />
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {initial ? 'Save changes' : 'Add medication'}
        </button>
      </div>
    </form>
  );
}
