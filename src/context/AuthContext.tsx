/**
 * Noorix Auth — يخزن المستخدم (role, companyIds) للصلاحيات ومبدّل الشركات.
 * انتهاء الجلسة: عند تسجيل الخروج أو انتهاء صلاحية JWT (JWT_EXPIRES_IN) وليس بسبب الخمول.
 */
import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { registerOn401Handler } from '../services/api';
import { setAuthToken, setStoredUser, getAuthToken, getStoredUser, clearAuth } from '../services/authStore';
import type { AuthSessionUser } from '../types/api';

export type AuthContextValue = {
  token: string | null;
  setToken: (value: string | null) => void;
  user: AuthSessionUser | null;
  setUser: (value: AuthSessionUser | null) => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getAuthToken());
  const [user, setUserState] = useState<AuthSessionUser | null>(() => getStoredUser());

  const setToken = useCallback((value: string | null) => {
    setTokenState(value);
    if (!value) {
      setUserState(null);
      clearAuth();
    } else {
      setAuthToken(value);
    }
  }, []);

  const setUser = useCallback((value: AuthSessionUser | null) => {
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

  const value: AuthContextValue = {
    token,
    setToken,
    user,
    setUser,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
