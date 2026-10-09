import { pad } from '../utils/format';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export function to12(value) {
  const [h, m] = (value || '09:00').split(':').map(Number);
  return {
    hour: String(h % 12 || 12),
    minute: pad(m || 0),
    period: h >= 12 ? 'PM' : 'AM',
  };
}

export function to24(hour, minute, period) {
  const h = (Number(hour) % 12) + (period === 'PM' ? 12 : 0);
  return `${pad(h)}:${pad(Number(minute))}`;
}

export default function TimeInput({ value, onChange }) {
  const { hour, minute, period } = to12(value);

  const update = (patch) => {
    const next = { hour, minute, period, ...patch };
    onChange(to24(next.hour, next.minute, next.period));
  };

  return (
    <div className="time-input">
      <select aria-label="Hour" value={hour} onChange={(e) => update({ hour: e.target.value })}>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="time-colon">:</span>
      <select aria-label="Minute" value={minute} onChange={(e) => update({ minute: e.target.value })}>
        {MINUTES.map((m) => (
          <option key={m} value={pad(m)}>
            {pad(m)}
          </option>
        ))}
      </select>
      <select aria-label="AM or PM" value={period} onChange={(e) => update({ period: e.target.value })}>
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  );
}
