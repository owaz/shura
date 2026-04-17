
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';

const TherapistLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      try {
        const response = await fetch('http://localhost:5001/api/auth/therapist/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Login failed');
        }
        const data = await response.json();
        // For now, just navigate; in full implementation, set auth context
        localStorage.setItem('shura-auth-token', data.token);
        localStorage.setItem('shura-current-user', JSON.stringify(data.therapist));
        localStorage.setItem('shura-auth', 'true');
        navigate('/therapist-portal/dashboard');
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Login failed. Please try again.');
      }
    } else {
      alert('Please fill in both fields.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand p-6">
      <div className="max-w-md w-full bg-ivory p-8 rounded-xl shadow-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4 group">
              <Logo className="h-8 w-8 text-brown-dark" />
              <h3 className="font-serif text-3xl font-bold text-brown-dark group-hover:text-brown-soft transition-colors">Shura</h3>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-brown-dark">Therapist Portal</h1>
          <p className="text-brown-soft">Sign in to manage your practice.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-brown-soft">Email Address</label>
            <input 
              type="email" 
              id="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" 
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-brown-soft">Password</label>
            <input 
              type="password" 
              id="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" 
              required
            />
          </div>
          <div>
            <button type="submit" className="w-full bg-brown-soft text-white py-3 px-6 rounded-lg font-semibold hover:bg-opacity-90 transition-colors">
              Sign In
            </button>
          </div>
        </form>
        <div className="mt-6 text-center">
          <p className="text-sm text-brown-soft">
            New to our network?{' '}
            <Link to="/join-our-network" className="font-semibold text-brown-soft hover:underline">
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