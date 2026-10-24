import { createContext, useContext, useEffect, useState } from 'react';
import { get, post } from '../services/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const d = await post('/auth/login', { email, password });
    setUser(d.user);
    return d.user;
  };

  const logout = async () => {
    await post('/auth/logout', {}).catch(() => {});
    setUser(null);
  };

  const isStaff = user?.roles?.some((r) => r !== 'CUSTOMER');

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, isStaff }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
