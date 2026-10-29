"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ACCESS_PREVIEW_PARAM,
  isPreviewActionPath,
  USER_ACCESS_PREVIEW_PARAM,
  withAccessPreview,
} from "@/lib/access/access-preview";
import type { AccessPreview } from "@/lib/workspace/workspace-types";

/** Marks a subtree that stays usable during a preview, such as its exit. */
export const PREVIEW_ALLOW_ATTRIBUTE = "data-preview-allow";

const allowSelector = `[${PREVIEW_ALLOW_ATTRIBUTE}]`;
const controlSelector = [
  "button",
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[draggable='true']",
  "[role='button']",
  "[role='checkbox']",
  "[role='combobox']",
  "[role='menuitem']",
  "[role='option']",
  "[role='switch']",
  "[role='tab']",
].join(",");
// Set only on the controls this guard disabled, so leaving the preview
// restores exactly what it changed and nothing a component set itself.
const disabledMarker = "data-preview-disabled";

function isPreviewHref(url: URL) {
  return (
    url.searchParams.has(ACCESS_PREVIEW_PARAM) ||
    url.searchParams.has(USER_ACCESS_PREVIEW_PARAM)
  );
}

/** A control inside a link card is still a control; a menu link is a link. */
function isControlInLink(element: Element | null) {
  const anchor = element?.closest("a[href]");
  const control = element?.closest(controlSelector);
  return Boolean(
    anchor && control && control !== anchor && anchor.contains(control),
  );
}

function elementOf(target: EventTarget | null) {
  return target instanceof Element ? target : null;
}

/**
 * Makes an access preview look exactly like its subject's workspace while
 * leaving nothing to act on. Navigation stays live — every internal link keeps
 * the preview — and every other click, key, input, drag, and submit is stopped
 * before any handler sees it. Listening on the document in the capture phase
 * covers portalled menus and dialogs, and runs ahead of React's own listeners.
 *
 * Components render the controls their subject would have; they do not need
 * to know a preview is running. RLS is still the boundary — this only keeps
 * the owner from acting through a view of someone else's access.
 */
export function useAccessPreviewGuard(preview: AccessPreview | undefined) {
  const router = useRouter();

  useEffect(() => {
    if (!preview) return;

    const allowed = (element: Element | null) =>
      !element || Boolean(element.closest(allowSelector));

    const onClick = (event: MouseEvent) => {
      const element = elementOf(event.target);
      if (allowed(element)) return;
      const anchor = element?.closest("a[href]");
      if (anchor instanceof HTMLAnchorElement && !isControlInLink(element)) {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (!isPreviewActionPath(url.pathname)) {
          if (isPreviewHref(url)) return;
          event.preventDefault();
          event.stopPropagation();
          router.push(
            withAccessPreview(`${url.pathname}${url.search}`, preview),
          );
          return;
        }
      }
      event.preventDefault();
      event.stopPropagation();
    };

    // Pointer and mouse presses open menus and start drags before a click.
    // They are only stopped, never prevented, so text stays selectable.
    const onPress = (event: Event) => {
      const element = elementOf(event.target);
      if (allowed(element) || element?.closest("a[href]")) return;
      event.stopPropagation();
    };

    const passThroughKeys = new Set(["Tab", "Escape", "Shift"]);
    const onKeyDown = (event: KeyboardEvent) => {
      const element = elementOf(event.target);
      if (allowed(element) || passThroughKeys.has(event.key)) return;
      // Nothing focused: keep the page scrollable from the keyboard.
      if (element === document.body || element === document.documentElement)
        return;
      if (element?.closest("a[href]") && !isControlInLink(element)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const block = (event: Event) => {
      if (allowed(elementOf(event.target))) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const markControls = () => {
      const actionLinks = [
        ...document.querySelectorAll<HTMLAnchorElement>("a[href]"),
      ].filter((anchor) => {
        const url = new URL(anchor.href, window.location.href);
        return (
          url.origin === window.location.origin &&
          isPreviewActionPath(url.pathname)
        );
      });
      [...document.querySelectorAll(controlSelector), ...actionLinks].forEach(
        (control) => {
          if (
            control.closest(allowSelector) ||
            control.getAttribute("aria-disabled") === "true"
          )
            return;
          control.setAttribute("aria-disabled", "true");
          control.setAttribute(disabledMarker, "");
        },
      );
    };
    markControls();
    const observer = new MutationObserver(markControls);
    observer.observe(document.body, { childList: true, subtree: true });

    const listeners: [string, EventListener][] = [
      ["click", onClick as EventListener],
      ["auxclick", block],
      ["dblclick", block],
      ["pointerdown", onPress],
      ["mousedown", onPress],
      ["touchstart", onPress],
      ["keydown", onKeyDown as EventListener],
      ["beforeinput", block],
      ["paste", block],
      ["cut", block],
      ["drop", block],
      ["dragstart", block],
      ["submit", block],
    ];
    listeners.forEach(([type, listener]) =>
      document.addEventListener(type, listener, true),
    );
    document.documentElement.setAttribute("data-access-preview", "");

    return () => {
      listeners.forEach(([type, listener]) =>
        document.removeEventListener(type, listener, true),
      );
      observer.disconnect();
      document.querySelectorAll(`[${disabledMarker}]`).forEach((control) => {
        control.removeAttribute("aria-disabled");
        control.removeAttribute(disabledMarker);
      });
      document.documentElement.removeAttribute("data-access-preview");
    };
  }, [preview, router]);
}
