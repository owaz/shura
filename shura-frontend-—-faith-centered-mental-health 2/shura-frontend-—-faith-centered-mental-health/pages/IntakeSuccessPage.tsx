import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { CheckIcon } from '../components/Icons';

const IntakeSuccessPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-sand p-4">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-gold/20 flex items-center justify-center">
            <CheckIcon className="w-10 h-10 text-brown-soft" />
          </div>
        </div>
        
        <Logo className="h-12 w-12 mx-auto mb-4 text-brown-soft" />
        
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-brown-dark mb-4">
          Thank You!
        </h1>
        
        <p className="text-lg text-brown-soft mb-6">
          Your intake form has been submitted successfully. Your therapist will review this information before your first session.
        </p>
        
        <p className="text-brown-soft mb-8">
          We'll be in touch soon with next steps for scheduling your first appointment.
        </p>
        
        <div className="bg-ivory/50 rounded-lg p-6 mb-8">
          <h2 className="font-semibold text-brown-dark mb-2">What happens next?</h2>
          <ul className="text-left text-brown-soft space-y-2 text-sm">
            <li>✓ Your therapist will review your intake form</li>
            <li>✓ We'll match you with the best therapist for your needs</li>
            <li>✓ You'll receive a call/email to schedule your first session</li>
            <li>✓ Your first session will be focused on building rapport and understanding your goals</li>
          </ul>
        </div>
        
        <Link 
          to="/" 
          className="inline-block bg-brown-soft text-white py-3 px-8 rounded-xl font-bold shadow-md hover:bg-opacity-95 transition-all"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default IntakeSuccessPage;
