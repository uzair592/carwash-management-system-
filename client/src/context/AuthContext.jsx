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
    const savedName = localStorage.getItem('carwash_user_name') || 'Shop Admin';
    const savedId = localStorage.getItem('carwash_user_id') || '00000000-0000-0000-0000-000000000001';
    return {
      role: savedRole,
      name: savedName,
      id: savedId,
    };
  });

  // Keep Axios headers synced with current role
  useEffect(() => {
    if (currentUser?.role) {
      axios.defaults.headers.common['x-user-role'] = currentUser.role;
      axios.defaults.headers.common['x-user-id'] = currentUser.id;
      localStorage.setItem('carwash_user_role', currentUser.role);
      localStorage.setItem('carwash_user_name', currentUser.name);
      localStorage.setItem('carwash_user_id', currentUser.id);
    }
  }, [currentUser]);

  const switchRole = (newRole) => {
    const normalized = String(newRole).toUpperCase();
    let name = 'Shop Staff';
    let id = 'user-generic';

    if (normalized === ROLES.ADMIN) {
      name = 'Shop Admin';
      id = '00000000-0000-0000-0000-000000000001';
    } else if (normalized === ROLES.MANAGER) {
      name = 'Shift Manager';
      id = '00000000-0000-0000-0000-000000000006';
    } else if (normalized === ROLES.CASHIER) {
      name = 'Main Cashier';
      id = '00000000-0000-0000-0000-000000000002';
    } else if (normalized === ROLES.WORKER) {
      name = 'Bay Floor Worker';
      id = '00000000-0000-0000-0000-000000000003';
    }

    setCurrentUser({
      role: normalized,
      name,
      id,
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
