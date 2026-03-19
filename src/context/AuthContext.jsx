/**
 * Noorix Auth + Session Timeout — تتبع النشاط وتوجيه المستخدم لصفحة الدخول عند الخمول.
 * يخزن أيضاً المستخدم (role, companyIds) للصلاحيات ومبدّل الشركات.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { registerOn401Handler } from '../services/api';
import { setAuthToken, setStoredUser, getAuthToken, getStoredUser, clearAuth } from '../services/authStore';

const IDLE_MS = 15 * 60 * 1000; // 15 دقيقة

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getAuthToken());
  const [user, setUserState] = useState(getStoredUser);
  const [lastActivity, setLastActivity] = useState(() => Date.now());

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

  useEffect(() => {
    const handlers = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', handlers);
    window.addEventListener('keydown', handlers);
    window.addEventListener('click', handlers);
    return () => {
      window.removeEventListener('mousemove', handlers);
      window.removeEventListener('keydown', handlers);
      window.removeEventListener('click', handlers);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => {
      if (Date.now() - lastActivity >= IDLE_MS) {
        setToken(null);
        setLastActivity(Date.now());
        window.location.replace('/login');
      }
    }, 60 * 1000);
    return () => clearInterval(t);
  }, [token, lastActivity, setToken]);

  const value = {
    token,
    setToken,
    user,
    setUser,
    isAuthenticated: !!token,
    touchActivity: () => setLastActivity(Date.now()),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx;
}
