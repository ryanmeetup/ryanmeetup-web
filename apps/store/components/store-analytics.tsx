"use client";

import { Analytics } from "@vercel/analytics/next";
import type { BeforeSend } from "@vercel/analytics";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackStoreEvent } from "@/lib/analytics";
import { analyticsPath, analyticsPlacements, analyticsUrl, getAnalyticsPlacement, storeLinkEvent } from "@/lib/analytics-events";

const beforeSend: BeforeSend = (event) => {
  const url = analyticsUrl(event.url);
  return url ? { ...event, url } : null;
};

/** Route-scoped, bounded measurements; no form values, click text, or session recordings. */
export function StoreAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element) || event.button > 1) return;
      if (event.target.closest("[data-analytics-ignore]")) return;
      const target = event.target.closest<HTMLAnchorElement>("a[href]");
      const placementElement = event.target.closest<HTMLElement>("[data-analytics-placement]");
      const placement = getAnalyticsPlacement(placementElement?.dataset.analyticsPlacement
        ?? (event.target.closest("header") ? "header" : event.target.closest("footer") ? "footer" : undefined));
      if (target) {
        const link = storeLinkEvent(target.href, window.location.href, placement, target.dataset.analyticsProduct);
        if (link) trackStoreEvent(link.name, link.properties);
      }
      const disclosure = event.target.closest<HTMLButtonElement>("button[aria-expanded]");
      const section = disclosure?.closest<HTMLElement>("[data-analytics-disclosure]")?.dataset.analyticsDisclosure;
      if (section && analyticsPlacements.some((value) => value === section)) {
        trackStoreEvent("disclosure_toggled", { section, expanded: disclosure?.getAttribute("aria-expanded") !== "true" });
      }
    }
    // Capture also covers portalled menus and links that close their drawer on click.
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);

  useEffect(() => {
    const viewed = new Set<string>();
    const observed = new Set<Element>();
    const visible = new Set<Element>();
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const depths = new Set<number>();
    let frame = 0;

    function cancel(element: Element) {
      clearTimeout(timers.get(element));
      timers.delete(element);
    }
    function schedule(element: Element) {
      const section = (element as HTMLElement).dataset.analyticsSection;
      const product = (element as HTMLElement).dataset.analyticsProduct;
      const placement = getAnalyticsPlacement(element.closest<HTMLElement>("[data-analytics-placement]")?.dataset.analyticsPlacement);
      if (!product && (!section || !analyticsPlacements.some((value) => value === section))) return;
      const key = product ? `product:${product}:${placement}` : `section:${section}`;
      if (viewed.has(key) || timers.has(element) || document.hidden) return;
      timers.set(element, setTimeout(() => {
        timers.delete(element);
        if (document.hidden || !element.isConnected || !visible.has(element) || viewed.has(key)) return;
        viewed.add(key);
        if (product) trackStoreEvent("product_card_viewed", { product, placement });
        else if (section) trackStoreEvent("section_viewed", { section, viewport: window.innerWidth < 640 ? "narrow" : window.innerWidth < 1280 ? "medium" : "wide" });
      }, 1000));
    }
    // A section qualifies when any part is visible for a second. Product cards
    // need half their area visible; tall grids can still qualify on phones.
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const product = (entry.target as HTMLElement).dataset.analyticsProduct;
        if (entry.isIntersecting && (!product || entry.intersectionRatio >= 0.5)) { visible.add(entry.target); schedule(entry.target); }
        else { visible.delete(entry.target); cancel(entry.target); }
      }
    }, { threshold: [0, 0.5] });
    function observeSections() {
      document.querySelectorAll<HTMLElement>("[data-analytics-section], [data-analytics-product]").forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        observer?.observe(element);
      });
    }
    observeSections();
    // Includes streamed homepage reviews and related listings after hydration.
    const mutations = new MutationObserver(observeSections);
    mutations.observe(document.body, { childList: true, subtree: true });
    function visibilityChanged() {
      if (document.hidden) for (const element of timers.keys()) cancel(element);
      else for (const element of visible) schedule(element);
    }
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (document.hidden || window.scrollY <= 0) return;
        const height = document.documentElement.scrollHeight;
        const depth = Math.min(100, Math.round((window.scrollY + window.innerHeight) / height * 100));
        for (const threshold of [25, 50, 75, 100]) {
          if (depth >= threshold && !depths.has(threshold)) {
            depths.add(threshold);
            trackStoreEvent("page_scrolled", { depth: threshold, page: analyticsPath(pathname) });
          }
        }
      });
    }
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      for (const element of timers.keys()) cancel(element);
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  return <Analytics beforeSend={beforeSend} />;
}
