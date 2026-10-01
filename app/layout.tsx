import type { Metadata } from "next";
import { Mogra, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const mogra = Mogra({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-mogra",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trace",
  description: "One home for all your subscriptions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${mogra.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
