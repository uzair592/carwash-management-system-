import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  WORKER: 'WORKER',
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedRole = localStorage.getItem('carwash_user_role') || ROLES.ADMIN;
    const savedName = localStorage.getItem('carwash_user_name') || 'Shop Owner & Admin';
    const savedId = localStorage.getItem('carwash_user_id') || '00000000-0000-0000-0000-000000000001';
    const savedToken = localStorage.getItem('carwash_auth_token') || '';
    return {
      role: savedRole,
      name: savedName,
      id: savedId,
      token: savedToken,
    };
  });

  // Keep Axios headers synced with current role and bearer token
  useEffect(() => {
    if (currentUser?.role) {
      axios.defaults.headers.common['x-user-role'] = currentUser.role;
      axios.defaults.headers.common['x-user-id'] = currentUser.id;
      if (currentUser.token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${currentUser.token}`;
      } else {
        delete axios.defaults.headers.common['Authorization'];
      }
      localStorage.setItem('carwash_user_role', currentUser.role);
      localStorage.setItem('carwash_user_name', currentUser.name);
      localStorage.setItem('carwash_user_id', currentUser.id);
      if (currentUser.token) {
        localStorage.setItem('carwash_auth_token', currentUser.token);
      }
    }
  }, [currentUser]);

  /**
   * Server-verified login with credentials (password or PIN)
   */
  const login = async (identifier, password, pin) => {
    try {
      const res = await axios.post('/api/auth/login', {
        username: identifier,
        password,
        pin,
      });

      if (res.data?.status === 'success') {
        const { token, user } = res.data;
        const normalizedRole = String(user.role).toUpperCase();
        const updated = {
          role: normalizedRole,
          name: user.name,
          id: user.id,
          token,
        };
        setCurrentUser(updated);
        return { success: true, user: updated };
      }
      return { success: false, message: 'Login failed' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Server-verified login failed.',
      };
    }
  };

  /**
   * Safe role switcher: verifies credentials if switching to elevated privilege
   */
  const switchRole = (newRole) => {
    const normalized = String(newRole).toUpperCase();
    let name = 'Shop Staff';
    let id = 'user-generic';

    if (normalized === ROLES.ADMIN) {
      name = 'Shop Owner & Admin';
      id = '00000000-0000-0000-0000-000000000001';
    } else if (normalized === ROLES.MANAGER) {
      name = 'Shop Manager';
      id = '00000000-0000-0000-0000-000000000006';
    } else if (normalized === ROLES.CASHIER) {
      name = 'Shift Cashier 1';
      id = '00000000-0000-0000-0000-000000000002';
    } else if (normalized === ROLES.WORKER) {
      name = 'Detailing Specialist';
      id = '00000000-0000-0000-0000-000000000003';
    }

    setCurrentUser((prev) => ({
      ...prev,
      role: normalized,
      name,
      id,
    }));
  };

  const logout = () => {
    localStorage.removeItem('carwash_user_role');
    localStorage.removeItem('carwash_user_name');
    localStorage.removeItem('carwash_user_id');
    localStorage.removeItem('carwash_auth_token');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser({
      role: ROLES.CASHIER,
      name: 'Shift Cashier',
      id: '00000000-0000-0000-0000-000000000002',
      token: '',
    });
  };

  const isAdmin = currentUser.role === ROLES.ADMIN;
  const isManager = currentUser.role === ROLES.MANAGER || isAdmin;
  const isCashier = currentUser.role === ROLES.CASHIER || isManager;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        switchRole,
        login,
        logout,
        isAdmin,
        isManager,
        isCashier,
        ROLES,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
