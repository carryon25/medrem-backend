import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../db/api';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/Avatar';
import InstallButton from '../components/InstallButton';
import { compressImage } from '../utils/format';

export default function Profile() {
  const { user, logout, updateProfile } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    gender: user.gender || '',
    birthdate: user.birthdate || '',
    address: user.address || '',
  });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await compressImage(file);
      await updateProfile({ profilePicture: data });
      setMsg({ type: 'ok', text: 'Profile picture updated.' });
    } catch (err) {
      setMsg({
        type: 'err',
        text: err?.message && err.message !== 'Something went wrong. Please try again.'
          ? err.message
          : 'That file could not be used as a profile picture.',
      });
    }
  };

  const saveDetails = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await updateProfile(form);
      setMsg({ type: 'ok', text: 'Profile details saved.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (pw.next.length < 6) return setMsg({ type: 'err', text: 'New password must be at least 6 characters.' });
    if (pw.next !== pw.confirm) return setMsg({ type: 'err', text: 'New passwords do not match.' });
    try {
      await changePassword(user.id, pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      setMsg({ type: 'ok', text: 'Password changed.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="stack">
      <h1>My profile</h1>
      {msg && <p className={msg.type === 'ok' ? 'form-success' : 'form-error'}>{msg.text}</p>}

      <section className="card profile-head">
        <Avatar user={user} size={96} />
        <div>
          <h2>{user.name}</h2>
          <p className="muted">{user.email}</p>
          <p className="muted">
            {[user.gender, user.age != null ? `${user.age} years old` : null].filter(Boolean).join(' · ')}
          </p>
          <div className="card-actions">
            <label className="btn btn-outline btn-sm file-btn">
              Change picture
              <input type="file" accept="image/*" onChange={onPhoto} hidden />
            </label>
            {user.profile_picture && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  try {
                    await updateProfile({ profilePicture: null });
                    setMsg({ type: 'ok', text: 'Profile picture removed.' });
                  } catch (err) {
                    setMsg({ type: 'err', text: err.message });
                  }
                }}
              >
                Remove picture
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="two-col">
        <form className="card form" onSubmit={saveDetails}>
          <h3>Personal information</h3>
          <label>
            Full name
            <input value={form.name} onChange={set('name')} required />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')} required />
          </label>
          <div className="grid-2">
            <label>
              Gender
              <select value={form.gender} onChange={set('gender')} required>
                <option value="">Select…</option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </label>
            <label>
              Birthdate
              <input type="date" value={form.birthdate} onChange={set('birthdate')} required />
            </label>
          </div>
          <label>
            Address
            <textarea rows="2" value={form.address} onChange={set('address')} required />
          </label>
          <div className="form-actions">
            <button className="btn btn-primary">Save details</button>
          </div>
        </form>

        <div className="stack">
          <section className="card">
            <h3>Appearance</h3>
            <p className="muted">Turn dark mode on or off, or let your device decide.</p>
            <div className="segmented" role="group" aria-label="Theme">
              {[
                ['system', 'Match system'],
                ['light', 'Light'],
                ['dark', 'Dark'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={mode === value ? 'active' : ''}
                  onClick={() => setMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <form className="card form" onSubmit={savePassword}>
            <h3>Change password</h3>
            <label>
              Current password
              <input type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} required />
            </label>
            <div className="grid-2">
              <label>
                New password
                <input type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} required />
              </label>
              <label>
                Confirm new password
                <input type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} required />
              </label>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary">Update password</button>
            </div>
          </form>

          <section className="card">
            <h3>Get the app</h3>
            <p className="muted">Install MedRem on your phone for a full-screen app icon.</p>
            <InstallButton />
          </section>

          <section className="card">
            <h3>Account</h3>
            <dl className="detail-list">
              <div>
                <dt>Member since</dt>
                <dd>{user.created_at ? user.created_at.slice(0, 10) : '—'}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{user.address || '—'}</dd>
              </div>
            </dl>
            <div className="form-actions">
              <button className="btn btn-danger" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
