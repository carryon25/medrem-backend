import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ageFromBirthdate } from '../db/api';
import { compressImage } from '../utils/format';

const EMPTY = {
  name: '',
  email: '',
  password: '',
  confirm: '',
  gender: '',
  birthdate: '',
  address: '',
};

const TODAY = new Date().toISOString().slice(0, 10);

export default function Signup() {
  const { ready, user, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState(null);
  const [photoName, setPhotoName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const age = useMemo(() => ageFromBirthdate(form.birthdate), [form.birthdate]);

  if (ready && user) return <Navigate to="/dashboard" replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const data = await compressImage(file);
      setPhoto(data);
      setPhotoName(file.name);
    } catch {
      setError('That file could not be used as a profile picture.');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (!form.gender) return setError('Please select your gender.');
    if (!form.birthdate) return setError('Please enter your birthdate.');
    if (!form.address.trim()) return setError('Please enter your address.');
    setBusy(true);
    try {
      await signup({ ...form, profilePicture: photo });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card auth-card-wide" onSubmit={submit}>
        <div className="brand auth-brand">
          <span className="brand-mark">+</span> MedRem
        </div>
        <h1>Create your account</h1>
        <p className="muted">Tell us about yourself so we can personalize your reminders.</p>
        {error && <p className="form-error">{error}</p>}

        <div className="photo-picker">
          {photo ? (
            <img src={photo} alt="Profile preview" className="photo-preview" />
          ) : (
            <div className="photo-preview photo-placeholder">Add photo</div>
          )}
          <div>
            <label className="btn btn-outline btn-sm file-btn">
              Choose profile picture
              <input type="file" accept="image/*" onChange={onPhoto} hidden />
            </label>
            {photoName && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setPhoto(null);
                  setPhotoName('');
                }}
              >
                Remove
              </button>
            )}
            <p className="hint">JPG or PNG, shown as a circle.</p>
          </div>
        </div>

        <label>
          Full name *
          <input required value={form.name} onChange={set('name')} placeholder="e.g. Maria Santos" autoComplete="name" />
        </label>

        <label>
          Email *
          <input type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" />
        </label>

        <div className="grid-2">
          <label>
            Password *
            <input type="password" required value={form.password} onChange={set('password')} placeholder="At least 6 characters" autoComplete="new-password" />
          </label>
          <label>
            Confirm password *
            <input type="password" required value={form.confirm} onChange={set('confirm')} placeholder="Repeat password" autoComplete="new-password" />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Gender *
            <select required value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              <option>Female</option>
              <option>Male</option>
              <option>Non-binary</option>
              <option>Prefer not to say</option>
            </select>
          </label>
          <label>
            Birthdate *
            <input type="date" required value={form.birthdate} onChange={set('birthdate')} max={TODAY} />
          </label>
        </div>

        <label>
          Age
          <input readOnly value={age ?? ''} placeholder="Auto-calculated from birthdate" />
        </label>

        <label>
          Address *
          <textarea required rows="2" value={form.address} onChange={set('address')} placeholder="House no., street, city, province, postal code" />
        </label>

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth-alt">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
