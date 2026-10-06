import type { Metadata, Viewport } from "next";
import { Baloo_Bhaijaan_2, Lalezar } from "next/font/google";
import Link from "next/link";
import { headers } from "next/headers";
import Header from "@/components/Header";
import SiteChrome from "@/components/SiteChrome";
import NavFeedback from "@/components/NavFeedback";
import NativeAppBridge from "@/components/NativeAppBridge";
import { OWN_CHROME_HEADER } from "@config/site";
import { THEME_INIT_SCRIPT } from "@/components/ThemeSwitcher";
import "./globals.css";

const body = Baloo_Bhaijaan_2({ variable: "--font-baloo", subsets: ["arabic", "latin"], weight: ["500", "700", "800"] });
const display = Lalezar({ variable: "--font-lalezar", subsets: ["arabic", "latin"], weight: "400" });

export const metadata: Metadata = {
  title: "نهج علي | كتيب عادات طفلك بشخصيته الكرتونية",
  description: "ارفع صورة طفلك، ونحوّلها لشخصية كرتونية تتعلّم الصلاة والقرآن والعادات الطيبة في كتيب ملوّن باسمه، جاهز للطباعة.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1430" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // «الجواد الذكي!» | JAWAD AI has its own identity: none of the site's banner, header or footer is rendered there
  const ownChrome = Boolean((await headers()).get(OWN_CHROME_HEADER));
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={`${body.variable} ${display.variable} h-full antialiased`}>
      <head>
        {/* Apply the saved mood before first paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <NavFeedback />
        <NativeAppBridge />
        <SiteChrome
          top={
            ownChrome ? null : (
              <>
                <div role="status" className="bg-gold px-4 py-2 text-center text-sm font-extrabold text-on-gold">
                  🚧 الموقع تحت التجربة، وسيتم تطويره قريبًا إن شاء الله
                </div>
                <Header />
              </>
            )
          }
          bottom={
            ownChrome ? null : (
              <footer className="mx-auto flex w-full max-w-xl flex-col items-center gap-2 px-4 py-8 text-sm font-bold text-muted">
                <div className="flex gap-6">
                  <Link href="/privacy" className="hover:text-ink">سياسة الخصوصية</Link>
                  <Link href="/terms" className="hover:text-ink">الشروط والأحكام</Link>
                </div>
                <p>نهج علي © ٢٠٢٦</p>
              </footer>
            )
          }
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
