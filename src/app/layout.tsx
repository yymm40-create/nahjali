import type { Metadata, Viewport } from "next";
import { Baloo_Bhaijaan_2, Lalezar } from "next/font/google";
import Link from "next/link";
import Header from "@/components/Header";
import "./globals.css";

const body = Baloo_Bhaijaan_2({ variable: "--font-baloo", subsets: ["arabic", "latin"], weight: ["500", "700", "800"] });
const display = Lalezar({ variable: "--font-lalezar", subsets: ["arabic", "latin"], weight: "400" });

export const metadata: Metadata = {
  title: "عاداتي الخارقة | كتيب عادات بشخصيتك الكرتونية",
  description: "ارفع صورتك، نحوّلها لشخصية كرتونية ثلاثية الأبعاد، ونطلع لك كتيب عادات يومية جاهز للطباعة.",
};

export const viewport: Viewport = { themeColor: "#7b5cff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-4">{children}</main>
        <footer className="mx-auto flex w-full max-w-xl justify-center gap-6 px-4 py-6 text-sm font-bold">
          <Link href="/privacy" className="underline">سياسة الخصوصية</Link>
          <Link href="/terms" className="underline">الشروط والأحكام</Link>
        </footer>
      </body>
    </html>
  );
}
