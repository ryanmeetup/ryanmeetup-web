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

type GalleryItem = {
  src: string;
  alt: string;
  title?: string;
  city?: string;
};

type RotatingGalleryProps = {
  items: GalleryItem[];
  intervalMs?: number;
  /** Rendered width of the gallery, for picking a source from the srcset. */
  sizes?: string;
};

const RotatingGallery = (props: RotatingGalleryProps) => {
  const { items, intervalMs = 6000, sizes = "100vw" } = props;
  const [activeSlide, setActiveSlide] = useState(0);

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
    if (items.length <= 1) {
      return undefined;
    }

    const interval = setInterval(() => {
      setActiveSlide((current) => (current + 1) % items.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, items.length]);

  if (items.length === 0) {
    return null;
  }

  const prevIndex = (activeSlide - 1 + items.length) % items.length;
  const nextIndex = (activeSlide + 1) % items.length;

  return (
    <div className="relative h-60 overflow-hidden rounded-3xl border border-black/10 shadow-2xl sm:h-80 lg:h-[360px] 2xl:h-[400px] dark:border-white/10 [perspective:1200px]">
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
          enter={animationStyle.enter}
          enterFrom={animationStyle.enterFrom}
          enterTo={animationStyle.enterTo}
          leave={animationStyle.leave}
          leaveFrom={animationStyle.leaveFrom}
          leaveTo={animationStyle.leaveTo}
        >
          <div className="absolute inset-0 z-10 [transform-style:preserve-3d] [backface-visibility:hidden]">
            <NextImage
              className="rounded-3xl"
              src={slide.src}
              fill
              sizes={sizes}
              loading={index === 0 ? "eager" : undefined}
              alt={slide.alt}
              style={{ objectFit: "cover" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          </div>
        </Transition>
      ))}
      {(items[activeSlide]?.title || items[activeSlide]?.city) && (
        <div className="pointer-events-none absolute right-4 top-4 z-20 flex flex-col items-end gap-2">
          {items[activeSlide]?.title && (
            <Pill
              variant="overlay"
              size="sm"
              className="text-[9px] sm:text-[10px]"
            >
              {items[activeSlide].title}
            </Pill>
          )}
          {items[activeSlide]?.city && (
            <Pill
              variant="overlay"
              size="sm"
              className="text-[9px] sm:text-[10px]"
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
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center gap-2 rounded-full border border-white/20 bg-black/50 px-3 py-2 backdrop-blur">
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
              className={`h-2 w-2 rounded-full transition ${
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
