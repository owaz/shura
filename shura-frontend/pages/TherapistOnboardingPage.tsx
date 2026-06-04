
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from '../components/Icons';
import { Logo } from '../components/Logo';
import { apiFetch } from '../config/api';

const totalSteps = 4;
const sessionTypesOptions = ['Video', 'Audio', 'Text'];

const TherapistOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    licenseNumber: '',
    experience: '',
    specialties: '',
    sessionTypes: [] as string[],
    rate60min: '',
    availability: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSessionTypeToggle = (type: string) => {
    setFormData(prev => ({
      ...prev,
      sessionTypes: prev.sessionTypes.includes(type)
        ? prev.sessionTypes.filter(t => t !== type)
        : [...prev.sessionTypes, type]
    }));
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    try {
      const response = await apiFetch('/auth/therapist/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          licenseNumber: formData.licenseNumber,
          experience: formData.experience,
          specialties: formData.specialties,
          sessionTypes: formData.sessionTypes,
          rate60min: formData.rate60min,
          availability: formData.availability,
          password: formData.password,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Application submission failed');
      }
      alert("Application submitted successfully! You will be notified via email once your application is reviewed.");
      navigate('/therapist-login');
    } catch (error) {
      console.error('Application submission error:', error);
      alert('Failed to submit application. Please try again.');
    }
  };

  const isNextDisabled = () => {
    if (currentStep === 1) {
        return !formData.fullName || !formData.email || !formData.phone;
    }
    if (currentStep === 2) {
        return !formData.licenseNumber || !formData.experience || !formData.specialties;
    }
    if (currentStep === 3) {
        return formData.sessionTypes.length === 0 || !formData.rate60min || !formData.availability;
    }
    return false;
  };

  const isSubmitDisabled = () => {
    return !formData.password || !formData.confirmPassword || formData.password !== formData.confirmPassword;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div key={1} className="animate-fade-in w-full">
            <h2 className="text-2xl md:text-3xl font-serif font-semibold text-brown-dark mb-2">Personal Information</h2>
            <p className="text-brown-soft mb-6">Let's start with the basics.</p>
            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-brown-soft">Full Name</label>
                <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" required />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-brown-soft">Email Address</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" required />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-brown-soft">Phone Number</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" required />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div key={2} className="animate-fade-in w-full">
            <h2 className="text-2xl md:text-3xl font-serif font-semibold text-brown-dark mb-2">Professional Credentials</h2>
            <p className="text-brown-soft mb-6">Tell us about your qualifications and expertise.</p>
             <div className="space-y-4">
              <div>
                <label htmlFor="licenseNumber" className="block text-sm font-medium text-brown-soft">License Type & Number</label>
                <input type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" placeholder="e.g., RCI A12345" required />
              </div>
              <div>
                <label htmlFor="experience" className="block text-sm font-medium text-brown-soft">Years of Experience</label>
                <input type="number" name="experience" value={formData.experience} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" required />
              </div>
              <div>
                <label htmlFor="specialties" className="block text-sm font-medium text-brown-soft">Specialties & Approach</label>
                <textarea name="specialties" value={formData.specialties} onChange={handleChange} rows={4} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" placeholder="e.g., CBT, Faith-based counseling, Couples therapy..." required></textarea>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
            <div key={3} className="animate-fade-in w-full">
                <h2 className="text-2xl md:text-3xl font-serif font-semibold text-brown-dark mb-2">Practice Details</h2>
                <p className="text-brown-soft mb-6">Define how you will connect with clients.</p>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-brown-soft mb-2">Session Types Offered</label>
                        <div className="flex flex-wrap gap-4">
                            {sessionTypesOptions.map(type => (
                                <label key={type} className={`flex items-center gap-3 cursor-pointer p-3 border-2 rounded-lg transition-colors bg-white ${
                                    formData.sessionTypes.includes(type) ? 'border-brown-dark' : 'border-sand hover:border-taupe/50'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={formData.sessionTypes.includes(type)}
                                        onChange={() => handleSessionTypeToggle(type)}
                                        className="sr-only"
                                    />
                                    <div className={`w-6 h-6 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                                        formData.sessionTypes.includes(type) ? 'bg-brown-dark border-brown-dark' : 'bg-white border-taupe'
                                    }`}>
                                        {formData.sessionTypes.includes(type) && <CheckIcon className="w-4 h-4 text-white" />}
                                    </div>
                                    <span className="font-medium text-brown-dark select-none">{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="rate60min" className="block text-sm font-medium text-brown-soft">Standard Rate (per 60-min session)</label>
                        <input type="number" name="rate60min" value={formData.rate60min} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" placeholder="e.g., 1200" required />
                    </div>
                    <div>
                        <label htmlFor="availability" className="block text-sm font-medium text-brown-soft">General Availability</label>
                        <textarea name="availability" value={formData.availability} onChange={handleChange} rows={3} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" placeholder="e.g., Weekday evenings (6 PM - 10 PM IST), Flexible on weekends." required></textarea>
                    </div>
                </div>
            </div>
        );
      case 4:
        return (
          <div key={4} className="animate-fade-in w-full">
            <h2 className="text-2xl md:text-3xl font-serif font-semibold text-brown-dark mb-2">Create Your Account</h2>
            <p className="text-brown-soft mb-6">Set a secure password for your therapist portal.</p>
             <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-brown-soft">Password</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" required />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-brown-soft">Confirm Password</label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-3 px-4 focus:ring-brown-soft focus:border-brown-soft" required />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-sand text-brown-dark font-sans">
      <header className="absolute top-0 left-0 w-full p-6 z-10">
          <Link to="/" className="flex items-center gap-2 text-3xl font-serif font-bold text-brown-dark hover:opacity-80 transition-opacity">
              <Logo className="h-8 w-8" />
              <span>Shura</span>
          </Link>
      </header>
      <main className="flex-grow flex items-center justify-center p-4 md:p-6 pt-24 md:pt-6">
        <div className="w-full max-w-xl bg-ivory p-8 rounded-xl shadow-lg">
            {renderStep()}
        </div>
      </main>
      
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
                    Back
                </button>
            </div>
            <span className="text-sm font-semibold text-brown-soft">{currentStep} of {totalSteps}</span>
            <div>
                 {currentStep < totalSteps ? (
                <button 
                  type="button" 
                  onClick={handleNext}
                  disabled={isNextDisabled()}
                  className="bg-brown-soft text-white py-3 px-8 rounded-xl font-bold shadow-md hover:bg-opacity-95 transition-all duration-300 disabled:bg-taupe/50 disabled:cursor-not-allowed flex items-center gap-2 group transform hover:-translate-y-0.5"
                >
                  Next
                  <ChevronRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitDisabled()}
                  className="bg-brown-soft text-white py-3 px-8 rounded-xl font-bold shadow-md hover:bg-opacity-95 transition-all duration-300 disabled:bg-taupe/50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                >
                  Submit Application
                </button>
              )}
            </div>
        </div>
      </footer>
    </div>
  );
};

export default TherapistOnboardingPage;
