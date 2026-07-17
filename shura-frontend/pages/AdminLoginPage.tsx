import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../config/api';
import { Logo } from '../components/Logo';

const ADMIN_TOKEN_KEY = 'shura-admin-token';

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiFetch('/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Admin login failed');
      }
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      navigate('/admin/therapists/pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin login failed');
    } finally {
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
          <p className="text-brown-soft mt-2">Approve therapist applications.</p>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brown-soft">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brown-soft">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brown-soft text-white py-3 rounded-lg font-semibold hover:bg-brown-dark transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In as Admin'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
