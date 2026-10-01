import type { Metadata } from "next";
import { PrivacyPolicyPage } from "@/components/privacy-policy-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Trace",
  description:
    "How Trace collects, uses, and protects household subscription data, including Gmail data.",
};

export default function Page() {
  return <PrivacyPolicyPage />;
}
