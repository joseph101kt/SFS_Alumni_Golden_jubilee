// app/page.tsx
'use client';

import Hero from '@/components/hero';
import Link from 'next/link';

export default function HomePage() {
  const galleryItems = [
    {
      id: 1,
      image: '/images/classroom.jpg',
      label: 'Classroom Foundations',
      title: 'Generations of Academic Focus & Value-Based Learning',
      span: 'md:col-span-7',
      height: 'min-h-[300px]',
    },
    {
      id: 2,
      image: '/images/assembly.jpg',
      label: 'Assembly Traditions',
      title: 'School Ground Assemblies & Sports Disciplines',
      span: 'md:col-span-5',
      height: 'min-h-[300px]',
    },
    {
      id: 3,
      image: '/images/council.jpg',
      label: 'Student Leadership',
      title: 'Investiture & House Prefects',
      span: 'md:col-span-4',
      height: 'h-64',
    },
    {
      id: 4,
      image: '/images/annual-day.jpg',
      label: 'Cultural Heritage',
      title: 'Annual Day & Celebrations',
      span: 'md:col-span-4',
      height: 'h-64',
    },
    {
      id: 5,
      image: '/images/faculty.jpg',
      label: 'Dedicated Mentors',
      title: 'Teachers Who Guided 50 Years',
      span: 'md:col-span-4',
      height: 'h-64',
    },
  ];

  return (
    <div className="bg-surface min-h-screen flex flex-col">


      {/* MAIN CONTENT */}
      <main className="w-full pt-20 bg-surface flex-grow">

        <Hero />

        {/* STATS BAR */}
        <section className="w-full bg-primary-container text-on-primary py-8 shadow-md relative z-10">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8 items-center text-center">
              <div className="flex flex-col items-center p-3 rounded-lg bg-tertiary-container/30">
                <span className="text-headline-lg lg:text-numeral-jubilee text-secondary-fixed">
                  50
                </span>
                <span className="text-label-md uppercase tracking-wider text-surface-container-high mt-1">
                  Years of Excellence
                </span>
                <span className="text-label-sm text-on-primary-container">
                  1976 – 2026 Milestone
                </span>
              </div>

              <div className="flex flex-col items-center p-3 rounded-lg bg-tertiary-container/30">
                <span className="text-headline-lg lg:text-numeral-jubilee text-secondary-fixed">
                  15,000+
                </span>
                <span className="text-label-md uppercase tracking-wider text-surface-container-high mt-1">
                  SFS Alumni Worldwide
                </span>
                <span className="text-label-sm text-on-primary-container">
                  Spanning 5 Decades
                </span>
              </div>

              <div className="flex flex-col items-center p-3 rounded-lg bg-tertiary-container/30">
                <span className="text-headline-lg lg:text-numeral-jubilee text-secondary-fixed">
                  4
                </span>
                <span className="text-label-md uppercase tracking-wider text-surface-container-high mt-1">
                  House Traditions
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" title="Blue House"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" title="Red House"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" title="Green House"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" title="Yellow House"></span>
                </div>
              </div>

              <div className="flex flex-col items-center p-3 rounded-lg bg-tertiary-container/30">
                <span className="text-headline-lg lg:text-numeral-jubilee text-secondary-fixed">
                  Grand
                </span>
                <span className="text-label-md uppercase tracking-wider text-surface-container-high mt-1">
                  50th Celebrations
                </span>
                <span className="text-label-sm text-on-primary-container">
                  Reunions & Campus Gala
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* PRINCIPAL'S MESSAGE */}
        <section className="w-full bg-surface-ivory py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="bg-surface-paper rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch">
              {/* Left: Principal's portrait */}
              <div className="lg:col-span-5 relative bg-primary flex flex-col justify-end p-8 min-h-[360px] lg:min-h-full overflow-hidden">
                <img
                  alt="Rev. Fr. Anil Kumar R, Principal of St. Francis de Sales High School"
                  className="absolute inset-0 w-full h-full object-cover object-top opacity-95 hover:scale-105 transition-transform duration-700"
                  src="/images/principal.jpg"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent"></div>

                {/* Bottom label */}
                <div className="relative z-10 text-on-primary">
                  <span className="text-label-sm uppercase tracking-widest text-secondary-fixed">
                    School Leadership
                  </span>
                  <h3 className="text-headline-md text-surface-paper mt-0.5">
                    Fr. Anil Kumar R
                  </h3>
                  <p className="text-body-sm text-surface-container-high">
                    Principal, SFS Shanthinagar
                  </p>
                </div>
              </div>

              {/* Right: Message content */}
              <div className="lg:col-span-7 p-8 lg:p-12 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3 text-jubilee-gold-deep">
                    <span className="material-symbols-outlined text-[20px]">
                      format_quote
                    </span>
                    <span className="text-label-md uppercase tracking-widest font-bold">
                      Theme: "Aspire to Achieve"
                    </span>
                  </div>

                  <h2 className="text-headline-lg text-primary mb-4 leading-tight">
                    Principal's Jubilee Welcome Message
                  </h2>

                  <p className="text-body-md text-on-surface-variant mb-4 leading-relaxed">
                    As we celebrate the <strong className="text-primary font-bold">Golden Jubilee</strong> of our beloved institution—50 glorious years of excellence, service, and transformation—we pay tribute to the unwavering dedication of all who have walked through SFS halls.
                  </p>

                  <p className="text-body-md text-on-surface-variant mb-6 leading-relaxed">
                    To our generations of alumni and teachers: you are the bedrock of this legacy. Let us honour our rich past, cherish our milestones, and move forward with renewed unity and commitment to inspire the future.
                  </p>

                  <blockquote className="p-4 rounded-lg bg-surface-container-low text-primary text-headline-sm italic mb-6">
                    "Success is not final, failure is not fatal: it is the courage to continue that counts."
                  </blockquote>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-surface-container">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-jubilee-gold-deep">
                      <span className="material-symbols-outlined text-[22px]">
                        verified
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-label-md text-primary uppercase">
                        Rev. Fr. Anil Kumar R
                      </span>
                      <span className="text-label-sm text-on-surface-variant">
                        Principal • Golden Jubilee Year
                      </span>
                    </div>
                  </div>
                  <Link
                    href="#gallery-section"
                    className="inline-flex items-center gap-1.5 text-label-md uppercase tracking-wider text-primary hover:text-jubilee-gold-deep transition-colors"
                  >
                    Reconnect with SFS
                    <span className="material-symbols-outlined text-[18px]">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* GALLERY SECTION */}
        <section className="w-full bg-surface-bright py-16 lg:py-20" id="gallery-section">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            {/* Section Header */}
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-label-sm uppercase tracking-widest text-jubilee-gold-deep font-bold">
                Historical & Campus Archives
              </span>
              <h2 className="text-headline-lg text-primary tracking-tight mt-1">
                Our School Gallery & Campus Life
              </h2>
              <p className="text-body-sm text-on-surface-variant mt-2">
                Glimpses of daily discipline, investitures, and grand celebrations that have shaped SFS Shanthinagar over fifty years.
              </p>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
              {galleryItems.map((item, idx) => (
                <div
                  key={item.id}
                  className={`${item.span} rounded-xl overflow-hidden shadow-md group relative ${item.height} bg-primary`}
                >
                  <img
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    src={item.image}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent opacity-90"></div>
                  <div className="absolute bottom-4 left-4 right-4 text-on-primary">
                    <span className="text-label-sm uppercase tracking-wider text-secondary-fixed">
                      {item.label}
                    </span>
                    <p className={`text-surface-paper mt-1 ${idx < 2 ? 'text-headline-sm' : 'text-body-md font-semibold'}`}>
                      {item.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="w-full bg-surface-ivory pt-16 pb-12 shadow-[0_-1px_12px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12 pb-12">
            {/* Left: School info */}
            <div className="md:col-span-5 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <img
                  alt="SFS Shanthinagar Emblem"
                  className="h-10 w-auto object-contain rounded-full"
                  src="/images/emblem.png"
                />
                <span className="text-headline-sm text-primary">
                  St. Francis de Sales' High School
                </span>
              </div>

              <p className="text-body-sm text-on-surface-variant max-w-md mb-6">
                North Lalaguda, Shanthinagar, Secunderabad - 500017, Telangana, India
              </p>

              {/* Contact Links */}
              <div className="flex flex-col gap-2.5 mb-6">
                <a
                  href="mailto:info@sfsshanthinagar.com"
                  className="inline-flex items-center gap-2.5 text-body-sm text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    mail
                  </span>
                  info@sfsshanthinagar.com
                </a>
                <a
                  href="mailto:info@sfsshanthinagar.com"
                  className="inline-flex items-center gap-2.5 text-body-sm text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    mail
                  </span>
                  sfsalumnis@gmail.com
                </a>
                <a
                  href="tel:+918012345678"
                  className="inline-flex items-center gap-2.5 text-body-sm text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    call
                  </span>
                  +91 80 1234 5678
                </a>
                <a
                  href="tel:+918012345678"
                  className="inline-flex items-center gap-2.5 text-body-sm text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    call
                  </span>
                  +91 7416 368 516
                </a>
              </div>

              {/* Social Links */}
              <div className="flex items-center gap-3">
                {['public', 'chat', 'photo_camera', 'smart_display'].map((icon) => (
                  <a
                    key={icon}
                    className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary hover:bg-primary hover:text-on-primary transition-colors"
                    href="#"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {icon}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* Right: Map */}
            <div className="md:col-span-7 flex flex-col justify-between">
              <div className="w-full h-56 rounded-xl overflow-hidden bg-surface-container relative shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                <iframe
                  className="w-full h-full border-0 filter contrast-[1.02] opacity-90 hover:opacity-100 transition-opacity"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src="https://maps.google.com/maps?q=St.+Francis+de+Sales+High+School+Shanthinagar+Secunderabad&t=&z=15&ie=UTF8&iwloc=&output=embed"
                  title="SFS Shanthinagar Campus Location"
                ></iframe>
              </div>
              <div className="flex items-center gap-2 mt-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-jubilee-amber text-[18px]">
                  location_on
                </span>
                <span className="text-label-sm uppercase tracking-wider">
                  Campus Location • North Lalaguda, Secunderabad
                </span>
              </div>
            </div>
          </div>

          {/* Copyright bar */}
          <div className="pt-8 mt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-body-sm text-on-surface-variant text-center sm:text-left">
              Copyright © 2026 St. Francis de Sales' High School. All Rights Reserved.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-jubilee-amber"></span>
              <span className="text-label-sm uppercase tracking-widest text-primary font-bold">
                Celebrating 50 Years of Excellence (1976–2026)
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}