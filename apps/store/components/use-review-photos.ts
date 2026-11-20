"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REVIEW_PHOTOS_MAX } from "@ryanmeetup/reviews";
import type { BuyerReviewPhoto } from "@ryanmeetup/reviews";
import { checkReviewPhotoViewer, discardReviewPhoto, fetchReviewPhotoBlob, fetchReviewPhotoSelection, ReviewPhotoClientError, uploadReviewPhoto } from "@/lib/review-photo-client";
import type { ReviewPhotoEditorScope } from "@/lib/review-photo-client";

export type ReviewPhotoChoice = { key: string; file?: File; photo?: BuyerReviewPhoto; expiresAt?: string; url?: string; status: "waiting" | "working" | "ready" | "error"; error?: string };
type State = { scope: string; phase: "loading" | "ready" | "error" | "closed"; initialized: boolean; items: ReviewPhotoChoice[]; error: string };
const message = (error: unknown) => error instanceof ReviewPhotoClientError ? error.message : "That photo could not be confirmed. Try again before saving.";

/** One form owns its private files/URLs. Closing or hiding cancels work and revokes every preview. */
export function useReviewPhotos(scope: ReviewPhotoEditorScope | undefined, open: boolean) {
  const identity = scope ? `${scope.viewerKey}:${scope.productId}:${scope.review?.id ?? "new"}:${scope.review?.updatedAt ?? ""}` : "";
  const [state, setState] = useState<State>({ scope: identity, phase: "loading", initialized: false, items: [], error: "" });
  const [attempt, setAttempt] = useState(0);
  const current = useRef(state); current.current = state;
  const urls = useRef(new Set<string>());
  const active = useRef<AbortController | null>(null);
  const running = useRef(false);
  const revoke = useCallback(() => { for (const url of urls.current) URL.revokeObjectURL(url); urls.current.clear(); }, []);
  const close = useCallback((error: string) => {
    active.current?.abort(); revoke();
    setState((value) => ({ ...value, phase: "closed", initialized: false, items: [], error }));
  }, [revoke]);

  useEffect(() => {
    if (!scope || !open) return;
    const controller = new AbortController(); active.current = controller;
    let live = true;
    const update = (change: (value: State) => State) => { if (live && !controller.signal.aborted) setState(change); };
    async function initialize() {
      const previous = current.current;
      revoke();
      update((value) => ({ scope: identity, phase: "loading", initialized: value.scope === identity && value.initialized,
        items: value.scope === identity ? value.items.map((item) => ({ ...item, url: undefined, status: "waiting" })) : [], error: "" }));
      try {
        await checkReviewPhotoViewer(scope!, controller.signal);
        const items = previous.scope === identity && previous.initialized ? previous.items : scope!.review
          ? (await fetchReviewPhotoSelection(scope!, controller.signal)).map((photo) => ({ key: photo.id, photo, status: "waiting" as const })) : [];
        update(() => ({ scope: identity, phase: "ready", initialized: true, items: items.map((item) => ({ ...item, url: undefined, status: "waiting" })), error: "" }));
      } catch (error) {
        if (controller.signal.aborted || !live) return;
        if (error instanceof ReviewPhotoClientError && error.refreshRequired) close(error.message);
        else update((value) => ({ ...value, phase: "error", error: message(error) }));
      }
    }
    void initialize();
    const focus = () => {
      if (document.visibilityState !== "visible") return;
      void checkReviewPhotoViewer(scope, controller.signal).catch((error) => {
        if (!controller.signal.aborted) close(error instanceof ReviewPhotoClientError && error.refreshRequired ? error.message : "Your account could not be checked. Close this review and refresh.");
      });
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") { controller.abort(); revoke(); setState((value) => ({ ...value, phase: "loading", items: value.items.map((item) => ({ ...item, url: undefined, status: "waiting" })) })); }
      else { focus(); setAttempt((value) => value + 1); }
    };
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", focus);
    return () => { live = false; controller.abort(); if (active.current === controller) active.current = null; revoke(); window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pageshow", focus); };
    // Scope values are identified by the stable primitives above; parent objects are recreated while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, open, attempt, close, revoke]);

  useEffect(() => {
    if (!scope || !open || state.scope !== identity || state.phase !== "ready" || running.current || active.current?.signal.aborted) return;
    const item = state.items.find((entry) => entry.status === "waiting");
    if (!item) return;
    const controller = active.current!; running.current = true;
    setState((value) => ({ ...value, items: value.items.map((entry) => entry.key === item.key ? { ...entry, status: "working", error: undefined } : entry) }));
    const valid = () => !controller.signal.aborted && active.current === controller && current.current.scope === identity;
    void (async () => {
      try {
        let photo = item.photo;
        let expiresAt = item.expiresAt;
        if (!photo || (expiresAt && Date.parse(expiresAt) <= Date.now())) {
          if (!item.file) throw new ReviewPhotoClientError("This photo is unavailable. Remove it or refresh before saving.");
          const uploaded = await uploadReviewPhoto(scope, item.file, item.key, controller.signal);
          photo = { id: uploaded.id, width: uploaded.width, height: uploaded.height }; expiresAt = uploaded.expiresAt;
          if (valid()) setState((value) => ({ ...value, items: value.items.map((entry) => entry.key === item.key ? { ...entry, photo, expiresAt } : entry) }));
        }
        const blob = await fetchReviewPhotoBlob(scope, photo.id, controller.signal);
        if (!valid() || !current.current.items.some((entry) => entry.key === item.key)) return;
        const url = URL.createObjectURL(blob); urls.current.add(url);
        setState((value) => ({ ...value, items: value.items.map((entry) => entry.key === item.key ? { ...entry, photo, expiresAt, url, status: "ready" } : entry) }));
      } catch (error) {
        if (!valid()) return;
        if (error instanceof ReviewPhotoClientError && error.refreshRequired) close(error.message);
        else setState((value) => ({ ...value, items: value.items.map((entry) => entry.key === item.key ? { ...entry, status: "error", error: message(error) } : entry) }));
      } finally { running.current = false; if (active.current && !active.current.signal.aborted) setState((value) => ({ ...value })); }
    })();
  }, [state, scope, open, identity, close]);

  function choose(files: File[]) {
    if (!scope || state.scope !== identity || state.phase !== "ready") return;
    setState((value) => {
      const existing = value.items.filter((item) => item.file);
      const incoming = files.filter((file) => !existing.some((item) => item.file === file));
      if (value.items.length + incoming.length > REVIEW_PHOTOS_MAX) return value;
      return { ...value, items: [...value.items, ...incoming.map((file) => ({ key: crypto.randomUUID(), file, status: "waiting" as const }))] };
    });
  }
  async function remove(key: string) {
    const item = state.items.find((entry) => entry.key === key);
    if (!scope || !item || item.status === "working") return;
    const controller = active.current;
    if (!controller || controller.signal.aborted) return;
    setState((value) => ({ ...value, items: value.items.map((entry) => entry.key === key ? { ...entry, status: "working" } : entry) }));
    try {
      if (item.file && item.photo) await discardReviewPhoto(scope, item.photo.id, controller.signal);
      if (controller.signal.aborted || active.current !== controller) return;
      if (item.url) { URL.revokeObjectURL(item.url); urls.current.delete(item.url); }
      setState((value) => ({ ...value, items: value.items.filter((entry) => entry.key !== key) }));
    } catch (error) {
      if (controller.signal.aborted || active.current !== controller) return;
      if (error instanceof ReviewPhotoClientError && error.refreshRequired) close(error.message);
      else setState((value) => ({ ...value, items: value.items.map((entry) => entry.key === key ? { ...entry, status: "error", error: message(error) } : entry) }));
    }
  }
  function retry(key: string) {
    const previous = state.items.find((item) => item.key === key)?.url;
    if (previous) { URL.revokeObjectURL(previous); urls.current.delete(previous); }
    setState((value) => ({ ...value, items: value.items.map((item) => item.key === key
      ? { ...item, key: item.expiresAt && Date.parse(item.expiresAt) <= Date.now() ? crypto.randomUUID() : item.key, url: undefined, status: "waiting", error: undefined } : item) }));
  }
  const visible = state.scope === identity && Boolean(scope) && open;
  const ready = visible && state.phase === "ready" && state.items.every((item) => item.status === "ready" && Boolean(item.url));
  async function prepare() {
    if (!scope || !ready) return false;
    if (state.items.some((item) => item.expiresAt && Date.parse(item.expiresAt) <= Date.now())) {
      setState((value) => ({ ...value, items: value.items.map((item) => item.expiresAt && Date.parse(item.expiresAt) <= Date.now()
        ? { ...item, status: "error", error: "This upload expired. Retry the photo or remove it before saving." } : item) }));
      return false;
    }
    try { await checkReviewPhotoViewer(scope, active.current!.signal); return !active.current?.signal.aborted; }
    catch (error) { close(error instanceof ReviewPhotoClientError && error.refreshRequired ? error.message : "Your account could not be checked. Close this review and refresh."); return false; }
  }
  return { items: visible ? state.items : [], phase: visible ? state.phase : "loading", error: visible ? state.error : "", ready,
    choose, remove, retry, reload: () => setAttempt((value) => value + 1), prepare, invalidate: close, complete: () => close(""),
    photoIds: state.items.flatMap((item) => item.photo?.id ?? []) };
}
