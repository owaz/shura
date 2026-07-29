import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';

const VerifyEmailPage: React.FC = () => {
  const { state } = useLocation() as { state?: { email?: string } };
  const { login } = useAuth();
  const email = state?.email;

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-10 text-center">
        <Link to="/" className="inline-flex items-center justify-center gap-2 mb-6 group">
          <Logo className="h-8 w-8 text-brown-dark" />
          <h3 className="font-serif text-3xl font-bold text-brown-dark group-hover:text-brown-soft transition-colors">
            Shura
          </h3>
        </Link>

        {/* Email icon */}
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-sand mb-6 mx-auto">
          <svg className="h-8 w-8 text-brown-soft" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-3xl font-serif font-bold text-brown-dark mb-3">
          Check Your Email
        </h1>

        <p className="text-brown-soft text-lg mb-2">
          We&apos;ve sent a verification link to:
        </p>
        {email && (
          <p className="font-semibold text-brown-dark text-lg mb-4">{email}</p>
        )}

        <p className="text-brown-soft mb-6">
          Please click the link in the email to verify your account. If you don&apos;t see it,
          check your <strong>junk or spam folder</strong>.
        </p>

        <div className="bg-sand rounded-xl p-4 mb-8 text-left space-y-2">
          <p className="text-sm text-brown-soft font-medium">Next steps:</p>
          <ol className="text-sm text-brown-soft list-decimal list-inside space-y-1">
            <li>Open the email from Shura</li>
            <li>Click <strong>Verify your email address</strong></li>
            <li>Return here and sign in</li>
          </ol>
        </div>

        <button
          type="button"
          onClick={() => void login('', '')}
          className="w-full bg-brown-soft text-white py-3 px-6 rounded-full font-semibold hover:bg-opacity-90 transition-colors text-lg mb-4"
        >
          Continue to Login
        </button>

        <p className="text-sm text-brown-soft">
          <Link to="/" className="font-semibold hover:underline">
            &larr; Back to home
          </Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
