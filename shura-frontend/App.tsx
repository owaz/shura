
import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Outlet } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import { AuthProvider } from './contexts/AuthContext';
import ScrollAnimationWrapper from './components/ScrollAnimationWrapper';
import ProtectedRoute from './components/ProtectedRoute';
import { apiFetch } from './config/api';
import TherapistPortalLayout from './pages/therapist-portal/TherapistPortalLayout';
import ClientPortalGuard from './pages/client-portal/ClientPortalGuard';
import ClientPortalLayout from './pages/client-portal/ClientPortalLayout';

const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const TherapistsPage = lazy(() => import('./pages/TherapistsPage'));
const TherapistProfilePage = lazy(() => import('./pages/TherapistProfilePage'));
const ShuraHubPage = lazy(() => import('./pages/HealingHubPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const QuestionnairePage = lazy(() => import('./pages/QuestionnairePage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const LoginHubPage = lazy(() => import('./pages/LoginHubPage'));
const TherapistLoginPage = lazy(() => import('./pages/TherapistLoginPage'));
const TherapistOnboardingPage = lazy(() => import('./pages/TherapistOnboardingPage'));
const JoinNetworkPage = lazy(() => import('./pages/JoinNetworkPage'));
const TherapistApplyPage = lazy(() => import('./pages/TherapistApplyPage'));
const TherapistApplyPendingPage = lazy(() => import('./pages/TherapistApplyPendingPage'));
const TherapistApplyStatusPage = lazy(() => import('./pages/TherapistApplyStatusPage'));
const TherapistDashboardPage = lazy(() => import('./pages/therapist-portal/TherapistDashboardPage'));
const TherapistProfileEditorPage = lazy(() => import('./pages/therapist-portal/TherapistProfileEditorPage'));
const TherapistCalendarPage = lazy(() => import('./pages/therapist-portal/TherapistCalendarPage'));
const TherapistPaymentsPage = lazy(() => import('./pages/therapist-portal/TherapistPaymentsPage'));
const TherapistCallPage = lazy(() => import('./pages/therapist-portal/TherapistCallPage'));
const ClientChatPage = lazy(() => import('./pages/ClientChatPage'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const CallPage = lazy(() => import('./pages/CallPage'));
const TherapistChatPage = lazy(() => import('./pages/therapist-portal/TherapistChatPage'));
const TherapistIntakeFormsPage = lazy(() => import('./pages/therapist-portal/TherapistIntakeFormsPage'));
const IntakeFormPage = lazy(() => import('./pages/IntakeFormPage'));
const IntakeSuccessPage = lazy(() => import('./pages/IntakeSuccessPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const AdminTherapistApprovalsPage = lazy(() => import('./pages/AdminTherapistApprovalsPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const PortalPlaceholderPage = lazy(() => import('./pages/client-portal/PortalPlaceholderPage'));
const ClientOnboardingPage = lazy(() => import('./pages/client-portal/ClientOnboardingPage'));
const ClientProfilePage = lazy(() => import('./pages/client-portal/ClientProfilePage'));
const ClientPreferencesPage = lazy(() => import('./pages/client-portal/ClientPreferencesPage'));
const ClientSessionsPage = lazy(() => import('./pages/client-portal/ClientSessionsPage'));
const ClientTherapistPage = lazy(() => import('./pages/client-portal/ClientTherapistPage'));
const ClientBookingPage = lazy(() => import('./pages/client-portal/ClientBookingPage'));
const ClientHomePage = lazy(() => import('./pages/client-portal/ClientHomePage'));

const RouteLoadingFallback: React.FC<{ contained?: boolean }> = ({ contained = false }) => (
  <div className={`flex items-center justify-center bg-[#FAF7F2] px-6 ${contained ? 'min-h-[50vh]' : 'min-h-screen'}`} role="status" aria-live="polite">
    <div className="w-full max-w-md rounded-2xl border border-sand bg-white p-7 shadow-[0_8px_30px_rgba(92,80,67,0.06)]">
      <span className="sr-only">Loading this page</span>
      <div className="h-5 w-32 animate-pulse rounded-full bg-sand" aria-hidden="true" />
      <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-[#F3E9DC]" aria-hidden="true" />
      <div className="mt-3 h-3 w-3/4 animate-pulse rounded-full bg-[#F3E9DC]" aria-hidden="true" />
    </div>
  </div>
);

class RouteErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-6" role="alert">
          <div className="w-full max-w-md rounded-2xl border border-sand bg-white p-7 text-center shadow-[0_8px_30px_rgba(92,80,67,0.06)]">
            <h1 className="text-2xl font-serif font-bold text-brown-dark">This page could not be loaded</h1>
            <p className="mt-3 text-brown-soft">Reload the page to try again.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-full bg-brown-soft px-6 py-3 font-semibold text-white transition-colors hover:bg-brown-dark">
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
        <Suspense fallback={<RouteLoadingFallback contained />}><Outlet /></Suspense>
      </main>
      {showNewsletter && <NewsletterSignup />}
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <RouteErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
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
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/therapist-apply" element={<TherapistApplyPage />} />
          <Route path="/therapist-apply/pending" element={<TherapistApplyPendingPage />} />
          <Route path="/therapist-apply/status" element={<TherapistApplyStatusPage />} />
          <Route element={<ProtectedRoute allowedRoles={['therapist']} redirectTo="/therapist-apply" />}>
            <Route path="/therapist-apply/complete" element={<TherapistOnboardingPage />} />
          </Route>
          <Route path="/questionnaire" element={<QuestionnairePage />} />
          <Route path="/join-as-therapist" element={<TherapistApplyPage />} />
          <Route path="/chat/:therapistId" element={<ClientChatPage />} />
          <Route path="/call" element={<CallPage />} />
          <Route path="/intake/:token" element={<IntakeFormPage />} />
          <Route path="/intake-success" element={<IntakeSuccessPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route element={<ProtectedRoute allowedRoles={['admin']} redirectTo="/admin/login" />}>
            <Route path="/admin/therapists/pending" element={<AdminTherapistApprovalsPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['client']} redirectTo="/login" />}>
            <Route path="/payment" element={<PaymentPage />} />
          </Route>

          {/* Client portal routes. Page-specific functionality is delivered in subsequent milestones. */}
          <Route element={<ClientPortalGuard />}>
            <Route path="/portal/onboarding" element={<ClientOnboardingPage />} />
            <Route element={<ClientPortalLayout />}>
              <Route path="/portal/home" element={<ClientHomePage />} />
              <Route path="/portal/sessions" element={<ClientSessionsPage />} />
              <Route path="/portal/therapist" element={<ClientTherapistPage />} />
              <Route path="/portal/book" element={<ClientBookingPage />} />
              <Route path="/portal/profile" element={<ClientProfilePage />} />
              <Route path="/portal/preferences" element={<ClientPreferencesPage />} />
              <Route path="/portal/billing" element={<PortalPlaceholderPage eyebrow="Your payments" title="Billing" description="Your payment methods, receipts, and transaction history will appear here." />} />
            </Route>
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
          </Suspense>
        </RouteErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
