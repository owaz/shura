import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { IndividualIcon, CouplesIcon } from '../components/Icons'; // Using these for visual distinction
import { useAuth } from '../contexts/AuthContext';

const LoginHubPage: React.FC = () => {
  const { login, therapistLogin } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand p-6">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-10">
            <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4 group">
                <Logo className="h-10 w-10 text-brown-dark" />
                <h1 className="font-serif text-4xl font-bold text-brown-dark group-hover:text-brown-soft transition-colors">Shura</h1>
            </Link>
            <p className="text-xl font-serif text-brown-soft">Welcome. Please choose your portal.</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Client Portal Card */}
          <button
            type="button"
            onClick={() => void login('', '')}
            className="block w-full bg-ivory p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center group"
          >
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-sand mb-5">
              <IndividualIcon className="h-8 w-8 text-brown-soft" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-brown-dark mb-2">Client Portal</h2>
            <p className="text-brown-soft mb-6">Access your dashboard, book sessions, and continue your personal healing journey.</p>
            <span className="font-semibold text-brown-soft group-hover:underline">
              Client Login &rarr;
            </span>
          </button>
          
          {/* Therapist Portal Card */}
          <button
            type="button"
            onClick={() => void therapistLogin('', '')}
            className="block w-full bg-ivory p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center group"
          >
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-sand mb-5">
              <CouplesIcon className="h-8 w-8 text-brown-soft" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-brown-dark mb-2">Therapist Portal</h2>
            <p className="text-brown-soft mb-6">Manage your profile, view your schedule, and connect with individuals seeking guidance.</p>
            <span className="font-semibold text-brown-soft group-hover:underline">
              Therapist Login &rarr;
            </span>
          </button>
        </div>
        <div className="mt-6 text-center">
          <p className="text-sm text-brown-soft">
            New to our network?{' '}
            <Link to="/therapist-apply" className="font-semibold text-brown-soft hover:underline">
              Apply Here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginHubPage;