import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';

const TherapistApplyPage: React.FC = () => {
  const { therapistSignup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApply = async () => {
    setLoading(true);
    setError('');
    try {
      await therapistSignup();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start therapist signup.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand p-6">
      <div className="w-full max-w-2xl bg-ivory rounded-2xl shadow-lg p-10 text-center">
        <Link to="/" className="inline-flex items-center justify-center gap-2 mb-6 group">
          <Logo className="h-8 w-8 text-brown-dark" />
          <h3 className="font-serif text-3xl font-bold text-brown-dark group-hover:text-brown-soft transition-colors">Shura</h3>
        </Link>
        <h1 className="text-3xl font-serif font-bold text-brown-dark mb-3">Apply as a Therapist</h1>
        <p className="text-brown-soft mb-8">
          Create your therapist identity first, then complete your professional profile in the next step.
        </p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <button
          type="button"
          onClick={handleApply}
          disabled={loading}
          className="bg-brown-soft text-white py-3 px-8 rounded-lg font-semibold hover:bg-brown-dark transition-colors disabled:opacity-60"
        >
          {loading ? 'Redirecting...' : 'Start Therapist Signup'}
        </button>
      </div>
    </div>
  );
};

export default TherapistApplyPage;
