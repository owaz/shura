import type { TherapyCategory, PricingContent } from '../types';

export const pricingData: Record<TherapyCategory, PricingContent> = {
    Individual: {
        payPerSession: {
            headers: ['Therapist Level', '30 min', '60 min (Standard)', '90 min (Extended)'],
            data: [
                { level: 'Beginner (1–3 yrs)', prices: ['₹500', '₹800', '₹1,200'] },
                { level: 'Mid-Level (4–7 yrs)', prices: ['₹800', '₹1,200', '₹1,800'] },
                { level: 'Senior/Expert (8+ yrs)', prices: ['₹1,500', '₹2,000', '₹3,000'] },
            ],
        },
        subscriptionPackages: [
            {
                name: "Silver Package",
                includes: "4 sessions/month",
                savings: "10% off",
                prices: [
                    { level: 'Beginner', price: '₹2,880' },
                    { level: 'Mid-Level', price: '₹4,320' },
                    { level: 'Senior/Expert', price: '₹7,200' },
                ],
                description: "Consistent weekly support to help you navigate challenges and foster personal growth.",
                bestFor: "Individuals seeking steady progress and regular guidance on their healing journey.",
                features: ["4 sessions (60 min each) per month", "Flexible scheduling", "Dedicated therapist matching", "Secure & confidential platform", "Basic chat support"]
            },
            {
                name: "Gold Package",
                includes: "8 sessions/month",
                savings: "15% off",
                 prices: [
                    { level: 'Beginner', price: '₹5,440' },
                    { level: 'Mid-Level', price: '₹8,160' },
                    { level: 'Senior/Expert', price: '₹13,600' },
                ],
                description: "Accelerated support with bi-weekly sessions for more intensive guidance and faster progress.",
                bestFor: "Individuals wanting to work through deeper issues or who prefer more frequent touchpoints.",
                features: ["8 sessions (60 min each) per month", "All Silver features", "Priority scheduling", "Enhanced progress tracking tools", "Priority chat support"]
            }
        ],
        notes: [
            "🎁 Your first 30-minute session is on us!",
            "✅ Book as needed — no commitment.",
            "✅ Pay securely via UPI, Net Banking, or Card.",
        ],
        subscriptionNotes: [
            "✅ Includes progress tracking + chat support.",
            "✅ No hidden charges. Cancel anytime."
        ]
    },
    Couples: {
        payPerSession: {
            headers: ['Therapist Level', '60 min (Standard)', '90 min (Extended)'],
            data: [
                { level: 'Beginner (1–3 yrs)', prices: ['₹1,200', '₹1,800'] },
                { level: 'Mid-Level (4–7 yrs)', prices: ['₹1,800', '₹2,500'] },
                { level: 'Senior/Expert (8+ yrs)', prices: ['₹2,500', '₹3,500'] },
            ],
        },
        subscriptionPackages: [
            {
                name: "Couples Foundation",
                includes: "4 sessions/month",
                savings: "10% off",
                prices: [
                    { level: 'Beginner', price: '₹4,320' },
                    { level: 'Mid-Level', price: '₹6,480' },
                    { level: 'Senior/Expert', price: '₹9,000' },
                ],
                description: "Build a stronger foundation for your relationship with consistent weekly guidance.",
                bestFor: "Couples looking to improve communication, resolve conflicts, and reconnect.",
                features: ["4 sessions (60 min each) per month", "Specialized couples therapists", "Relationship-building exercises", "Flexible scheduling"]
            },
            {
                name: "Couples Intensive",
                includes: "8 sessions/month",
                savings: "15% off",
                prices: [
                    { level: 'Beginner', price: '₹8,160' },
                    { level: 'Mid-Level', price: '₹12,240' },
                    { level: 'Senior/Expert', price: '₹17,000' },
                ],
                description: "Deeper, more intensive work to navigate significant challenges and foster profound growth.",
                bestFor: "Couples needing dedicated support to work through complex issues or in crisis.",
                features: ["8 sessions (60 min each) per month", "All Foundation features", "Priority scheduling", "Direct therapist messaging"]
            }
        ],
        notes: [
            "✅ All sessions are confidential and designed to create a safe space for both partners.",
            "✅ We recommend a 90-min session for the first consultation.",
        ],
        subscriptionNotes: [
            "✅ Plans offer the best value for ongoing work.",
            "✅ Cancel anytime."
        ]
    },
    Family: {
        payPerSession: {
            headers: ['Therapist Level', '90 min (Standard Session)'],
            data: [
                { level: 'Beginner (1–3 yrs)', prices: ['₹2,000'] },
                { level: 'Mid-Level (4–7 yrs)', prices: ['₹2,800'] },
                { level: 'Senior/Expert (8+ yrs)', prices: ['₹4,000'] },
            ],
        },
        subscriptionPackages: [
            {
                name: "Family Harmony",
                includes: "4 sessions/month",
                savings: "10% off",
                prices: [
                    { level: 'Beginner', price: '₹7,200' },
                    { level: 'Mid-Level', price: '₹10,080' },
                    { level: 'Senior/Expert', price: '₹14,400' },
                ],
                description: "Dedicated sessions for family members to improve communication, resolve conflicts, and grow together.",
                bestFor: "Families looking to strengthen their relationships in a guided, faith-sensitive environment.",
                features: ["4 sessions (90 min each) per month", "Therapist specialized in family dynamics", "Joint and individual session flexibility", "Shared resources and exercises", "Coordinated scheduling"]
            }
        ],
        notes: [
            "✅ Sessions are tailored to address the unique dynamics of your family.",
            "✅ One-time consultations are available to assess your family's needs.",
        ],
        subscriptionNotes: [
             "✅ A structured approach to foster understanding and restore balance.",
             "✅ Cancel anytime."
        ]
    },
    Child: {
        payPerSession: {
            headers: ['Therapist Level', '45 min (Play Therapy)'],
            data: [
                { level: 'Beginner (1–3 yrs)', prices: ['₹700'] },
                { level: 'Mid-Level (4–7 yrs)', prices: ['₹1,000'] },
                { level: 'Senior/Expert (8+ yrs)', prices: ['₹1,600'] },
            ],
        },
        subscriptionPackages: [
            {
                name: "Young Minds",
                includes: "4 child sessions/month",
                savings: "10% off",
                prices: [
                    { level: 'Beginner', price: '₹2,520' },
                    { level: 'Mid-Level', price: '₹3,600' },
                    { level: 'Senior/Expert', price: '₹5,760' },
                ],
                description: "Consistent, engaging, and age-appropriate therapy to help your child navigate feelings and challenges.",
                bestFor: "Children (ages 4-12) needing support with emotional regulation, anxiety, or behavioral issues.",
                features: ["4 child-focused sessions (45 min each)", "Play therapy and creative techniques", "Safe and supportive environment", "Regular progress updates for parents"]
            },
            {
                name: "Parent & Child Connect",
                includes: "4 child + 2 parent sessions",
                savings: "15% off",
                prices: [
                    { level: 'Beginner', price: '₹3,740' },
                    { level: 'Mid-Level', price: '₹5,440' },
                    { level: 'Senior/Expert', price: '₹8,840' },
                ],
                description: "A comprehensive package that supports the child and provides parents with guidance and strategies.",
                bestFor: "Families who want a collaborative approach to support their child's well-being.",
                features: ["4 child therapy sessions (45 min)", "2 parent consultation sessions (60 min)", "Coordinated strategies for home and therapy", "Resource toolkit for parents"]
            }
        ],
        notes: [
            "✅ Our child therapists are specially trained in working with young clients.",
            "✅ Parent consultations are a key part of the therapeutic process.",
        ],
        subscriptionNotes: [
            "✅ Packages designed to create lasting positive change.",
            "✅ Flexible scheduling around school hours."
        ]
    },
};