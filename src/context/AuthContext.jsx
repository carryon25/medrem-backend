import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authenticate, createUser, endSession, getPublicUser, updateUser } from '../db/api';

const AuthContext = createContext(null);
const SESSION_KEY = 'medrem.session';

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem(SESSION_KEY)) {
          setUser(await getPublicUser());
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await authenticate(email, password);
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (data) => {
    const u = await createUser(data);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await endSession();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (fields) => {
    const u = await updateUser(fields);
    setUser(u);
    return u;
  }, []);

  const value = useMemo(
    () => ({ ready, user, login, signup, logout, updateProfile }),
    [ready, user, login, signup, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
