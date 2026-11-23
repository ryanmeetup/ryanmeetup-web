"use client";

import NextImage from "next/image";
import { useEffect, useState } from "react";
import { Transition } from "@headlessui/react";
import { IconButton } from "./IconButton";
import { Pill } from "./Pill";
import {
  FaChevronLeft as ChevronLeft,
  FaChevronRight as ChevronRight,
} from "react-icons/fa6";

type GalleryPhoto = {
  src: string;
  alt: string;
  /** CSS object-position for the photo's focal point, e.g. "50% 40%". */
  objectPosition?: string;
};

type GalleryItem = {
  src: string;
  alt: string;
  title?: string;
  /** Shorter badge copy for screens below the sm breakpoint. */
  mobileTitle?: string;
  city?: string;
  /** CSS object-position for the photo's focal point, e.g. "50% 40%". */
  objectPosition?: string;
  /**
   * "contain" shows the whole photo over a blurred copy of itself, for shots
   * whose orientation fights the frame (portraits in a landscape gallery).
   */
  fit?: "cover" | "contain";
  /**
   * A second photo shown beside this one. Two portraits side by side fill a
   * landscape frame with little cropping; `fit` is ignored for a pair.
   */
  pairedWith?: GalleryPhoto;
};

type RotatingGalleryProps = {
  items: GalleryItem[];
  intervalMs?: number;
  /** Rendered width of the gallery, for picking a source from the srcset. */
  sizes?: string;
  /**
   * Frame sizing classes. Replaces the default event-gallery heights, so pass
   * a height or aspect ratio for every breakpoint you need.
   */
  className?: string;
  /** Preload the first photo when the gallery is the page's largest image. */
  preload?: boolean;
};

