
export interface FaqItem {
  id: number;
  question: string;
  answer: string;
}

export interface Testimonial {
  id: number;
  quote: string;
  author: string;
  location: string;
}

export interface Therapist {
  id: number;
  name: string;
  title: string;
  experience: number;
  imageUrl: string;
  bioSnippet: string;
  fullBio: string;
  specialties: string[];
  concerns: string[];
  gender: 'Female' | 'Male';
  language: string;
  location: string;
  sessionTypes: ('Video' | 'Audio' | 'Text')[];
  rates: {
    session30?: number;
    session45?: number;
    session60?: number;
    session90?: number;
  };
  packages?: {
    name: string;
    sessions: number;
    price: number;
    description: string;
  }[];
}

export enum ResourceCategory {
  Articles = 'Articles',
  Podcasts = 'Podcasts',
  QuranicVerses = 'Quranic Verses',
}

export interface Resource {
  id: number;
  title: string;
  preview: string;
  fullContent: string;
  category: ResourceCategory;
  topic?: string;
  audioUrl?: string;
}

export type TherapyCategory = 'Individual' | 'Couples' | 'Family' | 'Child';

export interface SubscriptionPlan {
  name: string;
  includes: string;
  savings: string;
  prices: {
    level: string;
    price: string;
  }[];
  description: string;
  bestFor: string;
  features: string[];
}

export interface PayPerSession {
  headers: string[];
  data: {
    level: string;
    // FIX: Changed 'price' to 'prices' and its type to 'string[]' to match the data structure.
    prices: string[];
  }[];
}

export interface PricingContent {
  payPerSession: PayPerSession;
  subscriptionPackages: SubscriptionPlan[];
  notes: string[];
  subscriptionNotes: string[];
}

export interface Client {
  id: number;
  name: string;
  avatarUrl: string;
}

export interface Appointment {
  id: number;
  client: Client;
  dateTime: string;
  sessionType: 'Video' | 'Audio' | 'Text';
  status: 'Upcoming' | 'Completed' | 'Canceled';
}

export interface Payment {
  id: string;
  client: Client;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed';
}

export interface Message {
  id: number;
  text: string;
  senderId: 'therapist' | number; // 'therapist' or client ID
  timestamp: string;
}

export interface Conversation {
  client: Client;
  messages: Message[];
}
