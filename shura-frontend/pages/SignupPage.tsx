import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';

const SignupPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim()) {
      setError('Please enter your full name and email.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await signup(email, '', name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="py-20 bg-ivory">
      <div className="container mx-auto px-6">
        <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg">
          <div className="text-center mb-8">
            <Link to="/" className="flex items-center justify-center gap-2 mb-4 group">
              <Logo className="h-8 w-8 text-brown-dark" />
              <h3 className="font-serif text-3xl font-bold text-brown-dark group-hover:text-brown-soft transition-colors">
                Shura
              </h3>
            </Link>
            <h1 className="text-2xl font-serif font-bold text-brown-dark">Create Your Account</h1>
            <p className="text-brown-soft">Sign up securely with Auth0 Universal Login.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-brown-soft">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full bg-ivory border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-brown-soft">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full bg-ivory border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brown-soft text-white py-3 px-6 rounded-lg font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Redirecting...' : 'Continue to Signup'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <p className="text-sm text-brown-soft">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-brown-soft hover:underline">
                Sign In
              </Link>
            </p>
            <div className="pt-4 border-t border-sand">
              <p className="text-sm text-brown-soft mb-2">Are you a therapist?</p>
              <Link to="/therapist-apply" className="text-brown-soft font-semibold hover:underline inline-flex items-center gap-1">
                Apply to Join Our Network →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
