import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Email validation
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in both fields.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      const redirectTo = location.state?.redirectTo || '/therapists';
      navigate(redirectTo, { state: location.state?.paymentData });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cream">
      <div className="container mx-auto">
        <div className="max-w-md mx-auto bg-white p-10 rounded-2xl shadow-lg">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4 group">
              <Logo className="h-8 w-8 text-brown-dark" />
              <h3 className="font-serif text-3xl font-bold text-brown-dark group-hover:text-brown-soft transition-colors">
                Shura
              </h3>
            </Link>
            <h1 className="text-3xl font-serif font-bold text-brown-dark mt-2">Welcome Back</h1>
            <p className="text-brown-soft mt-1">Please sign in to continue.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-brown-soft mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full bg-ivory border-transparent rounded-lg shadow-sm py-3 px-4 focus:ring-2 focus:ring-brown-soft/50 focus:border-brown-soft placeholder:text-taupe/80"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-brown-soft mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full bg-ivory border-transparent rounded-lg shadow-sm py-3 px-4 pr-12 focus:ring-2 focus:ring-brown-soft/50 focus:border-brown-soft placeholder:text-taupe/80"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brown-soft hover:text-brown-dark transition-colors disabled:opacity-50"
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M15.171 13.576l1.414 1.414a1 1 0 00.707-.293l-1.414-1.414a1 1 0 00-.707.293zM6.586 15.414l-1.473 1.473a1 1 0 001.414 1.414l1.414-1.414a1 1 0 00-1.355-1.473z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brown-soft text-white py-3 px-6 rounded-full font-semibold hover:bg-opacity-90 transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </div>
          </form>
          <div className="mt-8 text-center">
            <p className="text-sm text-brown-soft">
              Don't have an account?{' '}
              <Link to="/signup" className="font-semibold text-brown-soft hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
