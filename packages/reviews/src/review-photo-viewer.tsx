"use client";

import Image from "next/image";
import { useState } from "react";
import { Button, Modal, Text } from "@ryanmeetup/ui";

export type ReviewPhotoProps = { url: string; alt: string; thumbnail?: boolean };

export function ReviewPhoto({ url, alt, thumbnail = false }: ReviewPhotoProps) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return failed ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2">
    <Text role="status" className="text-xs">Photo unavailable</Text>
    {thumbnail ? <span className="text-xs underline">Open photo</span> : <Button size="sm" variant="secondary" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Retry photo</Button>}
  </div> : <Image key={attempt} src={url} alt={alt} unoptimized fill sizes={thumbnail ? "80px" : "(max-width: 639px) 90vw, 624px"}
    className={thumbnail ? "object-cover" : "object-contain"} onError={() => setFailed(true)} />;
}

export type ReviewPhotoViewerProps = { url: string | null; title: string; alt: string; onClose: () => void };

/** Header, body padding, and the overlay gutter the photo must leave room for. */
const photoMaxHeight = "max-h-[min(32rem,calc(100dvh-11rem))] sm:max-h-[calc(100dvh-11rem)]";

/** The full photo at its own aspect ratio; the dialog shrinks to fit around it. */
function FittedReviewPhoto({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) return <div className="flex aspect-[4/3] w-[min(36rem,calc(100vw-5rem))] flex-col items-center justify-center gap-2">
    <Text role="status" className="text-xs">Photo unavailable</Text>
    <Button size="sm" variant="secondary" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Retry photo</Button>
  </div>;
  // Intrinsic size is unknown until the photo loads, so width/height stay 0 and
  // CSS sizes it from the decoded image, bounded by the viewport.
  return <Image key={attempt} src={url} alt={alt} unoptimized width={0} height={0} sizes="(max-width: 639px) 90vw, 1200px"
    className={`block h-auto w-auto max-w-[calc(100vw-5rem)] rounded-lg ${photoMaxHeight}`} onError={() => setFailed(true)} />;
}

export function ReviewPhotoViewer({ url, title, alt, onClose }: ReviewPhotoViewerProps) {
  return <Modal open={url !== null} setIsOpen={(open) => { if (!open) onClose(); }} title={title} size="fit" dismissOnOutsideClick>
    {url && <FittedReviewPhoto key={url} url={url} alt={alt} />}
  </Modal>;
}
