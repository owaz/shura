export interface ClientProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  country: string;
  city: string;
  timezone: string;
  aboutMe: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  profilePicture: string;
  onboardingCompleted: boolean;
  memberSince?: string;
}

export interface ClientPreferences {
  therapistGenderPreference: 'female_only' | 'male_only' | 'no_preference';
  languages: string[];
  islamicApproach: 'faith_integrated' | 'faith_aware' | 'no_preference';
  specialisationInterests: string[];
  sessionTypePreference: 'video' | 'audio' | 'text' | 'no_preference';
  sessionDurationPreference: '30' | '50' | '80' | 'no_preference';
  preferredDays: string[];
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'no_preference';
  notificationEmailReminder24h: boolean;
  notificationEmailReminder1h: boolean;
  notificationSmsReminder1h: boolean;
  notificationBookingConfirmation: boolean;
  notificationCancellation: boolean;
  notificationPlatformUpdates: boolean;
  privacyShareAboutMe: boolean;
  privacyAllowAnonymisedData: boolean;
}

export interface ClientOptions {
  languages: string[];
  specialisations: string[];
  phoneCountryCodes: Array<{ code: string; label: string }>;
}

export interface OnboardingData {
  currentStep: number;
  completed: boolean;
  profile: ClientProfile;
  preferences: ClientPreferences;
  goals: string[];
  notes: string;
  assignedTherapist: { id: number; name: string } | null;
}

export interface TherapistAvailabilityBand {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface AssignedTherapist {
  id: number;
  name: string;
  professionalTitle: string;
  credentials: string[];
  verified: boolean;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  bio: string;
  specialisations: string[];
  approach: string;
  faithIntegration: string;
  languages: string[];
  sessionTypes: Array<'video' | 'audio' | 'text'>;
  durationOptions: number[];
  availability: TherapistAvailabilityBand[];
  assignedAt: string | null;
}

export type ClientSessionStatus =
  | 'pending'
  | 'confirmed'
  | 'upcoming'
  | 'live'
  | 'completed'
  | 'cancelled'
  | 'no_show_client'
  | 'no_show_therapist';

export interface ClientSessionActions {
  canJoin: boolean;
  joinAvailableAt: string;
  canReschedule: boolean;
  canCancel: boolean;
  refundEligible: boolean;
  rescheduleCutoffHours: number;
  cancellationCutoffHours: number;
  cancellationPolicyText: string;
}

export interface ClientSessionReceipt {
  id: number;
  amountCents: number;
  currency: string;
  status: string;
  paymentReference: string | null;
  refundAmountCents: number;
  refundReference: string | null;
}

export interface ClientSession {
  id: number;
  therapist: {
    id: number;
    name: string;
    credentials: string[];
    imageUrl: string;
  };
  scheduledAt: string;
  clientTimezone: string;
  durationMinutes: number;
  sessionType: 'video' | 'audio' | 'text';
  status: ClientSessionStatus;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancelledBy: 'client' | 'therapist' | 'admin' | null;
  rescheduledAt: string | null;
  rescheduledFrom: string | null;
  reviewed: boolean;
  reviewRating: number | null;
  reviewEligible: boolean;
  receipt: ClientSessionReceipt | null;
  actions: ClientSessionActions;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SessionAvailability {
  timezone: string;
  slots: Array<{ scheduledAt: string }>;
}

export interface BookingOptions {
  therapist: { id: number; name: string; imageUrl: string };
  sessionTypes: Array<'video' | 'audio' | 'text'>;
  durations: Array<{
    minutes: 30 | 50 | 80;
    kind: 'paid' | 'free' | 'covered';
    amountMinor: number;
    currency: string;
    paymentRequired: boolean;
  }>;
  defaults: {
    sessionType: 'video' | 'audio' | 'text' | null;
    durationMinutes: 30 | 50 | 80 | null;
  };
  clientTimezone: string;
  therapistTimezone: string;
  timezoneDiffers: boolean;
  paymentEnabled: boolean;
  sessionsCovered: boolean;
}

export interface BookingAvailability {
  clientTimezone: string;
  therapistTimezone: string;
  timezoneDiffers: boolean;
  slots: Array<{ scheduledAt: string; therapistTimezone: string }>;
}

export interface ConfirmedBooking {
  id: number;
  therapist: { id: number; name: string };
  scheduledAt: string;
  durationMinutes: number;
  sessionType: 'video' | 'audio' | 'text';
  status: string;
  payment: {
    kind: 'paid' | 'free' | 'covered';
    amountMinor: number;
    currency: string;
  };
  clientTimezone: string;
  calendarDownloadUrl: string;
}

export type BookingCreationResult =
  | { kind: 'confirmed'; booking: ConfirmedBooking }
  | {
      kind: 'payment_required';
      intent: { orderId: string; status: string };
      checkout: { keyId: string; orderId: string; amountMinor: number; currency: string };
    };

export interface BookingIntentStatus {
  orderId: string;
  status: string;
  amountMinor: number;
  currency: string;
  requiresRefund: boolean;
  refundStatus: string | null;
  failureCode: string | null;
  booking: ConfirmedBooking | null;
  updatedAt: string;
}

export interface ClientDashboardSummary {
  greetingName: string;
  timezone: string;
  memberSince: string;
  nextSession: ClientSession | null;
  therapist: {
    id: number;
    name: string;
    credentials: string[];
    specialisations: string[];
    imageUrl: string;
  } | null;
  stats: {
    completed: number;
    upcoming: number;
  };
  features: {
    messagingEnabled: boolean;
  };
}

export interface QuoteOfTheDay {
  date: string;
  dateBoundary: 'UTC';
  quote: {
    id: number;
    arabicText: string;
    englishTranslation: string;
    source: string;
    arabicAttribution: string | null;
    translationAttribution: string | null;
  } | null;
  editorialReviewRequired: boolean;
}

export interface ClientNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  action: { label: string; href: string } | null;
}
