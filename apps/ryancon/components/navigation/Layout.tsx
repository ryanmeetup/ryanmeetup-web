"use client";

// Components
import { Header } from "@/components/navigation";
import { SiteFooter } from "@ryanmeetup/ui";
import { layoutPaddingX, socials } from "@/lib/constants";

// Types
import type { ReactNode } from "react";

type LayoutProps = {
  className?: string;
  headerClassName?: string;
  children: ReactNode;
  fullscreen?: boolean;
};

const Layout = (props: LayoutProps) => {
  const { className, headerClassName, children, fullscreen = false } = props;

  return (
    <main>
      <Header className={headerClassName} />
      <section
        className={`${className}
                    text-white h-full flex flex-col dark:bg-black dark:text-white
                    ${"bg-white from-white bg-gradient-to-b from-neutral-00 to-neutral-200 to-neutral-00 dark:from-neutral-900 dark:to-black"}
                    ${fullscreen ? "bg-black" : `py-8 ${layoutPaddingX}`}`}
      >
        {children}
      </section>
      <SiteFooter
        title="RYAN MEETUP"
        subtitle="NO BRYANS ALLOWED"
        className={layoutPaddingX}
        sections={[
          {
            title: "Follow us",
            links: socials.map((social) => ({
              href: social.href,
              label: social.text,
            })),
          },
          {
            title: "Built with",
            columns: 2,
            links: [
              { href: "https://vercel.com", label: "Vercel" },
              { href: "https://nextjs.org/", label: "Next.js" },
              { href: "https://react.dev/", label: "React" },
              { href: "https://tailwindcss.com/", label: "Tailwind CSS" },
              { href: "https://headlessui.com/", label: "Headless UI" },
              { href: "https://www.contentful.com/", label: "Contentful" },
              { href: "https://www.mapbox.com/", label: "Mapbox" },
            ],
          },
        ]}
        socialLinks={socials.map((social) => ({
          href: social.href,
          icon: social.icon,
          label: social.text,
        }))}
        credit={{ href: "https://ryanle.dev/", label: "Ryan Le" }}
      />
    </main>
  );
};

export { Layout };
