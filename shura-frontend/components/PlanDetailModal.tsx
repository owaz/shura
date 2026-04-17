import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseIcon } from './Icons';
import type { SubscriptionPlan } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface PlanDetailModalProps {
  plan: SubscriptionPlan;
  onClose: () => void;
}

const PlanDetailModal: React.FC<PlanDetailModalProps> = ({ plan, onClose }) => {
  const { isAuthenticated, questionnaireCompleted } = useAuth();
  const navigate = useNavigate();

  // Prevent clicks inside the modal from closing it
  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleSelectPlan = () => {
    onClose(); // Close the modal first
    if (isAuthenticated) {
        if (questionnaireCompleted) {
          navigate('/therapists');
        } else {
          navigate('/questionnaire');
        }
    } else {
        navigate('/login');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
    >
      <div 
        className="bg-ivory rounded-xl shadow-2xl w-full max-w-lg p-8 relative transform transition-all duration-300 scale-95 animate-modal-enter"
        onClick={handleModalContentClick}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-taupe hover:text-brown-dark transition-colors"
          aria-label="Close plan details"
        >
          <CloseIcon className="h-7 w-7" />
        </button>
        
        <div className="text-center">
          <h2 id="plan-modal-title" className="text-3xl font-serif font-bold text-brown-soft mb-2">{plan.name}</h2>
          <div className="bg-green-100 text-green-800 text-sm font-bold inline-block px-3 py-1 rounded-full self-center mb-6">{plan.savings}</div>
        </div>

        <div className="my-6 border-t border-sand"></div>

        <div className="text-left space-y-6">
          <div>
            <h3 className="font-semibold text-brown-dark mb-3">Pricing Breakdown</h3>
            <div className="space-y-3 text-sm border border-sand p-4 rounded-lg">
                {plan.prices.map(({ level, price }) => (
                    <div key={level} className="flex justify-between items-baseline">
                        <span className="text-brown-soft">{level} Therapist:</span>
                        <span className="font-bold text-brown-dark text-xl">{price} / month</span>
                    </div>
                ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-brown-dark mb-2">Best For:</h3>
            <p className="text-brown-soft">{plan.bestFor}</p>
          </div>
          <div>
            <h3 className="font-semibold text-brown-dark mb-2">Description:</h3>
            <p className="text-brown-soft">{plan.description}</p>
          </div>
          <div>
            <h3 className="font-semibold text-brown-dark mb-2">What's Included:</h3>
            <ul className="space-y-2">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-brown-soft">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="mt-8">
          <button
            onClick={handleSelectPlan}
            className="w-full block text-center bg-brown-soft text-white py-3 px-6 rounded-lg font-semibold hover:bg-opacity-90 transition-colors"
          >
            Select Plan & Find a Therapist
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanDetailModal;