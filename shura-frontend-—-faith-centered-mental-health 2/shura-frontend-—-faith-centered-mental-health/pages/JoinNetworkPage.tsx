import React from 'react';
import { Link } from 'react-router-dom';
import { SparkleIcon, ConfidentialityIcon, CouplesIcon, ValuesIcon } from '../components/Icons';
import ScrollAnimationWrapper from '../components/ScrollAnimationWrapper';
import { Watermark } from '../components/Watermark';

const benefits = [
    {
        Icon: SparkleIcon,
        title: "Purpose-Driven Practice",
        text: "Connect with clients specifically seeking faith-sensitive care, allowing you to practice in a way that deeply aligns with your values."
    },
    {
        Icon: ConfidentialityIcon,
        title: "Seamless & Secure Platform",
        text: "We handle the marketing, secure payments, and scheduling, so you can focus on what you do best: providing quality therapy."
    },
    {
        Icon: CouplesIcon,
        title: "Flexible & Autonomous",
        text: "Set your own hours, manage your availability, and build your practice on your terms, from anywhere in India."
    },
    {
        Icon: ValuesIcon,
        title: "Professional Community",
        text: "Join a supportive network of like-minded Muslim mental health professionals for collaboration, support, and growth."
    }
];

const JoinNetworkPage: React.FC = () => {
  return (
    <>
      <Watermark />
      <div className="space-y-20 md:space-y-28 pb-16 bg-cream relative z-10">
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
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-brown-dark mb-4" style={{textShadow: '1px 1px 3px rgba(255, 255, 255, 0.7)'}}>Join Our Network of Healers</h1>
          <p className="text-xl md:text-2xl font-serif italic text-brown-dark" style={{textShadow: '1px 1px 3px rgba(255, 255, 255, 0.7)'}}>
            Empower the community. Grow your practice. Make a difference.
          </p>
        </div>
      </section>
      
      {/* Benefits Section */}
      <ScrollAnimationWrapper>
        <section className="container mx-auto px-6">
            <div className="text-center mb-12 max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark">Why Partner with Shura?</h2>
                <p className="text-lg text-brown-soft mt-4">We are dedicated to supporting our therapists so they can provide the best possible care. Here’s how we help you thrive.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {benefits.map((benefit, index) => (
                    <ScrollAnimationWrapper key={benefit.title} delay={100 * (index + 1)}>
                    <div className="bg-ivory p-8 rounded-xl shadow-md text-center transform hover:-translate-y-2 transition-transform duration-300 h-full">
                        <div className="mb-6 inline-flex items-center justify-center h-16 w-16 rounded-full bg-sand">
                            <benefit.Icon className="h-8 w-8 text-brown-soft" />
                        </div>
                        <h3 className="text-xl font-serif font-semibold text-brown-dark mb-3">{benefit.title}</h3>
                        <p className="text-brown-soft leading-relaxed">{benefit.text}</p>
                    </div>
                    </ScrollAnimationWrapper>
                ))}
            </div>
        </section>
      </ScrollAnimationWrapper>

      {/* How It Works Section */}
      <ScrollAnimationWrapper>
        <section className="bg-sand py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-brown-dark">Getting Started is Simple</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-12 text-center max-w-5xl mx-auto">
                <div className="flex flex-col items-center">
                   <div className="bg-ivory text-brown-soft rounded-full h-20 w-20 flex items-center justify-center text-4xl font-bold mb-4 shadow-sm">1</div>
                   <h3 className="text-xl font-serif font-semibold text-brown-dark mb-2">Submit Your Application</h3>
                   <p className="text-brown-soft">Fill out our straightforward application form with your credentials and information.</p>
                </div>
                <div className="flex flex-col items-center">
                   <div className="bg-ivory text-brown-soft rounded-full h-20 w-20 flex items-center justify-center text-4xl font-bold mb-4 shadow-sm">2</div>
                   <h3 className="text-xl font-serif font-semibold text-brown-dark mb-2">Verification & Onboarding</h3>
                   <p className="text-brown-soft">Our team will review your application and guide you through a simple onboarding process.</p>
                </div>
                <div className="flex flex-col items-center">
                   <div className="bg-ivory text-brown-soft rounded-full h-20 w-20 flex items-center justify-center text-4xl font-bold mb-4 shadow-sm">3</div>
                   <h3 className="text-xl font-serif font-semibold text-brown-dark mb-2">Create Your Profile & Start</h3>
                   <p className="text-brown-soft">Set up your public profile, manage your schedule, and begin connecting with clients.</p>
                </div>
            </div>
          </div>
        </section>
      </ScrollAnimationWrapper>
      
      {/* Final CTA */}
      <ScrollAnimationWrapper>
        <section className="container mx-auto px-6">
          <div className="bg-brown-soft rounded-xl p-12 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Ready to Join Us?</h2>
            <p className="text-lg max-w-2xl mx-auto mb-8">Take the next step in growing your practice and making a meaningful impact in the community.</p>
            <Link to="/join-as-therapist" className="bg-white text-brown-soft px-8 py-3 rounded-full hover:bg-opacity-90 transition-transform duration-300 font-semibold text-lg transform hover:scale-105 inline-block">
              Apply Now
            </Link>
          </div>
        </section>
      </ScrollAnimationWrapper>
    </div>
    </>
  );
};

export default JoinNetworkPage;