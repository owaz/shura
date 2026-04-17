import type { Therapist } from '../types';

export const mockTherapists: Therapist[] = [
  { 
    id: 2, 
    name: "Yusuf Khan", 
    title: "Licensed Counselor, M.A.", 
    experience: 5,
    imageUrl: "https://picsum.photos/id/1005/400/400", 
    bioSnippet: "Focuses on youth counseling, identity, and navigating life transitions from an Islamic perspective.", 
    fullBio: "Yusuf Khan is a licensed counselor with a Master's degree in Counseling Psychology. He is passionate about working with young adults, helping them navigate the complexities of identity, career, and faith in the modern world. Yusuf uses a person-centered approach, empowering clients to find their own strengths and build resilience. His sessions often incorporate storytelling and reflective exercises to foster personal growth.",
    specialties: ["Person-Centered Therapy", "Motivational Interviewing"], 
    concerns: ["Personal Growth", "Lifestyle Changes", "Child issues"],
    gender: 'Male', 
    language: 'Urdu',
    location: 'Delhi',
    sessionTypes: ['Video', 'Text'],
    rates: {
        session60: 1200,
        session90: 1800,
    },
     packages: [
        { name: "Monthly Growth", sessions: 4, price: 4320, description: "Four 60-min sessions for steady personal development." }
    ]
  },
];