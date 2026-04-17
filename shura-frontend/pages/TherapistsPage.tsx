

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import type { Therapist } from '../types';
import { mockTherapists } from '../data/therapists';
import TherapistCard from '../components/TherapistCard';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/Icons';
import ScrollAnimationWrapper from '../components/ScrollAnimationWrapper';


// Interface for therapists with a matching score
interface ScoredTherapist extends Therapist {
    score: number;
}

// Define Therapy Topics and their filtering logic
type TherapyTopic = 'Individual' | 'Couples' | 'Family' | 'Child';

const therapyTopics: {
    name: TherapyTopic;
    title: string;
    description: string;
    filterFn: (therapist: Therapist) => boolean;
}[] = [
    {
        name: 'Individual',
        title: 'Our Specialists in Individual Therapy',
        description: 'Human soul is fragile and it should be treated gently. Our therapists do it professionally.',
        filterFn: (therapist) => {
            const individualKeywords = ['Anxiety', 'Depression', 'Personal Growth', 'Grief', 'Trauma', 'Self-Esteem', 'Spirituality', 'Lifestyle Changes', 'ADHD', 'Anger Management', 'Bipolar Disorder', 'Eating Disorders', 'Pregnancy/Prenatal/Postpartum', 'Cognitive Behavioural Therapy (CBT)', 'Person-Centered Therapy', 'Faith-Centered Approach'];
            return therapist.concerns.some(c => individualKeywords.includes(c)) || therapist.specialties.some(s => individualKeywords.includes(s));
        }
    },
    {
        name: 'Couples',
        title: 'Our Specialists in Couples Therapy',
        description: 'Strengthen your bond, improve communication, and navigate relationship challenges together.',
        filterFn: (therapist) => {
            const couplesKeywords = ['Marital', 'Couples Therapy', 'Gottman Method', 'Imago', 'Infidelity'];
            return therapist.concerns.some(c => couplesKeywords.includes(c)) || therapist.specialties.some(s => couplesKeywords.includes(s));
        }
    },
    {
        name: 'Family',
        title: 'Our Specialists in Family Therapy',
        description: 'Heal relationships and improve dynamics within the family with guided, compassionate support.',
        filterFn: (therapist) => {
            const familyKeywords = ['Family Conflict', 'Family Therapy', 'Family Systems Therapy', 'Structural Family Therapy'];
            return therapist.concerns.some(c => familyKeywords.includes(c)) || therapist.specialties.some(s => familyKeywords.includes(s));
        }
    },
    {
        name: 'Child',
        title: 'Our Specialists in Child & Teen Therapy',
        description: 'A safe and supportive space for young minds to express themselves and build resilience.',
        filterFn: (therapist) => {
            const childKeywords = ['Child issues', 'Parenting', 'Play Therapy', 'Parent-Child Interaction Therapy (PCIT)', 'Autism', 'Behavioral Issues'];
            return therapist.concerns.some(c => childKeywords.includes(c)) || therapist.specialties.some(s => childKeywords.includes(s));
        }
    }
];

