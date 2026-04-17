

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MissionIcon, CouplesIcon, ValuesIcon, ConfidentialityIcon } from '../components/Icons';
import ScrollAnimationWrapper from '../components/ScrollAnimationWrapper';
import { Watermark } from '../components/Watermark';

// Testimonials will be added later

const HomePage: React.FC = () => {
  const { isAuthenticated, questionnaireCompleted } = useAuth();
  const navigate = useNavigate();

  const handleCtaClick = () => {
    if (isAuthenticated) {
      if (questionnaireCompleted) {
        navigate('/therapists');
      } else {
        navigate('/questionnaire');
      }
    } else {
      navigate('/login-hub');
    }
  };

  return (
    <>
      <Watermark />
      <div className="space-y-24 md:space-y-32 pb-16 relative z-10">
      {/* Hero Section */}
      <section 
        className="relative min-h-[400px] md:min-h-[500px] flex items-center justify-center bg-cover bg-center"
        style={{
            backgroundImage: `url('https://res.cloudinary.com/dyqspp2ud/image/upload/v1762938141/neutral_toned_hand_painted_watercolour_background_2404_pgyc6e.jpg')`,
        }}
      >
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-brown-dark mb-4" style={{textShadow: '1px 1px 3px rgba(253, 251, 245, 0.7)'}}>Where Faith Meets Healing</h1>
          <p className="text-lg md:text-xl text-brown-dark max-w-2xl mx-auto mb-8" style={{textShadow: '1px 1px 3px rgba(253, 251, 245, 0.7)'}}>Digital access to qualified Muslim therapists across India, grounded in care and guided by spirituality.</p>
          <div className="flex flex-wrap justify-center items-center gap-4">
            <button onClick={handleCtaClick} className="bg-brown-soft text-white px-8 py-3 rounded-full hover:bg-opacity-90 transition-transform duration-300 font-semibold text-lg transform hover:scale-105">Get Started</button>
            <Link to="/about" className="bg-transparent border-2 border-brown-dark text-brown-dark px-8 py-3 rounded-full hover:bg-brown-dark hover:text-white transition-colors duration-300 font-semibold text-lg">Learn More</Link>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <ScrollAnimationWrapper>
        <section className="container mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <div className="flex justify-center md:justify-start">
                  <img 
                      src="https://res.cloudinary.com/dyqspp2ud/image/upload/e_background_removal/Screenshot_2025-11-11_180141_fv70kx" 
                      alt="A woman in quiet reflection, embodying serenity." 
                      className="rounded-xl shadow-lg w-full max-w-sm transform transition-transform duration-300 hover:scale-105"
                  />
              </div>
              <div className="text-center md:text-left">
                  <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark mb-4">A Sanctuary for Mind, Heart, and Soul</h2>
                  <p className="text-lg text-brown-soft leading-relaxed">
                      At Shura, we believe that true well-being is achieved when mental health is nurtured in harmony with one's spiritual core. Our approach integrates evidence-based psychological practices with the timeless wisdom of Islamic teachings, offering a path to healing that is both professionally sound and spiritually affirming. We provide a space for reflection, growth, and finding serenity.
                  </p>
              </div>
            </div>
        </section>
      </ScrollAnimationWrapper>

      {/* 3-Step Section */}
      <section className="container mx-auto px-6">
        <ScrollAnimationWrapper>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark">Begin Your Journey in Three Simple Steps</h2>
          </div>
        </ScrollAnimationWrapper>
        <div className="grid md:grid-cols-3 gap-12 text-center">
          <ScrollAnimationWrapper delay={100}>
            <div className="flip-card h-56 md:h-64">
              <div className="flip-card-inner">
                <div className="flip-card-front flex flex-col items-center justify-center p-6 bg-ivory shadow-lg">
                   <div className="bg-sand text-brown-soft rounded-full h-16 w-16 flex items-center justify-center text-3xl font-bold mb-4">1</div>
                   <h3 className="text-xl font-serif font-semibold text-brown-dark">Sign Up</h3>
                </div>
                <div className="flip-card-back flex flex-col items-center justify-center p-6 bg-sand shadow-lg text-brown-soft">
                    <p>Create your secure account to get started on your journey.</p>
                </div>
              </div>
            </div>
          </ScrollAnimationWrapper>
          <ScrollAnimationWrapper delay={200}>
            <div className="flip-card h-56 md:h-64">
              <div className="flip-card-inner">
                <div className="flip-card-front flex flex-col items-center justify-center p-6 bg-ivory shadow-lg">
                   <div className="bg-sand text-brown-soft rounded-full h-16 w-16 flex items-center justify-center text-3xl font-bold mb-4">2</div>
                   <h3 className="text-xl font-serif font-semibold text-brown-dark">Match with a Therapist</h3>
                </div>
                <div className="flip-card-back flex flex-col items-center justify-center p-6 bg-sand shadow-lg text-brown-soft">
                    <p>We'll recommend therapists who align with your needs, or you can browse and choose your own.</p>
                </div>
              </div>
            </div>
          </ScrollAnimationWrapper>
          <ScrollAnimationWrapper delay={300}>
            <div className="flip-card h-56 md:h-64">
              <div className="flip-card-inner">
                <div className="flip-card-front flex flex-col items-center justify-center p-6 bg-ivory shadow-lg">
                   <div className="bg-sand text-brown-soft rounded-full h-16 w-16 flex items-center justify-center text-3xl font-bold mb-4">3</div>
                   <h3 className="text-xl font-serif font-semibold text-brown-dark">Begin Your Journey</h3>
                </div>
                <div className="flip-card-back flex flex-col items-center justify-center p-6 bg-sand shadow-lg text-brown-soft">
                    <p>Book your first session and start your path towards healing and well-being.</p>
                </div>
              </div>
            </div>
          </ScrollAnimationWrapper>
        </div>
        <ScrollAnimationWrapper delay={400}>
          <div className="text-center mt-12">
              <button onClick={handleCtaClick} className="bg-brown-soft text-white px-8 py-3 rounded-full hover:bg-opacity-90 transition-transform duration-300 font-semibold text-lg transform hover:scale-105">Get Started</button>
          </div>
        </ScrollAnimationWrapper>
      </section>
      
      {/* Moment of Reflection Video Section */}
      <ScrollAnimationWrapper>
        <section className="bg-ivory py-20">
          <div className="container mx-auto px-6 text-center">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark mb-4">Discover Shura</h2>
              <p className="text-lg text-brown-soft max-w-3xl mx-auto mb-12">
              Watch our intro video to see how we’re redefining healing through faith.
              </p>
              <div className="max-w-4xl mx-auto rounded-xl shadow-lg overflow-hidden">
              <video
                  className="w-full h-full object-cover"
                  src="https://res.cloudinary.com/dyqspp2ud/video/upload/v1762852187/intro_video_homepage_adnppb.mp4"
                  controls
                  muted
                  playsInline
              >
                  Your browser does not support the video tag.
              </video>
              </div>
          </div>
        </section>
      </ScrollAnimationWrapper>

      {/* Core Tenets Section */}
      <section className="bg-sand py-20">
        <div className="container mx-auto px-6">
          <ScrollAnimationWrapper>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark">Our Approach</h2>
            </div>
          </ScrollAnimationWrapper>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <ScrollAnimationWrapper delay={100}>
              <div className="text-center p-6 bg-ivory rounded-xl shadow-sm h-full">
                  <ConfidentialityIcon className="h-12 w-12 text-brown-soft mx-auto mb-4" />
                  <h3 className="text-xl font-serif font-semibold text-brown-dark mb-2">Confidential & Secure</h3>
                  <p className="text-brown-soft">Your privacy is a sacred trust. Our platform is secure and all sessions are confidential.</p>
              </div>
            </ScrollAnimationWrapper>
            <ScrollAnimationWrapper delay={200}>
              <div className="text-center p-6 bg-ivory rounded-xl shadow-sm h-full">
                  <MissionIcon className="h-12 w-12 text-brown-soft mx-auto mb-4" />
                  <h3 className="text-xl font-serif font-semibold text-brown-dark mb-2">Faith-Integrated</h3>
                  <p className="text-brown-soft">We integrate Islamic principles with evidence-based psychology for holistic healing.</p>
              </div>
            </ScrollAnimationWrapper>
            <ScrollAnimationWrapper delay={300}>
              <div className="text-center p-6 bg-ivory rounded-xl shadow-sm h-full">
                  <CouplesIcon className="h-12 w-12 text-brown-soft mx-auto mb-4" />
                  <h3 className="text-xl font-serif font-semibold text-brown-dark mb-2">Qualified Professionals</h3>
                  <p className="text-brown-soft">All our therapists are licensed, experienced, and share our commitment to your well-being.</p>
              </div>
            </ScrollAnimationWrapper>
             <ScrollAnimationWrapper delay={400}>
               <div className="text-center p-6 bg-ivory rounded-xl shadow-sm h-full">
                  <ValuesIcon className="h-12 w-12 text-brown-soft mx-auto mb-4" />
                  <h3 className="text-xl font-serif font-semibold text-brown-dark mb-2">Culturally Sensitive</h3>
                  <p className="text-brown-soft">We understand the unique cultural and spiritual context of the Muslim community in India.</p>
              </div>
            </ScrollAnimationWrapper>
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section className="container mx-auto px-6">
        <ScrollAnimationWrapper>
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark mb-4">Voices from Our Community</h2>
            <p className="text-lg text-brown-soft">Content will be uploaded soon</p>
          </div>
        </ScrollAnimationWrapper>
      </section>

      {/* Final CTA */}
      <ScrollAnimationWrapper>
        <section className="container mx-auto px-6">
          <div className="bg-brown-soft rounded-xl p-12 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Ready to Take the First Step?</h2>
            <p className="text-lg max-w-2xl mx-auto mb-8">Your journey to peace and well-being is just a click away. Connect with a therapist who understands.</p>
            <button onClick={handleCtaClick} className="bg-white text-brown-soft px-8 py-3 rounded-full hover:bg-opacity-90 transition-transform duration-300 font-semibold text-lg transform hover:scale-105">Find Your Therapist</button>
          </div>
        </section>
      </ScrollAnimationWrapper>
    </div>
    </>
  );
};

export default HomePage;