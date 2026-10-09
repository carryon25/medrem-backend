export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const pad = (n) => String(n).padStart(2, '0');

export function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${pad(m)} ${ampm}`;
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${date}, ${formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function formatDays(days) {
  if (!days || days.length === 7) return 'Every day';
  if (!days.length) return 'No days selected';
  return [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(', ');
}

export function formatLead(mins) {
  const n = Number(mins) || 0;
  if (n <= 0) return 'At the scheduled time';
  if (n % 1440 === 0) return `${n / 1440} day${n / 1440 > 1 ? 's' : ''} before`;
  if (n % 60 === 0) return `${n / 60} hour${n / 60 > 1 ? 's' : ''} before`;
  return `${n} minutes before`;
}

export function leadPhrase(mins) {
  const n = Number(mins) || 0;
  if (n <= 0) return 'now';
  if (n % 1440 === 0) return `in ${n / 1440} day${n / 1440 > 1 ? 's' : ''}`;
  if (n % 60 === 0) return `in ${n / 60} hour${n / 60 > 1 ? 's' : ''}`;
  return `in ${n} minute${n > 1 ? 's' : ''}`;
}

export function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} d ago`;
}

export function compressImage(file, maxSize = 320) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load the image.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
