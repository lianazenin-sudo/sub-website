import type { Metadata } from "next";
import { ContactPage } from "@/components/contact-page";

export const metadata: Metadata = {
  title: "Contact Us — Trace",
  description: "Search Trace help topics, or send us a message.",
};

export default function Page() {
  return <ContactPage />;
}
