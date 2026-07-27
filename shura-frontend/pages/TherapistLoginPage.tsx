import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';

const TherapistLoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { therapistLogin } = useAuth();
  const hasRedirectedRef = useRef(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await therapistLogin('', '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    void handleLogin();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand p-6">
      <div className="max-w-md w-full bg-ivory p-8 rounded-xl shadow-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4 group">
            <Logo className="h-8 w-8 text-brown-dark" />
            <h3 className="font-serif text-3xl font-bold text-brown-dark group-hover:text-brown-soft transition-colors">Shura</h3>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-brown-dark">Redirecting...</h1>
          <p className="text-brown-soft">Taking you to secure therapist login.</p>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-brown-soft text-white py-3 px-6 rounded-lg font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Redirecting...' : 'Continue to Therapist Login'}
        </button>

        <div className="mt-6 text-center">
          <p className="text-sm text-brown-soft">
            New to our network?{' '}
            <Link to="/therapist-apply" className="font-semibold text-brown-soft hover:underline">
              Apply Here
            </Link>
          </p>
          <p className="mt-4 text-sm text-brown-soft">
            <Link to="/login-hub" className="font-semibold text-taupe hover:underline">
              &larr; Back to portal selection
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TherapistLoginPage;