const DEFAULT_FRAME_SIZE = "h-60 sm:h-80 lg:h-[360px] 2xl:h-[400px]";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const RotatingGallery = (props: RotatingGalleryProps) => {
  const {
    items,
    intervalMs = 6000,
    sizes = "100vw",
    className = DEFAULT_FRAME_SIZE,
    preload = false,
  } = props;
  const [activeSlide, setActiveSlide] = useState(0);
  // Autoplay stops while the visitor is looking at or operating the gallery.
  const [paused, setPaused] = useState(false);

  const animationVariants = {
    flip: {
      enter: "transition duration-700 ease-out",
      enterFrom: "opacity-0 [transform:rotateY(-90deg)]",
      enterTo: "opacity-100 [transform:rotateY(0deg)]",
      leave: "transition duration-700 ease-in",
      leaveFrom: "opacity-100 [transform:rotateY(0deg)]",
      leaveTo: "opacity-0 [transform:rotateY(90deg)]",
    },
    slide: {
      enter: "transition duration-700 ease-out",
      enterFrom: "opacity-0 translate-x-10",
      enterTo: "opacity-100 translate-x-0",
      leave: "transition duration-700 ease-in",
      leaveFrom: "opacity-100 translate-x-0",
      leaveTo: "opacity-0 -translate-x-10",
    },
    zoom: {
      enter: "transition duration-700 ease-out",
      enterFrom: "opacity-0 scale-95",
      enterTo: "opacity-100 scale-100",
      leave: "transition duration-700 ease-in",
      leaveFrom: "opacity-100 scale-100",
      leaveTo: "opacity-0 scale-105",
    },
  };

  const animationStyle = animationVariants.slide;

  useEffect(() => {
    setActiveSlide(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1 || paused || prefersReducedMotion()) {
      return undefined;
    }

    const interval = setInterval(() => {
      setActiveSlide((current) => (current + 1) % items.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, items.length, paused]);

  if (items.length === 0) {
    return null;
  }

  const prevIndex = (activeSlide - 1 + items.length) % items.length;
  const nextIndex = (activeSlide + 1) % items.length;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-black/10 shadow-2xl dark:border-white/10 [perspective:1200px] ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className="pointer-events-none absolute inset-y-6 left-2 z-0 w-16 -translate-x-1 overflow-hidden rounded-2xl border border-white/20 bg-black/10 opacity-60 shadow-lg sm:inset-y-8 sm:left-3 sm:w-20 sm:-translate-x-2">
        <NextImage
          className="h-full w-full object-cover"
          src={items[prevIndex].src}
          fill
          sizes="80px"
          loading="eager"
          alt={items[prevIndex].alt}
        />
      </div>
      <div className="pointer-events-none absolute inset-y-6 right-2 z-0 w-16 translate-x-1 overflow-hidden rounded-2xl border border-white/20 bg-black/10 opacity-60 shadow-lg sm:inset-y-8 sm:right-3 sm:w-20 sm:translate-x-2">
        <NextImage
          className="h-full w-full object-cover"
          src={items[nextIndex].src}
          fill
          sizes="80px"
          loading="eager"
          alt={items[nextIndex].alt}
        />
      </div>
      {items.map((slide, index) => (
        <Transition
          key={slide.src}
          appear={true}
          show={activeSlide === index}
          enter={`${animationStyle.enter} motion-reduce:transition-none`}
          enterFrom={animationStyle.enterFrom}
          enterTo={animationStyle.enterTo}
          leave={`${animationStyle.leave} motion-reduce:transition-none`}
          leaveFrom={animationStyle.leaveFrom}
          leaveTo={animationStyle.leaveTo}
        >
          <div className="absolute inset-0 z-10 [transform-style:preserve-3d] [backface-visibility:hidden]">
            {slide.pairedWith ? (
              // The base colour shows through the gap as a thin divider.
              <div className="absolute inset-0 grid grid-cols-2 gap-1 bg-neutral-900">
                {[slide, slide.pairedWith].map((photo, photoIndex) => (
                  <div key={photo.src} className="relative">
                    <NextImage
                      src={photo.src}
                      fill
                      // A half-width cell still needs the full height, so the
                      // gallery's sizes is a fair upper bound for each photo.
                      sizes={sizes}
                      loading={index === 0 && !preload ? "eager" : undefined}
                      preload={index === 0 && preload && photoIndex === 0}
                      alt={photo.alt}
                      style={{
                        objectFit: "cover",
                        objectPosition: photo.objectPosition,
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {slide.fit === "contain" && (
                  // Blur fades to transparent at its edges; the opaque base keeps
                  // the peek thumbnails behind the slide from showing through.
                  <div className="absolute inset-0 overflow-hidden bg-neutral-900" aria-hidden="true">
                    <NextImage
                      className="scale-125 object-cover blur-2xl brightness-75"
                      src={slide.src}
                      fill
                      sizes="128px"
                      alt=""
                    />
                  </div>
                )}
                <NextImage
                  className="rounded-3xl"
                  src={slide.src}
                  fill
                  sizes={sizes}
                  loading={index === 0 && !preload ? "eager" : undefined}
                  preload={index === 0 && preload}
                  alt={slide.alt}
                  style={{
                    objectFit: slide.fit ?? "cover",
                    objectPosition: slide.objectPosition,
                  }}
                />
              </>
            )}
            {/* The scrim keeps caption pills legible; uncaptioned photos stay untinted. */}
            {(slide.title || slide.city) && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            )}
          </div>
        </Transition>
      ))}
      {(items[activeSlide]?.title || items[activeSlide]?.city) && (
        <div className="pointer-events-none absolute right-4 top-4 z-20 flex flex-col items-end gap-2">
          {items[activeSlide]?.title && (
            <Pill
              variant="overlay"
              size="sm"
              className="max-sm:whitespace-nowrap max-sm:text-[9px] max-sm:tracking-caps-tight sm:text-[10px]"
            >
              <span className="sm:hidden">
                {items[activeSlide].mobileTitle ?? items[activeSlide].title}
              </span>
              <span className="hidden sm:inline">{items[activeSlide].title}</span>
            </Pill>
          )}
          {items[activeSlide]?.city && (
            <Pill
              variant="overlay"
              size="sm"
              className="max-sm:whitespace-nowrap max-sm:text-[9px] max-sm:tracking-caps-tight sm:text-[10px]"
            >
              📍 {items[activeSlide].city}
            </Pill>
          )}
        </div>
      )}
      <div className="absolute left-3 top-1/2 z-30 -translate-y-1/2">
        <IconButton
          onClick={() =>
            setActiveSlide(
              (current) => (current - 1 + items.length) % items.length,
            )
          }
          label="Show previous photo"
          size="md"
          variant="overlay"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>
      <div className="absolute right-3 top-1/2 z-30 -translate-y-1/2">
        <IconButton
          onClick={() =>
            setActiveSlide((current) => (current + 1) % items.length)
          }
          label="Show next photo"
          size="md"
          variant="overlay"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center gap-1 rounded-full border border-white/20 bg-black/50 px-2.5 py-1.5 backdrop-blur sm:gap-2 sm:px-3 sm:py-2">
        {items.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => setActiveSlide(index)}
            aria-label={`Show slide ${index + 1}`}
            aria-current={activeSlide === index}
            className="group flex h-3 w-3 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full transition sm:h-2 sm:w-2 ${
                activeSlide === index
                  ? "bg-white"
                  : "bg-white/40 group-hover:bg-white/70"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export { RotatingGallery };
export type {
  GalleryItem as RotatingGalleryItem,
  GalleryPhoto as RotatingGalleryPhoto,
  RotatingGalleryProps,
};
