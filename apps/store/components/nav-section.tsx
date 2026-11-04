"use client";

import { createContext, useContext, useEffect, useState } from "react";

type NavSectionContextValue = {
  section: string | null;
  setSection: (href: string | null) => void;
};

const NavSectionContext = createContext<NavSectionContextValue | null>(null);

/** Lets a page whose path isn't a nav link, like a product, mark which link it belongs under. */
export function NavSectionProvider({ children }: { children: React.ReactNode }) {
  const [section, setSection] = useState<string | null>(null);
  return <NavSectionContext.Provider value={{ section, setSection }}>{children}</NavSectionContext.Provider>;
}

/** The nav href the current page has claimed, if any. */
export function useNavSection() {
  return useContext(NavSectionContext)?.section ?? null;
}

/** Rendered by a page to highlight `href` in the header until it unmounts. */
export function NavSection({ href }: { href: string | null }) {
  const setSection = useContext(NavSectionContext)?.setSection;
  useEffect(() => {
    setSection?.(href);
    return () => setSection?.(null);
  }, [href, setSection]);
  return null;
}