// Carousel component with integrated flip-card functionality
const TherapistCarousel: React.FC<{ therapists: Therapist[]; title: string; description: string }> = ({ therapists, title, description }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handlePrev = () => {
        setCurrentIndex(prev => Math.max(0, prev - 1));
    };

    const handleNext = () => {
        setCurrentIndex(prev => Math.min(therapists.length - 1, prev + 1));
    };

    if (therapists.length === 0) {
        return null;
    }

    // A therapist "slot" is 192px (card) wide + 32px for gap
    const itemSlotWidth = 192 + 32;

    return (
        <section className="py-16 relative">
            <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-gold/30 rounded-full animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-4 h-4 bg-gold/30 rounded-full animate-pulse delay-500"></div>
            
            <div className="container mx-auto px-6">
                <div className="text-center mb-12 max-w-3xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark">{title}</h2>
                    <p className="text-lg text-brown-soft mt-2">{description}</p>
                </div>

                <div className="relative">
                    {/* Carousel Viewport */}
                    <div className="h-56 overflow-hidden relative">
                        {/* Movable Track */}
                        <div
                            className="flex items-center h-full absolute"
                            style={{
                                left: '50%',
                                transform: `translateX(-${(currentIndex * itemSlotWidth) + (itemSlotWidth / 2)}px)`,
                                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        >
                            {therapists.map((therapist, index) => {
                                const isActive = index === currentIndex;
                                return (
                                    <div
                                        key={therapist.id}
                                        className="flex-shrink-0 flex items-center justify-center"
                                        style={{ width: `${itemSlotWidth}px` }}
                                    >
                                        <div
                                            className={`flip-card w-[192px] h-[192px]`}
                                            style={{
                                                transform: isActive ? 'scale(1)' : 'scale(0.8)',
                                                opacity: 1,
                                                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                            }}
                                        >
                                            <div className="flip-card-inner">
                                                {/* Front Card */}
                                                <div className="flip-card-front bg-ivory shadow-lg overflow-hidden flex flex-col justify-end">
                                                    <img src={therapist.imageUrl} alt={therapist.name} className="absolute inset-0 w-full h-full object-cover"/>
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
                                                    <div className="relative p-3 text-white text-left">
                                                        <h3 className="font-serif font-semibold text-base leading-tight drop-shadow-sm">{therapist.name}</h3>
                                                        <p className="text-xs opacity-90 drop-shadow-sm">{therapist.title}</p>
                                                    </div>
                                                </div>
                                                {/* Back Card */}
                                                <div className="flip-card-back bg-sand shadow-lg p-3 flex flex-col items-center justify-center text-brown-dark text-center">
                                                    <h4 className="font-serif font-semibold text-sm mb-2">Specialization</h4>
                                                    <div className="flex flex-wrap justify-center gap-1 mb-3">
                                                        {therapist.concerns.slice(0, 3).map(concern => (
                                                            <span key={concern} className="bg-ivory text-brown-soft text-[10px] font-medium px-2 py-0.5 rounded-full">{concern}</span>
                                                        ))}
                                                    </div>
                                                    <p className="flex items-center text-xs text-taupe mb-4">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                                                        {therapist.location}
                                                    </p>
                                                    <Link 
                                                        to={`/therapist/${therapist.id}`} 
                                                        className="mt-auto block w-full text-center bg-brown-soft text-white px-3 py-2 rounded-lg hover:bg-brown-dark transition-colors duration-300 text-xs font-semibold"
                                                        aria-label={`View profile of ${therapist.name}`}
                                                    >
                                                        View Profile
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Navigation Buttons */}
                    <button 
                        onClick={handlePrev} 
                        disabled={currentIndex === 0} 
                        className="absolute top-1/2 left-0 md:-left-4 transform -translate-y-1/2 p-2 rounded-full hover:bg-sand disabled:opacity-20 transition-colors z-10"
                        aria-label="Previous therapist"
                    >
                        <ChevronLeftIcon className="h-10 w-10 text-taupe" />
                    </button>
                    <button 
                        onClick={handleNext} 
                        disabled={currentIndex === therapists.length - 1} 
                        className="absolute top-1/2 right-0 md:-right-4 transform -translate-y-1/2 p-2 rounded-full hover:bg-sand disabled:opacity-20 transition-colors z-10"
                        aria-label="Next therapist"
                    >
                        <ChevronRightIcon className="h-10 w-10 text-taupe" />
                    </button>
                </div>
            </div>
        </section>
    );
};


// Main TherapistsPage Component
const TherapistsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isMatching = location.state && location.state.concerns;
  const [scoredTherapists, setScoredTherapists] = useState<ScoredTherapist[]>([]);

  useEffect(() => {
    if (isMatching) {
      const { concerns, gender } = location.state;
      const scored = mockTherapists.map(therapist => {
        let score = 0;
        therapist.concerns.forEach(c => {
          if (concerns.includes(c)) score += 2;
        });
        if (gender !== 'No Preference' && therapist.gender === gender) {
          score += 5;
        }
        return { ...therapist, score };
      }).sort((a, b) => b.score - a.score);
      
      setScoredTherapists(scored);
    }
  }, [isMatching, location.state]);

  return (
    <>
      {isMatching ? (
        <section className="bg-sand py-12 text-center">
          <div className="container mx-auto px-6 max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-brown-dark mb-4">Here Are Your Recommended Therapists</h1>
            <p className="text-lg text-brown-soft">Based on your preferences, we believe these professionals would be a great fit for your journey.</p>
            <button
                onClick={() => navigate('/questionnaire')}
                className="mt-6 inline-flex items-center gap-2 text-brown-soft hover:text-brown-dark transition-colors font-semibold group"
            >
                <ChevronLeftIcon className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                <span>Change Preferences</span>
            </button>
          </div>
        </section>
      ) : (
        <section
            className="relative min-h-[300px] md:min-h-[428px] flex items-center justify-center p-6 text-center"
            style={{
                backgroundImage: `url('https://res.cloudinary.com/dyqspp2ud/image/upload/v1762938141/neutral_toned_hand_painted_watercolour_background_2404_pgyc6e.jpg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            <div className="relative container mx-auto px-6 max-w-5xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    {/* Left: Text Content */}
                    <div className="text-left">
                        <h1 
                            className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-brown-dark mb-6"
                            style={{textShadow: '1px 1px 3px rgba(253, 251, 245, 0.7)'}}
                        >
                            Find Your Therapist
                        </h1>
                        <div className="max-w-lg">
                            <p 
                                className="text-brown-dark text-lg md:text-xl font-serif italic"
                                style={{textShadow: '1px 1px 3px rgba(253, 251, 245, 0.7)'}}
                            >
                                "Healing begins with the right guide - we help you find yours"
                            </p>
                        </div>
                    </div>
                    
                    {/* Right: Illustration with themed frame & pop effect */}
                    <div className="flex justify-center items-center">
                        <div className="relative w-72 h-72 md:w-96 md:h-96 group" aria-hidden="false">
                            {/* soft gradient frame that matches site palette */}
                            <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-ivory to-sand opacity-95 transform transition-transform group-hover:scale-105" />

                            <div
                                className="relative w-full h-full p-4 rounded-xl border border-gold/20 shadow-lg overflow-hidden"
                                style={{
                                    backgroundImage: `url('https://res.cloudinary.com/dyqspp2ud/image/upload/v1762938141/neutral_toned_hand_painted_watercolour_background_2404_pgyc6e.jpg')`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat',
                                }}
                            >
                                {/* subtle ivory panel on top of the watercolor so image still reads clearly */}
                                <div className="absolute inset-2 md:inset-3 rounded-md bg-[rgba(251,247,243,0.86)] p-2 flex items-center justify-center">
                                    <img
                                        src="https://res.cloudinary.com/dyqspp2ud/image/upload/v1762438809/pd1d3bsjfxetkq4rtvah.png"
                                        alt="Therapeutic illustration: person receiving support"
                                        className="w-full h-full object-contain rounded-md transition-transform duration-300 group-hover:scale-105"
                                        style={{ filter: 'sepia(0.18) hue-rotate(-10deg) saturate(0.95) brightness(0.98) contrast(0.98)' }}
                                    />
                                </div>

                                {/* warm blend overlay to match header palette (brown/gold/ivory) */}
                                <div
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-xl pointer-events-none"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(250,244,238,0) 0%, rgba(178,137,95,0.12) 50%, rgba(145,100,58,0.18) 100%)',
                                        mixBlendMode: 'multiply',
                                    }}
                                />
                            </div>

                            {/* Decorative accent removed to prevent visual clutter */}
                        </div>
                    </div>
                </div>
            </div>
        </section>
      ) }

      <main>
        {isMatching ? (
          <div className="bg-cream">
            <div className="container mx-auto px-6 py-16">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {scoredTherapists.map((therapist, index) => (
                  <ScrollAnimationWrapper key={therapist.id} delay={100 * (index % 3)}>
                    <TherapistCard 
                      therapist={therapist} 
                      isBestMatch={index === 0} 
                    />
                  </ScrollAnimationWrapper>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-cream">
            {therapyTopics.map(topic => (
               <ScrollAnimationWrapper key={topic.name}>
                 <TherapistCarousel
                      therapists={mockTherapists.filter(topic.filterFn)}
                      title={topic.title}
                      description={topic.description}
                  />
               </ScrollAnimationWrapper>
            ))}
          </div>
        )}
      </main>
    </>
  );
};

export default TherapistsPage;