

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from '../components/Icons';
import { Logo } from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';

const concernsList = ['Anxiety', 'Depression', 'Marital Counseling', 'Family Conflict', 'Trauma', 'Grief', 'Personal Growth', 'Self-Esteem', 'Parenting', 'Spirituality'];
const genders = ['Female', 'Male', 'No Preference'];
const totalSteps = 4;

const QuestionnairePage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  
  const [agreed, setAgreed] = useState(false);
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [notes, setNotes] = useState('');

  const { completeQuestionnaire } = useAuth();

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConcernToggle = (concern: string) => {
    setSelectedConcerns(prev => 
      prev.includes(concern) ? prev.filter(c => c !== concern) : [...prev, concern]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get user from localStorage - use correct key 'shura-current-user'
    const userStr = localStorage.getItem('shura-current-user');
    let userId = null;
    
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        userId = userData.id;
        console.log('📋 Found user ID:', userId);
      } catch (err) {
        console.error('Failed to parse user data:', err);
      }
    }

    // Send questionnaire data to backend
    if (userId) {
      try {
        const API_URL = 'http://localhost:5001';
        console.log('📤 Sending questionnaire data to backend...');
        const response = await fetch(`${API_URL}/api/auth/questionnaire`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            concerns: selectedConcerns,
            gender: selectedGender,
            notes: notes
          }),
        });

        const result = await response.json();
        
        if (response.ok) {
          console.log('✅ Questionnaire submitted successfully:', result);
        } else {
          console.error('❌ Failed to submit questionnaire:', result);
        }
      } catch (err) {
        console.error('❌ Error submitting questionnaire:', err);
      }
    } else {
      console.warn('⚠️ No user ID found - questionnaire not sent to backend');
    }

    completeQuestionnaire(); // Mark questionnaire as completed for this user
    sessionStorage.setItem('shura-just-completed-q', 'true'); // Flag to prevent mood tracker on first visit
    navigate('/therapists', { 
        state: {
            concerns: selectedConcerns,
            gender: selectedGender,
            notes: notes
        }
    });
  };

  const isNextDisabled = () => {
    if (currentStep === 1) return !agreed;
    if (currentStep === 2) return selectedConcerns.length === 0;
    if (currentStep === 3) return selectedGender === '';
    return false;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div key={1} className="animate-fade-in text-center w-full">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-brown-dark mb-4">Healing begins with understanding</h2>
            <p className="text-lg text-brown-soft max-w-2xl mx-auto mb-10">This form helps us understand you better. Please fill it using the details of the person receiving care.</p>
            <div className="max-w-md mx-auto">
                <label 
                    className={`block p-4 rounded-lg cursor-pointer transition-all duration-200 text-left font-medium text-lg border-2 ${agreed ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}
                    onClick={() => setAgreed(true)}
                >
                    <div className="flex items-center">
                        <div className={`w-7 h-7 rounded-full border-2 ${agreed ? 'border-brown-dark bg-brown-dark' : 'border-taupe'} flex-shrink-0 mr-4 flex items-center justify-center`}>
                           {agreed && <CheckIcon className="w-4 h-4 text-ivory" />}
                        </div>
                        <span>I understand — I’ll fill in the details.</span>
                    </div>
                     <input type="radio" name="agreement" className="hidden" checked={agreed} readOnly />
                </label>
            </div>
          </div>
        );
      case 2:
        return (
          <div key={2} className="animate-fade-in text-center w-full">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-brown-dark mb-4">What brings you to therapy?</h2>
            <p className="text-lg text-brown-soft mb-10">Select all that apply. This helps us understand what you'd like to focus on.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {concernsList.map(concern => (
                <label key={concern} className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors duration-200 text-center font-medium ${selectedConcerns.includes(concern) ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                  <input type="checkbox" className="hidden" checked={selectedConcerns.includes(concern)} onChange={() => handleConcernToggle(concern)} />
                  {concern}
                </label>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
           <div key={3} className="animate-fade-in text-center w-full">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-brown-dark mb-4">Do you have a preference for your therapist's gender?</h2>
            <p className="text-lg text-brown-soft mb-10">Your comfort is our priority. Let us know if you have a preference.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-xl mx-auto">
              {genders.map(gender => (
                <label key={gender} className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors duration-200 text-center font-medium ${selectedGender === gender ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                  <input type="radio" name="gender" className="hidden" checked={selectedGender === gender} onChange={() => setSelectedGender(gender)} />
                  {gender}
                </label>
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div key={4} className="animate-fade-in text-center w-full">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-brown-dark mb-4">Is there anything else you'd like us to know?</h2>
            <p className="text-lg text-brown-soft mb-10">This is optional. You can mention specific language preferences, past therapy experiences, or anything else that might be helpful.</p>
            <textarea 
              id="notes" 
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full bg-ivory border-2 border-taupe/50 rounded-md shadow-sm py-3 px-4 focus:ring-gold focus:border-gold placeholder:text-taupe text-brown-dark" 
              placeholder="e.g., 'I would prefer a therapist who speaks Urdu.'">
            </textarea>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-sand text-brown-dark font-sans antialiased">
      <header className="absolute top-0 left-0 w-full p-6 z-10">
          <Link to="/" className="flex items-center gap-2 text-3xl font-serif font-bold text-brown-dark hover:opacity-80 transition-opacity">
              <Logo className="h-8 w-8" />
              <span>Shura</span>
          </Link>
      </header>
      <div className="flex-grow flex items-center justify-center p-4 md:p-6 pt-24 md:pt-6">
        <div className="w-full max-w-3xl min-h-[450px] flex items-center">
            {renderStep()}
        </div>
      </div>
      
      <footer className="w-full bg-ivory/80 p-4 sticky bottom-0 backdrop-blur-sm border-t border-taupe/20">
          <div className="w-full h-1 bg-taupe/30 absolute top-0 left-0">
            <div className="bg-gold h-full transition-all duration-500" style={{ width: `${(currentStep / totalSteps) * 100}%` }}></div>
          </div>
        <div className="container mx-auto flex justify-between items-center max-w-5xl">
            <div>
                <button 
                    type="button" 
                    onClick={handleBack} 
                    className={`font-semibold transition-opacity duration-300 flex items-center gap-2 group text-brown-soft hover:text-brown-dark ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'opacity-70 hover:opacity-100'}`}
                >
                    <ChevronLeftIcon className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                    Previous
                </button>
            </div>
            <span className="text-sm font-semibold text-brown-soft">{currentStep} of {totalSteps}</span>
            <div>
                 {currentStep < totalSteps ? (
                <button 
                  type="button" 
                  onClick={handleNext} 
                  disabled={isNextDisabled()}
                  className="bg-brown-soft text-white py-3 px-8 rounded-xl font-bold shadow-md shadow-brown-soft/20 hover:bg-opacity-95 transition-all duration-300 disabled:bg-taupe/50 disabled:cursor-not-allowed flex items-center gap-2 group transform hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Next
                  <ChevronRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={handleSubmit}
                  className="bg-brown-soft text-white py-3 px-8 rounded-xl font-bold shadow-md shadow-brown-soft/20 hover:bg-opacity-95 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Find My Therapist
                </button>
              )}
            </div>
        </div>
      </footer>
    </div>
  );
};

export default QuestionnairePage;