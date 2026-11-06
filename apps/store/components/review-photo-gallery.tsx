"use client";

import Image from "next/image";
import { useState } from "react";
import { Modal } from "@ryanmeetup/ui";

export function ReviewPhotoGallery({ urls, reviewerName }: { urls: string[]; reviewerName: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <ul aria-label={`Photos from ${reviewerName}`} className="mt-4 flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <li key={url}>
            <button type="button" className="relative block size-20 overflow-hidden rounded-lg border border-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/50 dark:border-white/10 dark:focus-visible:outline-white/60" aria-label={`View photo ${index + 1} from ${reviewerName}`} onClick={() => setSelected(url)}>
              <Image src={url} alt={`Photo ${index + 1} from ${reviewerName}'s review`} fill sizes="80px" className="object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <Modal open={selected !== null} setIsOpen={(open) => { if (!open) setSelected(null); }} title={`Photo from ${reviewerName}`} size="lg" dismissOnOutsideClick>
        {selected && <div className="relative aspect-[4/3]"><Image src={selected} alt={`Merch photo from ${reviewerName}'s review`} fill sizes="(max-width: 639px) 90vw, 624px" className="object-contain" /></div>}
      </Modal>
    </>
  );
}
