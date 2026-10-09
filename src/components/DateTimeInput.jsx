import TimeInput from './TimeInput';

export default function DateTimeInput({ value, onChange }) {
  const [date = '', time = '09:00'] = (value || '').split('T');

  return (
    <div className="datetime-input">
      <input
        type="date"
        aria-label="Date"
        value={date}
        onChange={(e) => onChange(`${e.target.value}T${time}`)}
      />
      <TimeInput value={time} onChange={(t) => onChange(`${date}T${t}`)} />
    </div>
  );
}
