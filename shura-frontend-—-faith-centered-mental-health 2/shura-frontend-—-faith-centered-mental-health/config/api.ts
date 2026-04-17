// API Configuration
// This file centralizes all API endpoints and URLs

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5001';

export const config = {
  apiUrl: API_URL,
  wsUrl: WS_URL,
};

// Helper function to build API endpoints
export const api = {
  // Auth endpoints
  auth: {
    signup: `${API_URL}/api/auth/signup`,
    login: `${API_URL}/api/auth/login`,
    therapist: {
      login: `${API_URL}/api/auth/therapist/login`,
      apply: `${API_URL}/api/auth/therapist/apply`,
    },
  },
  
  // Admin endpoints
  admin: {
    auth: {
      login: `${API_URL}/api/admin/auth/login`,
      profile: `${API_URL}/api/admin/auth/profile`,
      stats: `${API_URL}/api/admin/auth/stats`,
    },
    therapists: {
      pending: `${API_URL}/api/admin/therapists/pending`,
      approve: (id: number) => `${API_URL}/api/admin/therapists/${id}/approve`,
      reject: (id: number) => `${API_URL}/api/admin/therapists/${id}/reject`,
      list: `${API_URL}/api/admin/therapists`,
    },
    intakeForms: `${API_URL}/api/admin/intake-forms`,
    clients: `${API_URL}/api/admin/clients`,
    assignments: {
      list: `${API_URL}/api/admin/assignments`,
      assign: (id: number) => `${API_URL}/api/admin/assign/${id}`,
    },
  },
  
  // Intake form endpoints
  intake: {
    verify: (token: string) => `${API_URL}/api/intake/verify/${token}`,
    submit: `${API_URL}/api/intake/submit`,
  },
  
  // Therapist endpoints
  therapist: {
    intakeForms: `${API_URL}/api/therapist/intake/forms`,
  },
  
  // Newsletter
  newsletter: {
    subscribe: `${API_URL}/api/newsletter/subscribe`,
  },
  
  // Health check
  health: `${API_URL}/api/health`,
};

export default config;
