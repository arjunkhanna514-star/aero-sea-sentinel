// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { auth as authApi, setToken, getToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      authApi.me()
        .then(u => setUser({ ...u, fullName: u.fullName || u.full_name }))
        .catch(() => { setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    setToken(data.token);
    const u = { ...data.user, fullName: data.user.fullName || data.user.full_name };
    setUser(u);
    return u;
  };

  const logout = async () => {
    await authApi.logout().catch(() => {});
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { useTelemetry } from '../hooks/useTelemetry';
