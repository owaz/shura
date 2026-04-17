import React, { createContext, useState, useContext, ReactNode } from 'react';

const API_URL = 'http://localhost:5001/api';

interface User {
  id: string;
  email: string;
  full_name?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: User | null;
  questionnaireCompleted: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  completeQuestionnaire: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('shura-current-user');
    return stored ? JSON.parse(stored) : null;
  });

  const [questionnaireCompleted, setQuestionnaireCompleted] = useState<boolean>(() => {
    const user = localStorage.getItem('shura-current-user');
    if (user) {
      const parsed = JSON.parse(user);
      return localStorage.getItem(`shura-q-completed-${parsed.email}`) === 'true';
    }
    return false;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!currentUser);
  const [initializing, setInitializing] = React.useState<boolean>(true);

  // On mount, validate existing token and refresh current user state
  React.useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('shura-auth-token');
      if (!token) return;

      try {
        const res = await fetch(`${API_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          // token invalid or expired — clear local storage and reset auth
          localStorage.removeItem('shura-auth-token');
          localStorage.removeItem('shura-current-user');
          localStorage.removeItem('shura-auth');
          setCurrentUser(null);
          setIsAuthenticated(false);
          return;
        }

        const data = await res.json();
        const user: User = { id: data.user.id, email: data.user.email, full_name: data.user.full_name };
        localStorage.setItem('shura-current-user', JSON.stringify(user));
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch (err) {
        // network or other error — be conservative and clear auth state
        localStorage.removeItem('shura-auth-token');
        localStorage.removeItem('shura-current-user');
        localStorage.removeItem('shura-auth');
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    };

    // Run validation and mark initialization complete so children don't mount
    validateToken().finally(() => setInitializing(false));
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.full_name,
      };

      localStorage.setItem('shura-auth-token', data.token);
      localStorage.setItem('shura-current-user', JSON.stringify(user));
      localStorage.setItem('shura-auth', 'true');

      setCurrentUser(user);
      setIsAuthenticated(true);

      // Check if questionnaire is completed
      const hasCompleted = localStorage.getItem(`shura-q-completed-${email}`) === 'true';
      setQuestionnaireCompleted(hasCompleted);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, fullName: string): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Signup failed');
      }

      const data = await response.json();
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.full_name,
      };

      localStorage.setItem('shura-auth-token', data.token);
      localStorage.setItem('shura-current-user', JSON.stringify(user));
      localStorage.setItem('shura-auth', 'true');
      localStorage.setItem(`shura-q-completed-${email}`, 'false');

      setCurrentUser(user);
      setQuestionnaireCompleted(false);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('shura-current-user');
    localStorage.removeItem('shura-auth');
    localStorage.removeItem('shura-auth-token');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setQuestionnaireCompleted(false);
  };

  const completeQuestionnaire = () => {
    if (currentUser) {
      localStorage.setItem(`shura-q-completed-${currentUser.email}`, 'true');
      setQuestionnaireCompleted(true);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        questionnaireCompleted,
        login,
        signup,
        logout,
        completeQuestionnaire,
      }}
    >
      {initializing ? null : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
