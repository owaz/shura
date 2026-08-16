import { apiFetch } from '../../config/api';
import type { AssignedTherapist, BookingAvailability, BookingCreationResult, BookingIntentStatus, BookingOptions, ClientOptions, ClientPreferences, ClientProfile, ClientSession, ConfirmedBooking, OnboardingData, Pagination, SessionAvailability } from './clientPortalTypes';

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

const requestPaginated = async <T>(path: string): Promise<{ data: T[]; pagination: Pagination }> => {
  const response = await apiFetch(path);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiError = payload?.error;
    throw new PortalApiError(
      typeof apiError === 'string' ? apiError : apiError?.message || 'Something went wrong. Please try again.',
      apiError?.code,
      apiError?.details
    );
  }
  return { data: payload.data || [], pagination: payload.pagination };
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
  getAssignedTherapist: () => request<{ therapist: AssignedTherapist | null }>('/client/therapist'),
  releaseTherapist: () => request<{ released: boolean; therapistId: number | null; notificationSent?: boolean }>('/client/therapist/release', {
    method: 'POST',
  }),
  getSessions: (status: 'upcoming' | 'past' | 'cancelled', page = 1, limit = 20) =>
    requestPaginated<ClientSession>(`/client/sessions?status=${status}&page=${page}&limit=${limit}`),
  getSession: (id: number) => request<{ session: ClientSession }>(`/client/sessions/${id}`),
  getSessionAvailability: (id: number, from: string, to: string) =>
    request<SessionAvailability>(`/client/sessions/${id}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  rescheduleSession: (id: number, scheduledAt: string) => request<{ session: ClientSession }>(`/client/sessions/${id}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify({ scheduledAt }),
  }),
  cancelSession: (id: number, reason: string) => request<{ session: ClientSession; refundStatus: string | null }>(`/client/sessions/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
  reviewSession: (id: number, rating: number, comment: string) => request<{ review: { id: number; rating: number; comment: string | null } }>(`/client/sessions/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  }),
  joinSession: (id: number) => request<{ mode: string; url?: string; joinUrl?: string }>(`/client/sessions/${id}/join`, {
    method: 'POST',
  }),
  getBookingOptions: (therapistId: number) => request<BookingOptions>(`/client/booking-options/${therapistId}`),
  getBookingAvailability: (therapistId: number, from: string, to: string, sessionType: string, durationMinutes: number) =>
    request<BookingAvailability>(`/client/availability/${therapistId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&sessionType=${encodeURIComponent(sessionType)}&durationMinutes=${durationMinutes}`),
  createBooking: (body: { therapistId: number; sessionType: string; durationMinutes: number; scheduledAt: string }) =>
    request<BookingCreationResult>('/client/bookings', { method: 'POST', body: JSON.stringify(body) }),
  verifyBookingPayment: (body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    request<{ status: 'completed'; booking: ConfirmedBooking; replayed: boolean }>('/client/bookings/verify-payment', { method: 'POST', body: JSON.stringify(body) }),
  recoverBookingIntent: (orderId: string) => request<{ intent: BookingIntentStatus }>(`/client/bookings/intents/${encodeURIComponent(orderId)}`),
  downloadBookingCalendar: async (bookingId: number) => {
    const response = await apiFetch(`/client/bookings/${bookingId}/calendar.ics`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new PortalApiError(payload?.error?.message || 'The calendar file could not be downloaded.', payload?.error?.code);
    }
    return response.blob();
  },
};
