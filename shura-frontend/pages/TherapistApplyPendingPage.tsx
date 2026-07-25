import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

const TherapistApplyPendingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg p-10 text-center">
        <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4 group">
          <Logo className="h-8 w-8 text-brown-dark" />
          <h3 className="font-serif text-3xl font-bold text-brown-dark group-hover:text-brown-soft transition-colors">Shura</h3>
        </Link>
        <h1 className="text-3xl font-serif font-bold text-brown-dark mb-3">Application Received</h1>
        <p className="text-brown-soft text-lg">
          Thank you for applying. Our admin team is now reviewing your therapist profile. You&apos;ll receive an update once approved.
        </p>
      </div>
    </div>
  );
};

export default TherapistApplyPendingPage;
