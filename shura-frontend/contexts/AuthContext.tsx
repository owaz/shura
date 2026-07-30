import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { apiFetch, getStoredAccessToken, setStoredAccessToken } from '../config/api';

export type UserRole = 'client' | 'therapist' | 'admin';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  status?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: User | null;
  role: UserRole | null;
  questionnaireCompleted: boolean;
  login: (_email: string, _password: string) => Promise<void>;
  therapistLogin: (_email: string, _password: string) => Promise<void>;
  signup: (email: string, _password: string, fullName: string) => Promise<void>;
  therapistSignup: () => Promise<void>;
  adminLogin: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<User | null>;
  completeQuestionnaire: () => void;
}

const CURRENT_USER_STORAGE_KEY = 'shura-current-user';
const QUESTIONNAIRE_KEY_PREFIX = 'shura-q-completed-';

const AuthContext = createContext<AuthContextType | null>(null);

const readStoredUser = (): User | null => {
  try {
    const stored = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed?.id || !parsed?.email) return null;
    const role: UserRole = parsed.role === 'therapist' || parsed.role === 'admin' ? parsed.role : 'client';
    return {
      id: String(parsed.id),
      email: parsed.email,
      full_name: parsed.full_name,
      role,
      status: parsed.status,
    };
  } catch {
    return null;
  }
};

const AuthContextInner: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    isAuthenticated: isAuth0Authenticated,
    isLoading: isAuth0Loading,
    user: auth0User,
    getAccessTokenSilently,
    loginWithRedirect,
    logout: auth0Logout,
  } = useAuth0();

  const [currentUser, setCurrentUser] = useState<User | null>(() => readStoredUser());
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [questionnaireCompleted, setQuestionnaireCompleted] = useState<boolean>(() => {
    const user = readStoredUser();
    return user ? localStorage.getItem(`${QUESTIONNAIRE_KEY_PREFIX}${user.email}`) === 'true' : false;
  });

  const persistUser = useCallback((nextUser: User | null) => {
    if (!nextUser) {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      setCurrentUser(null);
      setQuestionnaireCompleted(false);
      setAuthStatus('unauthenticated');
      return;
    }
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(nextUser));
    setCurrentUser(nextUser);
    setQuestionnaireCompleted(localStorage.getItem(`${QUESTIONNAIRE_KEY_PREFIX}${nextUser.email}`) === 'true');
    setAuthStatus('authenticated');
  }, []);

  const fetchSessionUser = useCallback(async (token: string): Promise<User | null> => {
    const response = await apiFetch('/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const role: UserRole = data.user?.role === 'therapist' || data.user?.role === 'admin' ? data.user.role : 'client';
    return {
      id: String(data.user.id),
      email: data.user.email,
      full_name: data.user.full_name,
      role,
      status: data.user.status,
    };
  }, []);

  const refreshSession = useCallback(async (): Promise<User | null> => {
    if (!isAuth0Authenticated) return null;
    const token = await getAccessTokenSilently();
    setStoredAccessToken(token);
    const user = await fetchSessionUser(token);
    persistUser(user);
    return user;
  }, [fetchSessionUser, getAccessTokenSilently, isAuth0Authenticated, persistUser]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      if (isAuth0Loading) return;
      if (!isAuth0Authenticated) {
        setStoredAccessToken(null);
        if (active) persistUser(null);
        return;
      }
      try {
        const token = await getAccessTokenSilently();
        setStoredAccessToken(token);
        const user = await fetchSessionUser(token);
        if (active) persistUser(user);
      } catch {
        setStoredAccessToken(null);
        if (active) persistUser(null);
      }
    };
    bootstrap();
    return () => {
      active = false;
    };
  }, [fetchSessionUser, getAccessTokenSilently, isAuth0Authenticated, isAuth0Loading, persistUser]);

  const login = useCallback(async () => {
    await loginWithRedirect({
      appState: { returnTo: '/therapists' },
      authorizationParams: { prompt: 'login' },
    });
  }, [loginWithRedirect]);

  const therapistLogin = useCallback(async () => {
    await loginWithRedirect({
      appState: { returnTo: '/therapist-portal/dashboard' },
      authorizationParams: { prompt: 'login', role: 'therapist' },
    });
  }, [loginWithRedirect]);

  const adminLogin = useCallback(async () => {
    await loginWithRedirect({
      appState: { returnTo: '/admin/therapists/pending' },
      authorizationParams: { prompt: 'login', role: 'admin' },
    });
  }, [loginWithRedirect]);

  const signup = useCallback(async (email: string, _password: string, _fullName: string) => {
    await loginWithRedirect({
      appState: { returnTo: '/verify-email', email },
      authorizationParams: {
        screen_hint: 'signup',
        login_hint: email,
      },
    });
  }, [loginWithRedirect]);

  const therapistSignup = useCallback(async () => {
    await loginWithRedirect({
      appState: { returnTo: '/therapist-apply/complete' },
      authorizationParams: {
        screen_hint: 'signup',
        role: 'therapist',
      },
    });
  }, [loginWithRedirect]);

  const logout = useCallback(async () => {
    setStoredAccessToken(null);
    persistUser(null);
    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }, [auth0Logout, persistUser]);

  const completeQuestionnaire = useCallback(() => {
    if (currentUser) {
      localStorage.setItem(`${QUESTIONNAIRE_KEY_PREFIX}${currentUser.email}`, 'true');
      setQuestionnaireCompleted(true);
    }
  }, [currentUser]);

  const value = useMemo<AuthContextType>(() => ({
    isAuthenticated: authStatus === 'authenticated',
    isLoading: authStatus === 'loading' || isAuth0Loading,
    currentUser,
    role: currentUser?.role ?? null,
    questionnaireCompleted,
    login,
    therapistLogin,
    signup,
    therapistSignup,
    adminLogin,
    logout,
    refreshSession,
    completeQuestionnaire,
  }), [authStatus, completeQuestionnaire, currentUser, isAuth0Loading, login, logout, questionnaireCompleted, refreshSession, signup, therapistLogin, therapistSignup, adminLogin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;

  if (!domain || !clientId || !audience) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream text-brown-soft">
        Missing Auth0 configuration. Set VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE.
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        audience,
        redirect_uri: window.location.origin,
      }}
      cacheLocation="localstorage"
      useRefreshTokens
      onRedirectCallback={(appState) => {
        const state = appState as { returnTo?: string; email?: string } | undefined;
        const returnTo = state?.returnTo || window.location.pathname;
        // Pass email as router location state so VerifyEmailPage can display it
        if (state?.email) {
          window.history.replaceState({ email: state.email }, document.title, returnTo);
        } else {
          window.history.replaceState({}, document.title, returnTo);
        }
      }}
    >
      <AuthContextInner>{children}</AuthContextInner>
    </Auth0Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const getActiveAuthToken = () => getStoredAccessToken();
