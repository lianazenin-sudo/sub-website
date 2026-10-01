import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";

export const metadata: Metadata = {
  title: "Trace — One home for all your subscriptions",
  description:
    "See every subscription, catch renewals before they hit, and keep the household on one plan.",
};

export default function Page() {
  return <HomePage />;
}
