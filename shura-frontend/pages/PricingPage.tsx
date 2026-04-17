import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Fix: Import all necessary types from the central types file
import type { SubscriptionPlan, TherapyCategory, PricingContent } from '../types';
import PlanDetailModal from '../components/PlanDetailModal';
import { useAuth } from '../contexts/AuthContext';

// Pricing data organized by therapy type
const pricingData: Record<TherapyCategory, PricingContent> = {
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

const therapyCategories: TherapyCategory[] = ['Individual', 'Couples', 'Family', 'Child'];

const PricingPage: React.FC = () => {
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
    const [activeCategory, setActiveCategory] = useState<TherapyCategory>('Individual');
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    
    const activePricing = pricingData[activeCategory];

    const handleBookingClick = () => {
        if (isAuthenticated) {
          navigate('/questionnaire');
        } else {
          navigate('/login');
        }
    };

    return (
        <>
            <section
                className="min-h-[300px] flex items-center justify-center p-6 text-center bg-cover bg-center"
                style={{
                    backgroundImage: `url('https://res.cloudinary.com/dyqspp2ud/image/upload/v1762938141/neutral_toned_hand_painted_watercolour_background_2404_pgyc6e.jpg')`,
                }}
            >
                <div className="container mx-auto px-6 max-w-3xl">
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-brown-dark mb-4" style={{textShadow: '1px 1px 3px rgba(253, 251, 245, 0.7)'}}>Transparent & Flexible Pricing</h1>
                <p className="text-lg text-brown-dark max-w-3xl mx-auto" style={{textShadow: '1px 1px 3px rgba(253, 251, 245, 0.7)'}}>Choose a plan that fits your needs. We have options for every journey.</p>
                </div>
            </section>

            <div className="py-16 bg-ivory">
                <div className="container mx-auto px-6">

                    {/* Free Session Banner (only for individual) */}
                    {activeCategory === 'Individual' && (
                        <section className="mb-16 bg-sand rounded-xl p-8 text-center max-w-4xl mx-auto">
                            <h2 className="text-3xl font-serif font-bold text-brown-soft mb-3">✨ Your First Session is FREE! ✨</h2>
                            <p className="text-brown-soft mb-6">
                                We believe in finding the right fit. Embark on your healing journey with a complimentary 30-minute introductory session to connect with your therapist, risk-free.
                            </p>
                            <button 
                                onClick={handleBookingClick} 
                                className="bg-brown-soft text-white px-8 py-3 rounded-full hover:bg-opacity-90 transition-transform duration-300 font-semibold text-lg transform hover:scale-105 inline-block"
                            >
                                Claim Your Free Session
                            </button>
                        </section>
                    )}
                    
                    {/* Therapy Type Selector */}
                    <section className="mb-12">
                        <h2 className="text-3xl font-serif text-center text-brown-dark mb-6">Choose Your Therapy Type</h2>
                        <div className="flex flex-wrap justify-center gap-3 md:gap-4 bg-white p-3 rounded-full max-w-2xl mx-auto shadow-md">
                            {therapyCategories.map(category => (
                                <button
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    className={`px-4 py-2 md:px-6 md:py-3 text-sm md:text-base font-semibold rounded-full transition-colors duration-300 ${
                                        activeCategory === category
                                            ? 'bg-brown-soft text-white shadow'
                                            : 'bg-transparent text-brown-soft hover:bg-sand'
                                    }`}
                                >
                                    {category} Therapy
                                </button>
                            ))}
                        </div>
                    </section>


                    {/* Pay Per Session */}
                    <section className="mb-20">
                        <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark mb-8 text-center">💬 Pay Per Session <span className="text-brown-soft">(Flexible & Simple)</span></h2>
                        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-sand text-brown-dark">
                                        <tr>
                                            {activePricing.payPerSession.headers.map(header => (
                                                <th key={header} className="p-4 font-semibold text-center first:text-left">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activePricing.payPerSession.data.map((row) => (
                                            <tr key={row.level} className="border-t border-sand">
                                                <td className="p-4 font-semibold text-brown-dark">{row.level}</td>
                                                {row.prices.map((price, idx) => (
                                                    <td key={idx} className="p-4 text-center text-brown-soft">{price}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="text-center mt-6 text-brown-soft">
                            {activePricing.notes.map((note, idx) => (
                            <p key={idx} className="mb-2">{note}</p>
                            ))}
                        </div>
                        <div className="mt-8 text-center">
                            <button 
                                onClick={handleBookingClick} 
                                className="bg-brown-soft text-white px-8 py-3 rounded-full hover:bg-opacity-90 transition-transform duration-300 font-semibold text-lg transform hover:scale-105 inline-block"
                            >
                                Book a Session
                            </button>
                        </div>
                    </section>

                    {/* Subscription Packages */}
                    <section>
                        <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark mb-8 text-center">🌸 Monthly Subscription Packages <span className="text-brown-soft">(Best Value)</span></h2>
                        <div className={`grid grid-cols-1 md:grid-cols-2 ${activePricing.subscriptionPackages.length === 1 ? 'max-w-md' : 'md:max-w-4xl'} mx-auto gap-8`}>
                            {activePricing.subscriptionPackages.map((plan) => (
                                <div key={plan.name} className="bg-white rounded-xl shadow-lg p-8 flex flex-col text-center transform hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                                    <h3 className="text-2xl font-serif font-bold text-brown-soft mb-2">{plan.name}</h3>
                                    <p className="text-brown-soft mb-4">{plan.includes}</p>
                                    <div className="bg-green-100 text-green-800 text-sm font-bold inline-block px-3 py-1 rounded-full self-center mb-6">{plan.savings}</div>
                                    
                                    <div className="flex-grow text-left my-6">
                                        <p className="font-semibold text-brown-dark text-center mb-4">Monthly Price / month</p>
                                        <div className="space-y-3 text-sm">
                                            {plan.prices.map(({ level, price }) => (
                                                <div key={level} className="flex justify-between items-baseline">
                                                    <span className="text-brown-soft">{level}:</span>
                                                    <span className="font-bold text-brown-dark text-lg">{price}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => setSelectedPlan(plan)}
                                        className="mt-auto w-full bg-brown-soft text-white px-6 py-3 rounded-lg hover:bg-brown-dark transition-colors duration-300 font-semibold">
                                    View Details
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="text-center mt-8 text-brown-soft">
                            {activePricing.subscriptionNotes.map((note, idx) => (
                            <p key={idx} className="mb-2">{note}</p>
                            ))}
                        </div>
                    </section>

                    {/* Contact CTA */}
                    <div className="text-center mt-20 bg-sand p-8 rounded-xl max-w-4xl mx-auto">
                        <h3 className="text-2xl font-serif font-semibold text-brown-dark mb-2">Have Questions?</h3>
                        <p className="text-brown-soft mb-4">Our support team is here to help you understand the best plan for your situation.</p>
                        <Link to="/contact" className="text-brown-soft font-semibold hover:underline">Contact Us</Link>
                    </div>
                </div>
                {selectedPlan && (
                    <PlanDetailModal 
                    plan={selectedPlan} 
                    onClose={() => setSelectedPlan(null)} 
                    />
                )}
            </div>
        </>
    );
};

export default PricingPage;