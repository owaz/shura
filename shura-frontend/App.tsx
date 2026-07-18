
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Outlet } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import TherapistsPage from './pages/TherapistsPage';
import TherapistProfilePage from './pages/TherapistProfilePage';
import ShuraHubPage from './pages/HealingHubPage';
import ContactPage from './pages/ContactPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import QuestionnairePage from './pages/QuestionnairePage';
import ServicesPage from './pages/ServicesPage';
import { AuthProvider } from './contexts/AuthContext';
import ScrollAnimationWrapper from './components/ScrollAnimationWrapper';
import LoginHubPage from './pages/LoginHubPage';
import TherapistLoginPage from './pages/TherapistLoginPage';
import TherapistOnboardingPage from './pages/TherapistOnboardingPage';
import JoinNetworkPage from './pages/JoinNetworkPage';
import ProtectedRoute from './components/ProtectedRoute';
import TherapistPortalLayout from './pages/therapist-portal/TherapistPortalLayout';
import TherapistDashboardPage from './pages/therapist-portal/TherapistDashboardPage';
import TherapistProfileEditorPage from './pages/therapist-portal/TherapistProfileEditorPage';
import TherapistCalendarPage from './pages/therapist-portal/TherapistCalendarPage';
import TherapistPaymentsPage from './pages/therapist-portal/TherapistPaymentsPage';
import TherapistCallPage from './pages/therapist-portal/TherapistCallPage';
import ClientChatPage from './pages/ClientChatPage';
import PaymentPage from './pages/PaymentPage';
import CallPage from './pages/CallPage';
import TherapistChatPage from './pages/therapist-portal/TherapistChatPage';
import TherapistIntakeFormsPage from './pages/therapist-portal/TherapistIntakeFormsPage';
import IntakeFormPage from './pages/IntakeFormPage';
import IntakeSuccessPage from './pages/IntakeSuccessPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminTherapistApprovalsPage from './pages/AdminTherapistApprovalsPage';
import { apiFetch } from './config/api';

const NewsletterSignup: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await apiFetch('/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, optIn }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to subscribe');
      }

      setMessage('Thank you for subscribing! Check your email for updates.');
      setName('');
      setEmail('');
      setOptIn(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-cream">
      <ScrollAnimationWrapper>
        <div className="container mx-auto px-6 py-16 md:py-20">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark mb-4">
              Let's stay in touch
            </h2>
            <p className="text-brown-soft mb-8">Get the latest updates and more.</p>

            {message && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-600 text-sm">{message}</p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white rounded-full py-3 px-5 border-2 border-sand focus:ring-2 focus:ring-brown-soft/50 focus:border-brown-soft/50 transition text-brown-dark placeholder:text-taupe"
                  aria-label="Full Name"
                  required
                  disabled={loading}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white rounded-full py-3 px-5 border-2 border-sand focus:ring-2 focus:ring-brown-soft/50 focus:border-brown-soft/50 transition text-brown-dark placeholder:text-taupe"
                  aria-label="Email"
                  required
                  disabled={loading}
                />
              </div>
              <div className="flex items-center justify-center pt-2">
                <input
                  id="opt-in"
                  name="opt-in"
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="h-4 w-4 bg-white border-2 border-taupe rounded text-brown-dark focus:ring-brown-soft"
                  disabled={loading}
                />
                <label htmlFor="opt-in" className="ml-3 text-sm text-brown-soft">
                  Opt in to receive news and updates
                </label>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-brown-soft text-white font-semibold py-3 px-10 rounded-full hover:bg-brown-dark transition-colors duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Subscribing...' : 'Subscribe Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ScrollAnimationWrapper>
    </div>
  );
};

const ScrollToTop = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const MainLayout: React.FC = () => {
  const location = useLocation();
  const hideOnPaths = ['/contact', '/login', '/signup', '/questionnaire', '/join-as-therapist', '/therapist-login', '/login-hub'];
  const showNewsletter = !hideOnPaths.includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      {showNewsletter && <NewsletterSignup />}
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/therapists" element={<TherapistsPage />} />
            <Route path="/therapist/:id" element={<TherapistProfilePage />} />
            <Route path="/shura-hub" element={<ShuraHubPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/join-our-network" element={<JoinNetworkPage />} />
          </Route>

          {/* Standalone pages without the main layout */}
          <Route path="/login-hub" element={<LoginHubPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/therapist-login" element={<TherapistLoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/questionnaire" element={<QuestionnairePage />} />
          <Route path="/join-as-therapist" element={<TherapistOnboardingPage />} />
          <Route path="/chat/:therapistId" element={<ClientChatPage />} />
          <Route path="/call" element={<CallPage />} />
          <Route path="/intake/:token" element={<IntakeFormPage />} />
          <Route path="/intake-success" element={<IntakeSuccessPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/therapists/pending" element={<AdminTherapistApprovalsPage />} />

          <Route element={<ProtectedRoute allowedRoles={['client']} redirectTo="/login" />}>
            <Route path="/payment" element={<PaymentPage />} />
          </Route>

          {/* Therapist Portal Routes */}
          <Route element={<ProtectedRoute allowedRoles={['therapist']} redirectTo="/therapist-login" />}>
            <Route element={<TherapistPortalLayout />}>
              <Route path="/therapist-portal/dashboard" element={<TherapistDashboardPage />} />
              <Route path="/therapist-portal/calendar" element={<TherapistCalendarPage />} />
              <Route path="/therapist-portal/profile" element={<TherapistProfileEditorPage />} />
              <Route path="/therapist-portal/payments" element={<TherapistPaymentsPage />} />
              <Route path="/therapist-portal/chat" element={<TherapistChatPage />} />
              <Route path="/therapist-portal/calls" element={<TherapistCallPage />} />
              <Route path="/therapist-portal/intake-forms" element={<TherapistIntakeFormsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
