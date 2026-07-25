import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';

const LoginPage: React.FC = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login('', '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
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
            <p className="text-brown-soft mt-1">Continue securely with Auth0 Universal Login.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-brown-soft text-white py-3 px-6 rounded-full font-semibold hover:bg-opacity-90 transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Redirecting...' : 'Continue to Login'}
          </button>

          <div className="mt-8 text-center">
            <p className="text-sm text-brown-soft">
              Don&apos;t have an account?{' '}
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
