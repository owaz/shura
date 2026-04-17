import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import type { TherapyCategory } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { IndividualIcon, CouplesIcon, FamilyIcon, ChildIcon, CheckIcon } from '../components/Icons';
import ScrollAnimationWrapper from '../components/ScrollAnimationWrapper';
import { Watermark } from '../components/Watermark';

const serviceCardData = [
    {
        category: 'Individual' as TherapyCategory,
        Icon: IndividualIcon,
        title: 'Individual Therapy',
        description: 'One-on-one sessions focused on your personal mental health journey.',
        priceRange: '₹800 - ₹2000 per session',
        features: [
            'Personalized treatment plans',
            'Anxiety & depression management',
            'Stress management techniques',
            'Islamic spiritual guidance',
            'Goal setting & achievement'
        ]
    },
    {
        category: 'Couples' as TherapyCategory,
        Icon: CouplesIcon,
        title: 'Couple Therapy',
        description: 'Strengthen your marriage with faith-based relationship counseling.',
        priceRange: '₹1200 - ₹3500 per session',
        features: [
            'Communication improvement',
            'Conflict resolution',
            'Islamic marriage principles',
            'Building emotional intimacy',
            'Pre-marital counseling'
        ]
    },
    {
        category: 'Family' as TherapyCategory,
        Icon: FamilyIcon,
        title: 'Family Therapy',
        description: 'Resolve family conflicts and build stronger, healthier relationships.',
        priceRange: '₹2000 - ₹4000 per session',
        features: [
            'Improving family dynamics',
            'Parenting support & guidance',
            'Conflict resolution skills',
            'Adolescent & child issues',
            'Strengthening family bonds'
        ]
    },
    {
        category: 'Child' as TherapyCategory,
        Icon: ChildIcon,
        title: 'Child Therapy',
        description: 'Support for children facing behavioral or emotional challenges.',
        priceRange: '₹700 - ₹1600 per session',
        features: [
            'Play therapy techniques',
            'Behavioral issue management',
            'Emotional regulation skills',
            'Support for anxiety & ADHD',
            'Parental guidance & collaboration'
        ]
    }
];

const ServicesPage: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState<TherapyCategory>('Individual');
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    useEffect(() => {
        if (location.state?.defaultCategory) {
            setActiveCategory(location.state.defaultCategory);
        }
    }, [location.state]);

    const handleBookingClick = () => {
        if (isAuthenticated) {
          navigate('/questionnaire');
        } else {
          navigate('/login');
        }
    };

    return (
        <>
            <Watermark />
            <section
                className="relative z-10 min-h-[300px] flex items-center justify-center p-6 text-center bg-cover bg-center"
                style={{
                    backgroundImage: `url('https://res.cloudinary.com/dyqspp2ud/image/upload/v1762938141/neutral_toned_hand_painted_watercolour_background_2404_pgyc6e.jpg')`,
                }}
            >
                <div className="container mx-auto px-6 max-w-3xl">
                <h1 className="text-4xl md:text-6xl font-serif font-bold text-brown-dark mb-4" style={{textShadow: '1px 1px 3px rgba(253, 251, 245, 0.7)'}}>Our Services</h1>
                <p className="text-lg text-brown-dark max-w-3xl mx-auto" style={{textShadow: '1px 1px 3px rgba(253, 251, 245, 0.7)'}}>Comprehensive mental health services tailored to your needs, rooted in Islamic values</p>
                </div>
            </section>
            <div className="relative z-10 py-16 bg-cream">
                <div className="container mx-auto px-6">
                    {/* Free Session Banner */}
                    <ScrollAnimationWrapper>
                        <section className="mb-16 max-w-4xl mx-auto">
                            <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-sand">
                                <h2 className="text-3xl font-serif font-bold text-brown-soft mb-3">First Session FREE</h2>
                                <p className="text-brown-soft max-w-xl mx-auto">
                                    Experience our services risk-free. Your first session with any therapist is completely free!
                                </p>
                            </div>
                        </section>
                    </ScrollAnimationWrapper>

                    {/* Therapy Type Selector */}
                    <ScrollAnimationWrapper delay={100}>
                        <section className="mb-12">
                            <h2 className="text-2xl font-serif text-center text-brown-dark mb-6">Select a Service to See Details</h2>
                            <div className="flex flex-wrap justify-center gap-3 md:gap-4 bg-white p-3 rounded-full max-w-3xl mx-auto shadow-md">
                                {serviceCardData.map(card => (
                                    <button
                                        key={card.category}
                                        onClick={() => setActiveCategory(card.category)}
                                        className={`px-4 py-2 md:px-6 md:py-3 text-sm md:text-base font-semibold rounded-full transition-colors duration-300 ${
                                            activeCategory === card.category
                                                ? 'bg-brown-soft text-white shadow'
                                                : 'bg-transparent text-brown-soft hover:bg-sand'
                                        }`}
                                    >
                                        {card.title}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </ScrollAnimationWrapper>
                    
                    
                    {/* Animated container for active content */}
                    <div key={activeCategory}>
                        <ScrollAnimationWrapper>
                            {/* Active Service Card */}
                            <section className="mb-12">
                                <div className="max-w-3xl mx-auto">
                                    {(() => {
                                        const card = serviceCardData.find(c => c.category === activeCategory);
                                        if (!card) return null;
                                        return (
                                            <div className="bg-white p-8 rounded-2xl shadow-lg text-left">
                                                <div className="flex flex-col h-full">
                                                    <div className="flex items-start gap-6">
                                                        <div className="bg-sand p-4 rounded-full flex-shrink-0">
                                                            <card.Icon className="h-8 w-8 text-brown-dark" />
                                                        </div>
                                                        <div>
                                                            <h2 className="text-2xl font-serif font-bold text-brown-dark">{card.title}</h2>
                                                            <p className="text-brown-soft mt-1">{card.description}</p>
                                                        </div>
                                                    </div>
                                                    <div className="my-6">
                                                        <div className="inline-block bg-sand text-brown-dark font-semibold px-4 py-2 rounded-full">
                                                            {card.priceRange}
                                                        </div>
                                                    </div>
                                                    <ul className="space-y-3 flex-grow">
                                                        {card.features.map(feature => (
                                                            <li key={feature} className="flex items-center">
                                                                <CheckIcon className="h-4 w-4 text-brown-soft mr-3" />
                                                                <span className="text-brown-soft">{feature}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <div className="mt-8 text-center">
                                                        <button 
                                                            onClick={handleBookingClick} 
                                                            className="bg-brown-soft text-white px-8 py-3 rounded-full hover:bg-brown-dark transition-transform duration-300 font-semibold text-lg transform hover:scale-105 inline-block"
                                                        >
                                                            Find Your Therapist
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </section>
                        </ScrollAnimationWrapper>
                    </div>

                    {/* Contact CTA */}
                    <ScrollAnimationWrapper delay={200}>
                        <div className="text-center mt-20 bg-sand p-8 rounded-xl max-w-4xl mx-auto">
                            <h3 className="text-2xl font-serif font-semibold text-brown-dark mb-2">Have Questions?</h3>
                            <p className="text-brown-soft mb-4">Our support team is here to help you understand the best plan for your situation.</p>
                            <Link to="/contact" className="text-brown-soft font-semibold hover:underline">Contact Us</Link>
                        </div>
                    </ScrollAnimationWrapper>
                </div>
            </div>
        </>
    );
};

export default ServicesPage;