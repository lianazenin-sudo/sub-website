"use client";

import { SmoothScroll } from "@/components/smooth-scroll";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { FeatureSection } from "@/components/feature-section";
import { PricingSection } from "@/components/pricing-section";
import { FaqSection } from "@/components/faq-section";
import { PayingSection } from "@/components/paying-section";
import { CtaSection } from "@/components/cta-section";
import { Footer } from "@/components/footer";

export function HomePage() {
  return (
    <SmoothScroll>
      <div id="top" className="min-h-dvh bg-ink text-white selection:bg-lilac selection:text-ink">
        <Navbar />
        <main className="flex flex-col gap-14 md:gap-20">
          <Hero />
          <FeatureSection />
          <PayingSection />
          <PricingSection />
          <FaqSection />
          <CtaSection />
        </main>
        <Footer />
      </div>
    </SmoothScroll>
  );
}
