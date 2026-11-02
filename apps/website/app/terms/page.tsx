import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy-page";
import { termsIntro, termsSections, termsUpdated } from "@/lib/terms-of-service";

export const metadata: Metadata = {
  title: "Terms of Service | Trace",
  description: "The terms for using Trace, the subscription and recurring-payment manager.",
};

export default function Page() {
  return (
    <PolicyPage
      title="Terms of Service"
      updated={termsUpdated}
      intro={termsIntro}
      sections={termsSections}
    />
  );
}
