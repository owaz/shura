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
