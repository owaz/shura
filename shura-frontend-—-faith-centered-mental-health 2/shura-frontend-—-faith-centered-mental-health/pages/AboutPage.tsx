import React from 'react';
import { MissionIcon, VisionIcon, ValuesIcon } from '../components/Icons';
import ScrollAnimationWrapper from '../components/ScrollAnimationWrapper';
import { Watermark } from '../components/Watermark';

const tenets = [
    {
        id: 'mission',
        Icon: MissionIcon,
        title: "Our Mission",
        text: "To make faith-centered mental healthcare accessible to every Muslim in India, fostering healing, resilience, and spiritual growth."
    },
    {
        id: 'vision',
        Icon: VisionIcon,
        title: "Our Vision",
        text: "To be the most trusted platform for Islamic psychology, building a community where mental and spiritual well-being thrive in harmony."
    },
    {
        id: 'values',
        Icon: ValuesIcon,
        title: "Our Values",
        text: "Compassion (Rahmah), Trust (Amanah), Excellence (Ihsan), and Inclusivity are the pillars of our work."
    }
];

const AboutPage: React.FC = () => {
  return (
    <>
      <Watermark />
      <div className="relative z-10 space-y-20 md:space-y-28 pb-16">
      {/* Hero Banner Section */}
      <section
        className="relative min-h-[300px] md:min-h-[428px] flex items-center justify-center p-6 text-center"
        role="banner"
        style={{
            backgroundImage: `url('https://res.cloudinary.com/dyqspp2ud/image/upload/v1762938141/neutral_toned_hand_painted_watercolour_background_2404_pgyc6e.jpg')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        }}
      >
        <div className="relative container mx-auto px-6 max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-brown-dark mb-4" style={{textShadow: '1px 1px 3px rgba(255, 255, 255, 0.7)'}}>About Us</h1>
          <p className="text-xl md:text-2xl font-serif italic text-brown-dark" style={{textShadow: '1px 1px 3px rgba(255, 255, 255, 0.7)'}}>
            Guided by Faith, Grounded in Care
          </p>
        </div>
      </section>
      
      {/* Combined Story & Mission Section with Lighter Background */}
      <ScrollAnimationWrapper>
        <section className="bg-sand">
          <div className="container mx-auto px-6 py-20 md:py-24 space-y-20 md:space-y-24">
              {/* Our Story Section */}
              <div className="text-center max-w-4xl mx-auto">
                  <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark mb-4">Our Story</h2>
                  <p className="text-lg text-brown-soft leading-relaxed mb-12">
                  Shura was born from a simple yet profound realization: mental health is a vital part of our deen. We sought to create a platform where psychology meets spirituality, providing a professional, accessible, and culturally-sensitive space for Muslims to seek guidance. Our work is dedicated to integrating the best of modern therapy with the deep-rooted wisdom of Islamic tradition to support holistic well-being.
                  </p>
                  
                  {/* Story Images Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="rounded-lg overflow-hidden shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300">
                      <img 
                        src="https://res.cloudinary.com/dyqspp2ud/image/upload/v1765394846/4253793_wdkoie.jpg" 
                        alt="Diverse community members"
                        className="w-full h-64 object-cover"
                      />
                    </div>
                    <div className="rounded-lg overflow-hidden shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300">
                      <img 
                        src="https://res.cloudinary.com/dyqspp2ud/image/upload/v1765394803/conceptual-digital-art-diversity-around-world_z3u4rx.png" 
                        alt="Global diversity and wellness"
                        className="w-full h-64 object-cover"
                      />
                    </div>
                    <div className="rounded-lg overflow-hidden shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300">
                      <img 
                        src="https://res.cloudinary.com/dyqspp2ud/image/upload/v1765394841/pillars_y4itiq.png" 
                        alt="Pillars of Shura"
                        className="w-full h-64 object-cover"
                      />
                    </div>
                  </div>
              </div>

              {/* Mission, Vision, Values Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {tenets.map((tenet, index) => (
                      <ScrollAnimationWrapper key={tenet.id} delay={100 * (index + 1)}>
                        <div className="bg-ivory p-8 rounded-xl shadow-md text-center transform hover:-translate-y-2 transition-transform duration-300 h-full">
                            <div className="mb-6 inline-flex items-center justify-center h-20 w-20 rounded-full bg-sand">
                                <tenet.Icon className="h-10 w-10 text-brown-soft" />
                            </div>
                            <h3 className="text-2xl font-serif font-semibold text-brown-dark mb-3">{tenet.title}</h3>
                            <p className="text-brown-soft leading-relaxed">{tenet.text}</p>
                        </div>
                      </ScrollAnimationWrapper>
                  ))}
              </div>
          </div>
        </section>
      </ScrollAnimationWrapper>
      
      {/* Founder's Note */}
      <ScrollAnimationWrapper>
        <section className="bg-ivory py-20">
          <div className="container mx-auto px-6 flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/3 text-center md:text-left">
              <div className="inline-block bg-sand rounded-full w-48 h-48 md:w-64 md:h-64 p-8 shadow-xl border-4 border-white" aria-label="Founder silhouette">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-taupe opacity-75" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
              </div>
            </div>
            <div className="md:w-2/3">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark mb-4">A Note From Our Founder</h2>
              <p className="text-brown-soft leading-relaxed mb-4">
                "As a community, we often carry our burdens in silence, unsure of where to turn for support that honors both our mind and our faith. I started Shura to bridge that gap. My own journey taught me the power of therapy that is aligned with one's spiritual values. It's not about choosing between psychology and Islam—it's about seeing how beautifully they can work together. My hope is that Shura becomes a source of light and ease for many, insha'Allah."
              </p>
              <p className="font-semibold text-brown-dark">- Founder</p>
            </div>
          </div>
        </section>
      </ScrollAnimationWrapper>

      {/* Our Promise Banner */}
      <ScrollAnimationWrapper>
        <section className="container mx-auto px-6">
          <div className="bg-sand rounded-xl p-10 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-repeat bg-center opacity-5" style={{backgroundImage: "url('/geometric-pattern.svg')"}}></div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark mb-4 z-10 relative">Our Promise to You</h2>
            <p className="text-lg text-brown-soft max-w-3xl mx-auto z-10 relative">
              We are committed to providing a confidential, non-judgmental, and empathetic environment. Every therapist on our platform is a licensed professional who shares our commitment to faith-sensitive care. Your healing journey is a sacred trust we are honored to uphold.
            </p>
          </div>
        </section>
      </ScrollAnimationWrapper>
    </div>
    </>
  );
};

export default AboutPage;