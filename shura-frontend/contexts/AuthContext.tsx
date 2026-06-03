import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { apiFetch, CSRF_STORAGE_KEY } from '../config/api';

export type UserRole = 'client' | 'therapist';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: User | null;
  role: UserRole | null;
  questionnaireCompleted: boolean;
  csrfToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  therapistLogin: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<User | null>;
  completeQuestionnaire: () => void;
}

const CURRENT_USER_STORAGE_KEY = 'shura-current-user';
const LEGACY_AUTH_FLAG_KEY = 'shura-auth';
const LEGACY_TOKEN_KEY = 'shura-auth-token';

const AuthContext = createContext<AuthContextType | null>(null);

const readStoredUser = (): User | null => {
  try {
    const stored = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed?.id || !parsed?.email) return null;
    return {
      id: String(parsed.id),
      email: parsed.email,
      full_name: parsed.full_name,
      role: parsed.role === 'therapist' ? 'therapist' : 'client',
    };
  } catch {
    return null;
  }
};

const normalizeUser = (user: any, fallbackRole: UserRole): User => ({
  id: String(user.id),
  email: user.email,
  full_name: user.full_name,
  role: user.role === 'therapist' || user.role === 'client' ? user.role : fallbackRole,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => readStoredUser());
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [csrfToken, setCsrfToken] = useState<string | null>(() => sessionStorage.getItem(CSRF_STORAGE_KEY));

  const [questionnaireCompleted, setQuestionnaireCompleted] = useState<boolean>(() => {
    const user = readStoredUser();
    return user ? localStorage.getItem(`shura-q-completed-${user.email}`) === 'true' : false;
  });

  const persistAuth = useCallback((user: User, nextCsrfToken?: string | null) => {
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(LEGACY_AUTH_FLAG_KEY, 'true');
    localStorage.removeItem(LEGACY_TOKEN_KEY);

    if (nextCsrfToken) {
      sessionStorage.setItem(CSRF_STORAGE_KEY, nextCsrfToken);
      setCsrfToken(nextCsrfToken);
    }

    setCurrentUser(user);
    setAuthStatus('authenticated');
    setQuestionnaireCompleted(localStorage.getItem(`shura-q-completed-${user.email}`) === 'true');
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    localStorage.removeItem(LEGACY_AUTH_FLAG_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
    setCsrfToken(null);
    setCurrentUser(null);
    setQuestionnaireCompleted(false);
    setAuthStatus('unauthenticated');
  }, []);

  const refreshSession = useCallback(async (): Promise<User | null> => {
    const response = await apiFetch('/auth/refresh', { method: 'POST' });
    if (!response.ok) return null;

    const data = await response.json();
    const user = normalizeUser(data.user, data.user?.role === 'therapist' ? 'therapist' : 'client');
    persistAuth(user, data.csrfToken);
    return user;
  }, [persistAuth]);

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      try {
        const response = await apiFetch('/auth/session');
        if (response.ok) {
          const data = await response.json();
          if (isMounted) persistAuth(normalizeUser(data.user, data.user?.role === 'therapist' ? 'therapist' : 'client'));
          return;
        }

        const refreshedUser = await refreshSession();
        if (!refreshedUser && isMounted) clearAuth();
      } catch (error) {
        console.error('Session bootstrap error:', error);
        if (isMounted) clearAuth();
      }
    };

    bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, [clearAuth, persistAuth, refreshSession]);

  const login = async (email: string, password: string): Promise<void> => {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    persistAuth(normalizeUser(data.user, 'client'), data.csrfToken);
  };

  const therapistLogin = async (email: string, password: string): Promise<void> => {
    const response = await apiFetch('/auth/therapist/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    persistAuth(normalizeUser(data.therapist, 'therapist'), data.csrfToken);
  };

  const signup = async (email: string, password: string, fullName: string): Promise<void> => {
    const response = await apiFetch('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }

    const data = await response.json();
    const user = normalizeUser(data.user, 'client');
    localStorage.setItem(`shura-q-completed-${email}`, 'false');
    persistAuth(user, data.csrfToken);
    setQuestionnaireCompleted(false);
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
    }
  };

  const completeQuestionnaire = () => {
    if (currentUser) {
      localStorage.setItem(`shura-q-completed-${currentUser.email}`, 'true');
      setQuestionnaireCompleted(true);
    }
  };

  const value = useMemo<AuthContextType>(() => ({
    isAuthenticated: authStatus === 'authenticated',
    isLoading: authStatus === 'loading',
    currentUser,
    role: currentUser?.role ?? null,
    questionnaireCompleted,
    csrfToken,
    login,
    therapistLogin,
    signup,
    logout,
    refreshSession,
    completeQuestionnaire,
  }), [authStatus, currentUser, questionnaireCompleted, csrfToken, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
