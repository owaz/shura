import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';

const AdminLoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { adminLogin } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand p-6">
      <div className="w-full max-w-md bg-ivory rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 mb-2">
            <Logo className="h-8 w-8" />
            <span className="font-serif text-3xl font-bold text-brown-dark">Shura</span>
          </Link>
          <h1 className="font-serif text-3xl font-bold text-brown-dark">Admin Login</h1>
          <p className="text-brown-soft mt-2">Use your admin Auth0 account with MFA.</p>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brown-soft text-white py-3 rounded-lg font-semibold hover:bg-brown-dark transition-colors disabled:opacity-60"
          >
            {loading ? 'Redirecting...' : 'Continue to Admin Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
