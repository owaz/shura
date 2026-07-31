import { apiFetch } from '../../config/api';
import type { ClientOptions, ClientPreferences, ClientProfile, OnboardingData } from './clientPortalTypes';

export class PortalApiError extends Error {
  code: string;
  details: Record<string, string> | null;

  constructor(message: string, code = 'REQUEST_FAILED', details: Record<string, string> | null = null) {
    super(message);
    this.name = 'PortalApiError';
    this.code = code;
    this.details = details;
  }
}

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await apiFetch(path, { ...init, headers });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiError = payload?.error;
    throw new PortalApiError(
      typeof apiError === 'string' ? apiError : apiError?.message || 'Something went wrong. Please try again.',
      apiError?.code,
      apiError?.details
    );
  }
  return payload.data as T;
};

export const clientPortalApi = {
  getProfile: () => request<{ profile: ClientProfile; preferences: ClientPreferences }>('/client/profile'),
  updateProfile: (profile: Partial<ClientProfile>) => request<{ profile: ClientProfile }>('/client/profile', {
    method: 'PATCH',
    body: JSON.stringify(profile),
  }),
  updatePreferences: (preferences: Partial<ClientPreferences>) => request<{ preferences: ClientPreferences }>('/client/preferences', {
    method: 'PATCH',
    body: JSON.stringify(preferences),
  }),
  getOnboarding: () => request<OnboardingData>('/client/onboarding'),
  saveOnboarding: (body: Record<string, unknown>) => request<{ currentStep: number }>('/client/onboarding', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),
  completeOnboarding: () => request<{ completed: boolean; assignedTherapist: { id: number; name: string } | null }>('/client/onboarding/complete', {
    method: 'POST',
  }),
  getSettings: () => request<{ options: ClientOptions; features: Record<string, unknown>; policies: Record<string, unknown> }>('/platform/settings/client'),
  uploadProfilePhoto: (blob: Blob) => {
    const form = new FormData();
    form.append('image', blob, 'profile-photo.jpg');
    return request<{ profilePicture: string }>('/client/profile/photo', { method: 'POST', body: form });
  },
  createPasswordResetTicket: () => request<{ url: string }>('/client/password-reset-ticket', { method: 'POST' }),
  deleteAccount: () => request<void>('/client/account', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation: 'DELETE' }),
  }),
};
