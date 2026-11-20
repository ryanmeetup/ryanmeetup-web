"use client";

import Image from "next/image";
import { useState } from "react";
import { Button, Modal, Text } from "@ryanmeetup/ui";

function GalleryPhoto({ url, alt, thumbnail = false }: { url: string; alt: string; thumbnail?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return failed ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2">
    <Text role="status" className="text-xs">Photo unavailable</Text>
    {thumbnail ? <span className="text-xs underline">Open photo</span> : <Button size="sm" variant="secondary" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Retry photo</Button>}
  </div> : <Image key={attempt} src={url} alt={alt} unoptimized fill sizes={thumbnail ? "80px" : "(max-width: 639px) 90vw, 624px"}
    className={thumbnail ? "object-cover" : "object-contain"} onError={() => setFailed(true)} />;
}

export function ReviewPhotoGallery({ urls, reviewerName }: { urls: string[]; reviewerName: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <ul aria-label={`Photos from ${reviewerName}`} className="mt-4 flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <li key={url}>
            <button type="button" className="relative block size-20 overflow-hidden rounded-lg border border-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/50 dark:border-white/10 dark:focus-visible:outline-white/60" aria-label={`View photo ${index + 1} from ${reviewerName}`} onClick={() => setSelected(url)}>
              <GalleryPhoto url={url} alt={`Photo ${index + 1} from ${reviewerName}'s review`} thumbnail />
            </button>
          </li>
        ))}
      </ul>
      <Modal open={selected !== null} setIsOpen={(open) => { if (!open) setSelected(null); }} title={`Photo from ${reviewerName}`} size="lg" dismissOnOutsideClick>
        {selected && <div className="relative aspect-[4/3]"><GalleryPhoto key={selected} url={selected} alt={`Merch photo from ${reviewerName}'s review`} /></div>}
      </Modal>
    </>
  );
}
