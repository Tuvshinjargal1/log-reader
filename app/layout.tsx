import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MainNav } from "@/components/MainNav";
import "./globals.css";

// UI бүхэлдээ кирилл тул cyrillic subset заавал хэрэгтэй — эс бөгөөс
// зөвхөн latin @font-face ирж, үсэг нь fallback (Segoe UI), тоо нь Geist-ээр
// рендер болж хоёр фонт холилдоно.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "SmartPOS Log Reader",
  description:
    "GS25 SmartPOS лог файлыг хөгжүүлэгч биш хүнд ойлгомжтойгоор харуулах хэрэгсэл",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="mn"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-100 font-sans">
        <MainNav />
        {children}
      </body>
    </html>
  );
}
