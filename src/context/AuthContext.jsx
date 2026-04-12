/**
 * Noorix Auth — يخزن المستخدم (role, companyIds) للصلاحيات ومبدّل الشركات.
 * انتهاء الجلسة: عند تسجيل الخروج أو انتهاء صلاحية JWT (JWT_EXPIRES_IN) وليس بسبب الخمول.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { registerOn401Handler } from '../services/api';
import { setAuthToken, setStoredUser, getAuthToken, getStoredUser, clearAuth } from '../services/authStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getAuthToken());
  const [user, setUserState] = useState(getStoredUser);

  const setToken = useCallback((value) => {
    setTokenState(value);
    if (!value) {
      setUserState(null);
      clearAuth();
    } else {
      setAuthToken(value);
    }
  }, []);

  const setUser = useCallback((value) => {
    setUserState(value);
    setStoredUser(value);
  }, []);

  // تسجيل معالج 401 عالمي — ينفّذ logout تلقائياً عند رفض الصلاحية
  useEffect(() => {
    registerOn401Handler(() => {
      if (token) {
        setToken(null);
        if (typeof window !== 'undefined') window.location.replace('/login');
      }
    });
  }, [token, setToken]);

  const value = {
    token,
    setToken,
    user,
    setUser,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx;
}
