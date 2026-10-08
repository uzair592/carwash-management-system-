import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
const AuthContext = createContext();
export const ROLES = {
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  WORKER: 'WORKER',
  INVESTOR: 'INVESTOR'
};
const clear = () => {
  for (const key of ['carwash_auth_token', 'carwash_user_role', 'carwash_user_name', 'carwash_user_id']) localStorage.removeItem(key);
  delete axios.defaults.headers.common.Authorization;
  delete axios.defaults.headers.common['x-user-role'];
  delete axios.defaults.headers.common['x-user-id'];
};
export function AuthProvider({
  children
}) {
  const [pending] = useState(() => new Map());
  useEffect(() => {
    const id = axios.interceptors.request.use(config => {
      if (['post', 'put', 'patch', 'delete'].includes(config.method) && !config.url?.includes('/auth/')) {
        const signature = config.method + ':' + config.url + ':' + JSON.stringify(config.data || {});
        let key = pending.get(signature);
        if (!key) {
          const bytes = new Uint8Array(16);
          crypto.getRandomValues(bytes);
          key = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
          pending.set(signature, key);
        }
        config.headers['Idempotency-Key'] ||= key;
        config._mutationSignature = signature;
      }
      return config;
    });
    const response = axios.interceptors.response.use(r => {
      pending.delete(r.config._mutationSignature);
      return r;
    }, e => {
      if (e.response?.status >= 400 && e.response?.status < 500) pending.delete(e.config?._mutationSignature);
      return Promise.reject(e);
    });
    return () => {
      axios.interceptors.request.eject(id);
      axios.interceptors.response.eject(response);
    };
  }, [pending]);
  const [currentUser, setCurrentUser] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('carwash_auth_token');
    if (!token) {
      setLoading(false);
      return;
    }
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    axios.get('/api/auth/me').then(r => setCurrentUser({
      ...r.data.user,
      token
    })).catch(clear).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const id = axios.interceptors.response.use(r => r, e => {
      if (e.response?.status === 401 && !e.config?.url?.includes('/auth/login')) {
        clear();
        setCurrentUser(null);
      }
      return Promise.reject(e);
    });
    return () => axios.interceptors.response.eject(id);
  }, []);
  const login = async (identifier, password, pin) => {
    try {
      const r = await axios.post('/api/auth/login', {
        username: identifier,
        password,
        pin
      });
      const user = {
        ...r.data.user,
        role: String(r.data.user.role).toUpperCase(),
        token: r.data.token
      };
      localStorage.setItem('carwash_auth_token', user.token);
      axios.defaults.headers.common.Authorization = `Bearer ${user.token}`;
      setCurrentUser(user);
      return {
        success: true
      };
    } catch (e) {
      return {
        success: false,
        message: e.response?.data?.message || 'Unable to sign in.'
      };
    }
  };
  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } finally {
      clear();
      setCurrentUser(null);
    }
  };
  const can = key => currentUser?.role === 'ADMIN' || currentUser?.permissions?.[key] === true;
  const refreshUser = async () => {
    const r = await axios.get('/api/auth/me');
    setCurrentUser(prev => ({
      ...prev,
      ...r.data.user
    }));
  };
  useEffect(() => {
    if (!currentUser) return;
    const timer = setInterval(() => refreshUser().catch(() => {}), 30000);
    return () => clearInterval(timer);
  }, [currentUser?.id]);
  const isAdmin = currentUser?.role === ROLES.ADMIN,
    isManager = isAdmin || currentUser?.role === ROLES.MANAGER || currentUser?.role === ROLES.ACCOUNTANT,
    isCashier = can('billing.manage') || can('intake.manage');
  return <AuthContext.Provider value={{
    currentUser,
    loading,
    login,
    logout,
    isAdmin,
    isManager,
    isCashier,
    can,
    refreshUser,
    ROLES
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  return useContext(AuthContext);
}
