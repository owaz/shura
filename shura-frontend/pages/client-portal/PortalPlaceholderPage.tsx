import React from 'react';

interface PortalPlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
}

const PortalPlaceholderPage: React.FC<PortalPlaceholderPageProps> = ({ eyebrow, title, description }) => (
  <section className="max-w-3xl py-4 md:py-8">
    <p className="text-xs uppercase tracking-[0.18em] text-brown-soft font-semibold">{eyebrow}</p>
    <h1 className="mt-3 font-serif text-4xl text-brown-dark">{title}</h1>
    <div className="mt-8 rounded-2xl border border-sand bg-white/90 p-7 shadow-sm">
      <p className="text-base leading-7 text-brown-soft">{description}</p>
      <div className="mt-6 h-2 w-3/4 rounded-full bg-sand" aria-hidden="true" />
      <div className="mt-3 h-2 w-1/2 rounded-full bg-sand" aria-hidden="true" />
    </div>
  </section>
);

export default PortalPlaceholderPage;
