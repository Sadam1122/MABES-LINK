import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { FeedbackProvider } from "@/components/ui/feedback";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "MABES LINK", template: "%s · MABES LINK" },
  description: "Operasional KCP Mandiri Jakarta Mangga Besar 11539 B.2",
  icons: {
    icon: "/Gambar/logo.png",
    shortcut: "/Gambar/logo.png",
    apple: "/Gambar/logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FeedbackProvider>{children}</FeedbackProvider>
      </body>
    </html>
  );
}
