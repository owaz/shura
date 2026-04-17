import React from 'react';
import { useParams, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { mockTherapists } from '../data/therapists';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeftIcon, LocationIcon, GlobeIcon } from '../components/Icons';
import ScrollAnimationWrapper from '../components/ScrollAnimationWrapper';
import type { Therapist } from '../types';
import { Watermark } from '../components/Watermark';

// Slider component for Personality section
const ProfileSlider: React.FC<{ value: number; minLabel: string; maxLabel: string }> = ({ value, minLabel, maxLabel }) => (
  <div>
    <div className="flex justify-between text-xs text-brown-soft mb-1 px-1">
      <span className="font-medium">{minLabel}</span>
      <span className="font-medium">{maxLabel}</span>
    </div>
    <div className="w-full bg-sand rounded-full h-2">
      <div className="bg-brown-soft h-2 rounded-full" style={{ width: `${value}%` }}></div>
    </div>
  </div>
);

// Booking card component
interface BookingCardProps {
    duration: string;
    description: string;
    price?: number;
    onClick: () => void;
    isFree?: boolean;
    isPackage?: boolean;
}
const BookingCard: React.FC<BookingCardProps> = ({ duration, description, price, onClick, isFree, isPackage }) => {
    if (!price && !isFree) return null;
    const borderClass = isFree ? 'border-gold' : 'border-taupe/60';
    
    // Conditional classes for styling based on whether the card is free
    const durationClass = isFree ? "font-serif font-bold text-2xl text-brown-soft" : "font-serif font-bold text-xl text-brown-dark";
    const descriptionClass = isFree ? "text-base text-brown-soft mt-2 mb-4 flex-grow" : "text-sm text-brown-soft mt-1 mb-3 flex-grow";
    const priceClass = isFree ? "text-3xl font-serif font-bold text-brown-soft mb-5" : "text-2xl font-bold text-brown-soft mb-4";
    const buttonClass = "w-full bg-brown-soft text-white px-5 py-2.5 rounded-lg hover:bg-brown-dark transition-colors font-semibold";

    return (
        <div className={`bg-ivory p-5 rounded-xl flex flex-col text-center items-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-2 ${borderClass}`}>
            <h4 className={durationClass}>{duration}</h4>
            <p className={descriptionClass}>{description}</p>
            <p className={priceClass}>{isFree ? 'Free' : `₹${price?.toLocaleString('en-IN')}`}</p>
            <button 
                onClick={onClick}
                className={buttonClass}>
                {isPackage ? 'Select Plan' : 'Book Now'}
            </button>
        </div>
    );
};


const TherapistProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation();
  const therapist = mockTherapists.find(t => t.id === Number(id));

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const isBestMatch = state?.isBestMatch || false;

  if (!therapist) {
    return <Navigate to="/therapists" replace />;
  }

  const handleFreeBooking = () => {
    if (isAuthenticated) {
      navigate(`/chat/${therapist.id}`);
    } else {
      navigate('/login', { state: { redirectTo: `/chat/${therapist.id}` } });
    }
  };

  const handlePaidBooking = (sessionType: string, price: number) => {
    if (isAuthenticated) {
      navigate('/payment', {
        state: {
          therapist,
          sessionType,
          price,
        },
      });
    } else {
      navigate('/login', { state: { redirectTo: '/payment', paymentData: { therapist, sessionType, price } } });
    }
  };


  const monthlyPackage = therapist.packages?.find(p => p.name.includes("Monthly")) || (therapist.packages ? therapist.packages[0] : null);


  return (
    <div className="bg-sand py-12 md:py-16">
      <div className="container mx-auto px-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate('/therapists')}
            className="inline-flex items-center gap-2 text-brown-soft hover:text-brown-dark transition-colors font-semibold mb-6 group"
            aria-label="Go back to therapists list"
          >
            <ChevronLeftIcon className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            <span>Back to Therapists</span>
          </button>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-16">
            {/* Left Sidebar */}
            <aside className="lg:col-span-4 xl:col-span-3">
              <ScrollAnimationWrapper>
                <div className="bg-brown-dark text-ivory rounded-2xl px-8 pb-8 pt-24 flex flex-col items-center text-center h-full shadow-2xl sticky top-28">
                  {isBestMatch && (
                    <div className="absolute top-4 right-4 bg-gold text-white text-xs font-bold px-3 py-1 rounded-full z-10">
                      Best Match
                    </div>
                  )}
                  <img 
                    src={therapist.imageUrl} 
                    alt={therapist.name} 
                    className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-sand shadow-lg -mt-40 mb-4"
                  />
                  <h1 className="text-3xl font-serif font-bold">{therapist.name}</h1>
                  <p className="text-ivory/80 mt-1">{therapist.title}</p>
                  
                  <div className="border-t border-ivory/20 my-6 w-full"></div>

                  <ul className="space-y-4 text-left self-start">
                    <li className="flex items-center gap-3">
                      <LocationIcon className="h-5 w-5 text-ivory/80 flex-shrink-0" />
                      <span>{therapist.location}</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <GlobeIcon className="h-5 w-5 text-ivory/80 flex-shrink-0" />
                      <span>Speaks {therapist.language}</span>
                    </li>
                  </ul>
                  
                  <div className="flex flex-wrap justify-center gap-2 mt-6">
                    {therapist.sessionTypes.map(type => (
                      <span key={type} className="bg-brown-soft text-ivory text-xs font-semibold px-3 py-1 rounded-full">{type}</span>
                    ))}
                  </div>
                  
                  <div className="mt-auto pt-8">
                    <p className="font-serif italic text-ivory/80">"Healing is a journey, not a destination. I am here to walk with you."</p>
                  </div>
                </div>
              </ScrollAnimationWrapper>
            </aside>

            {/* Main Content */}
            <main className="lg:col-span-5 xl:col-span-6 space-y-8">
              {/* BIO */}
              <ScrollAnimationWrapper delay={100}>
                <section className="bg-white p-8 rounded-2xl shadow-lg">
                  <h2 className="text-2xl font-serif font-semibold text-brown-dark mb-4">BIO</h2>
                  <p className="text-brown-soft leading-relaxed whitespace-pre-line">{therapist.fullBio}</p>
                </section>
              </ScrollAnimationWrapper>

              {/* Approach & Focus */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ScrollAnimationWrapper delay={200}>
                  <section className="bg-white p-8 rounded-2xl shadow-lg h-full">
                    <h2 className="text-2xl font-serif font-semibold text-brown-dark mb-4">Therapeutic Approach</h2>
                    <ul className="list-disc list-inside text-brown-soft space-y-2">
                      {therapist.specialties.map(spec => <li key={spec}>{spec}</li>)}
                    </ul>
                  </section>
                </ScrollAnimationWrapper>
                <ScrollAnimationWrapper delay={300}>
                  <section className="bg-white p-8 rounded-2xl shadow-lg h-full">
                    <h2 className="text-2xl font-serif font-semibold text-brown-dark mb-4">Specialization</h2>
                    <ul className="list-disc list-inside text-brown-soft space-y-2">
                      {therapist.concerns.map(concern => <li key={concern} >{concern}</li>)}
                    </ul>
                  </section>
                </ScrollAnimationWrapper>
              </div>

              {/* Style & Values */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ScrollAnimationWrapper delay={200}>
                  <section className="bg-white p-8 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-serif font-semibold text-brown-dark mb-6">Approach Style</h2>
                    <div className="space-y-6">
                      <ProfileSlider minLabel="Gentle" maxLabel="Direct" value={30} />
                      <ProfileSlider minLabel="Structured" maxLabel="Flexible" value={70} />
                      <ProfileSlider minLabel="Listening" maxLabel="Action-Oriented" value={60} />
                    </div>
                  </section>
                </ScrollAnimationWrapper>
                <ScrollAnimationWrapper delay={300}>
                  <section className="bg-white p-8 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-serif font-semibold text-brown-dark mb-6">Professional Values</h2>
                    <div className="space-y-6">
                      <ProfileSlider minLabel="Client Empowerment" maxLabel="" value={90} />
                      <ProfileSlider minLabel="Holistic Healing" maxLabel="" value={80} />
                      <ProfileSlider minLabel="Evidence-Based" maxLabel="" value={85} />
                    </div>
                  </section>
                </ScrollAnimationWrapper>
              </div>
            </main>

            {/* Right Sidebar - Booking */}
            <aside className="lg:col-span-3 xl:col-span-3">
              <ScrollAnimationWrapper delay={400}>
                <div className="sticky top-28">
                  <section className="bg-white p-6 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-serif font-bold text-brown-dark mb-6 text-center">Book a Session</h2>
                    <div className="space-y-4">
                        <BookingCard 
                            duration="20-Min Intro" 
                            description="Meet & greet to ensure a good fit." 
                            isFree={true} 
                            onClick={handleFreeBooking}
                        />
                        {therapist.rates.session60 && (
                            <BookingCard 
                                duration="60-Min Session" 
                                description="Standard individual session." 
                                price={therapist.rates.session60} 
                                onClick={() => handlePaidBooking('60-Min Session', therapist.rates.session60)} 
                            />
                        )}
                        {therapist.rates.session90 && (
                            <BookingCard 
                                duration="90-Min Session" 
                                description="Extended individual session." 
                                price={therapist.rates.session90} 
                                onClick={() => handlePaidBooking('90-Min Session', therapist.rates.session90)} 
                            />
                        )}
                        {monthlyPackage && (
                            <BookingCard 
                                duration="Monthly Support"
                                description={`${monthlyPackage.sessions} sessions for consistent progress.`}
                                price={monthlyPackage.price}
                                onClick={() => handlePaidBooking('Monthly Support', monthlyPackage.price)}
                                isPackage
                            />
                        )}
                    </div>
                  </section>
                </div>
              </ScrollAnimationWrapper>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TherapistProfilePage;