// Components
import { BryanChecker } from "@/components/global";
import { ThemeProvider } from "next-themes";
import { ToastHost } from "@ryanmeetup/ui";

// Types
import { buildPageMetadata, SITE_URL } from "@/utils/metadata";

// Utilities
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = buildPageMetadata({
  title: "Ryan Meetup",
  description: "Wanna meet other Ryans? Join the Ryan Meetup!",
  canonical: SITE_URL,
  image: {
    url: "/group-photos/rockies.jpg",
    width: 3490,
    height: 2328,
    alt: "Ryan Meetup group photo",
  },
  keywords: [
    "ryan gathering",
    "ryan meetup",
    "ryan meet up",
    "ryan convention",
    "ryan event",
    "ryan society",
    "gathering of the ryans",
    "council of ryans",
    "ryan association",
    "ryan club",
    "ryan social club",
    "ryancon",
    "network of ryans",
    "ryan network",
    "ryan reunion",
    "ryan's game show",
    "last ryan standing",
    "ryan roundup",
    "ryan rendezvous",
    "st ryans day",
    "ryan rave",
    "rytoberfest",
    "ryan retreat",
    "ryan resort",
    "ryans near me",
    "ryan events near me",
    "ryan rose",
    "ryan le",
    "ryan cousins",
    "ryan vesler",
    "ryan reynolds",
    "ryan gosling",
    "ryan seacrest",
    "ryan stiles",
    "ryan hailey",
    "ryan cunningham",
    "ryans meeting up",
    "ryan party",
    "ryan meetup official",
    "ryan meetup community",
    "meet other ryans",
    "ryan meetup organization",
  ],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <BryanChecker />
          {children}
          <Analytics />
          <ToastHost />
        </ThemeProvider>
      </body>
    </html>
  );
}
