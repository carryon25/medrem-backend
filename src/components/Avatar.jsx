import { initials } from '../utils/format';

export default function Avatar({ user, size = 44 }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (user?.profile_picture) {
    return <img className="avatar" style={style} src={user.profile_picture} alt={user.name} />;
  }
  return (
    <span className="avatar avatar-fallback" style={style}>
      {initials(user?.name || '?')}
    </span>
  );
}
