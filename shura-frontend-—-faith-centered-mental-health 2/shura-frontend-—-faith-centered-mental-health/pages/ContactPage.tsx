import React from 'react';
import type { FaqItem } from '../types';
import FaqAccordion from '../components/FaqAccordion';
import { WhatsAppIcon } from '../components/Icons';
import ScrollAnimationWrapper from '../components/ScrollAnimationWrapper';
import { Watermark } from '../components/Watermark';

const faqItems: FaqItem[] = [
  { id: 1, question: "How are sessions conducted?", answer: "All sessions are conducted securely online through video calls, ensuring your privacy and convenience. You can connect from anywhere in India." },
  { id: 2, question: "Is my information kept private?", answer: "Absolutely. We adhere to strict confidentiality standards. Your personal information and session details are encrypted and securely stored." },
  { id: 3, question: "How do payments work?", answer: "We offer several Islamically-compliant payment options, including one-time payments. All payments are processed securely through trusted gateways like Razorpay." },
  { id: 4, question: "What does 'spiritual integration' mean?", answer: "It means our therapists are trained to incorporate Islamic principles, values, and concepts like Sabr (patience), Tawakkul (trust in God), and Shukr (gratitude) into their therapeutic methods, if you are comfortable with it." },
  { id: 5, question: "Can I choose my therapist?", answer: "Yes. You can browse our directory of licensed therapists, read their profiles, and choose someone who you feel is the right fit for you. We also provide recommendations based on your intake form." },
];

const ContactPage: React.FC = () => {
  return (
    <>
      <Watermark />
      <div className="relative z-10 py-16">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Contact Form & Info */}
          <ScrollAnimationWrapper>
            <div>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-brown-dark mb-4">Get in Touch</h1>
              <p className="text-lg text-brown-soft mb-8">We're here to help. Send us a message, and we'll get back to you as soon as possible.</p>

              <form className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-brown-soft">Full Name</label>
                  <input type="text" id="name" className="mt-1 block w-full bg-ivory border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-brown-soft">Email Address</label>
                  <input type="email" id="email" className="mt-1 block w-full bg-ivory border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-brown-soft">Message</label>
                  <textarea id="message" rows={5} className="mt-1 block w-full bg-ivory border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft"></textarea>
                </div>
                <div>
                  <button type="submit" className="w-full bg-brown-soft text-white py-3 px-6 rounded-lg font-semibold hover:bg-opacity-90 transition-colors">
                    Send Message
                  </button>
                </div>
              </form>

              <div className="mt-12 text-center">
                  <p className="text-brown-soft mb-4">Or reach us directly:</p>
                  <div className="flex justify-center items-center space-x-6">
                      <a href="mailto:support@shura.health" className="text-brown-soft hover:underline font-semibold">support@shura.health</a>
                      <a href="#" className="flex items-center space-x-2 bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 transition-colors">
                          <WhatsAppIcon className="h-5 w-5" />
                          <span>WhatsApp</span>
                      </a>
                  </div>
              </div>
            </div>
          </ScrollAnimationWrapper>

          {/* FAQ Section */}
          <ScrollAnimationWrapper delay={200}>
            <div id="faq">
              <h2 className="text-3xl font-serif font-bold text-brown-dark mb-8">Frequently Asked Questions</h2>
              <FaqAccordion items={faqItems} />
            </div>
          </ScrollAnimationWrapper>
        </div>
      </div>
      </div>
    </>
  );
};

export default ContactPage;