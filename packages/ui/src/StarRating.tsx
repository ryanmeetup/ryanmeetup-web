"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { FiCheck, FiStar } from "react-icons/fi";
import { getFieldLabelClasses } from "./fieldStyles";

const stars = [1, 2, 3, 4, 5];
const confettiColors = ["#fbbf24", "#f59e0b", "#fde68a", "#ee1a25"];
const sparklePath = "polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)";
const centered = "translate(-50%, -50%)";

type Effect = {
  count: number;
  piece: (index: number) => { className: string; style?: CSSProperties };
  animate: (index: number, count: number) => [Keyframe[], KeyframeAnimationOptions];
};

/** One reaction per whole-star rating, building from a drizzle to confetti. */
const effects: Record<number, Effect> = {
  1: {
    count: 3,
    piece: () => ({ className: "h-2 w-0.5 rounded-full bg-slate-400 dark:bg-slate-500" }),
    animate: (index) => {
      const x = (index - 1) * 8;
      return [
        [
          { transform: `${centered} translate(${x}px, 6px)`, opacity: 0 },
          { transform: `${centered} translate(${x}px, 14px)`, opacity: 1, offset: 0.3 },
          { transform: `${centered} translate(${x}px, 30px)`, opacity: 0 },
        ],
        { duration: 700, delay: index * 120, easing: "ease-in", fill: "forwards" },
      ];
    },
  },
  2: {
    count: 5,
    piece: () => ({ className: "size-2 rounded-full bg-black/25 dark:bg-white/30" }),
    animate: (index, count) => {
      const x = (index - (count - 1) / 2) * 9;
      return [
        [
          { transform: `${centered} translate(${x * 0.3}px, 12px) scale(0.5)`, opacity: 0.9 },
          { transform: `${centered} translate(${x * 2}px, ${4 - Math.random() * 6}px) scale(1.4)`, opacity: 0 },
        ],
        { duration: 750, easing: "ease-out", fill: "forwards" },
      ];
    },
  },
  3: {
    count: 2,
    piece: () => ({ className: "size-8 rounded-full border-2 border-amber-400" }),
    animate: (index) => [
      [
        { transform: `${centered} scale(0.7)`, opacity: 0.8 },
        { transform: `${centered} scale(1.7)`, opacity: 0 },
      ],
      { duration: 650, delay: index * 150, easing: "ease-out", fill: "forwards" },
    ],
  },
  4: {
    count: 4,
    piece: (index) => ({ className: `${index % 2 ? "size-2" : "size-3"} bg-amber-400`, style: { clipPath: sparklePath } }),
    animate: (index) => {
      const angle = Math.PI / 4 + (index * Math.PI) / 2;
      const x = Math.cos(angle) * 22;
      const y = Math.sin(angle) * 22;
      const at = `${centered} translate(${x}px, ${y}px)`;
      return [
        [
          { transform: `${at} scale(0) rotate(0deg)`, opacity: 1 },
          { transform: `${at} scale(1.2) rotate(45deg)`, opacity: 1, offset: 0.45 },
          { transform: `${at} scale(0) rotate(90deg)`, opacity: 0 },
        ],
        { duration: 700, delay: index * 70, easing: "ease-in-out", fill: "forwards" },
      ];
    },
  },
  5: {
    count: 12,
    piece: (index) => ({
      className: index % 3 ? "h-1.5 w-1 rounded-[1px]" : "size-1.5 rounded-full",
      style: { backgroundColor: confettiColors[index % confettiColors.length] },
    }),
    animate: (index, count) => {
      const angle = (index / count) * Math.PI * 2 + Math.random() * 0.4;
      const distance = 26 + Math.random() * 14;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      return [
        [
          { transform: `${centered} rotate(0deg)`, opacity: 1 },
          { transform: `${centered} translate(${x}px, ${y + 10}px) rotate(${Math.random() * 360}deg)`, opacity: 0 },
        ],
        { duration: 650 + Math.random() * 200, easing: "cubic-bezier(0.2, 0.7, 0.4, 1)", fill: "forwards" },
      ];
    },
  },
};

/** A one-shot reaction from the chosen star; skipped under reduced motion. */
function RatingBurst({ rating }: { rating: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const effect = effects[rating] ?? effects[5];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pieces = Array.from(ref.current?.children ?? []) as HTMLElement[];
    const animations = pieces.map((piece, index) => piece.animate(...effect.animate(index, pieces.length)));
    return () => animations.forEach((animation) => animation.cancel());
  }, [effect]);

  return (
    <span ref={ref} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: effect.count }, (_, index) => {
        const { className, style } = effect.piece(index);
        return <span key={index} className={`absolute left-1/2 top-1/2 opacity-0 ${className}`} style={style} />;
      })}
    </span>
  );
}

function RatingStar({ fill }: { fill: number }) {
  return (
    <span className="relative block size-full" aria-hidden="true">
      <FiStar className="size-full text-black/30 dark:text-white/30" />
      <FiStar
        className="absolute inset-0 size-full fill-amber-400 text-amber-400"
        style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}
      />
    </span>
  );
}

export type RatingStarsProps = {
  rating: number;
  className?: string;
};

/** Display fractional ratings without rounding them to whole stars. */
export function RatingStars({ rating, className = "" }: RatingStarsProps) {
  const value = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0;
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} className={`inline-flex gap-0.5 ${className}`}>
      {stars.map((star) => (
        <span key={star} className="size-[1em] shrink-0">
          <RatingStar fill={Math.min(1, Math.max(0, value - star + 1))} />
        </span>
      ))}
    </span>
  );
}

export type StarRatingProps = {
  label: string;
  name: string;
  value: number | null;
  onChange: (rating: number) => void;
  step?: 0.5 | 1;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Each star has two native radio targets for half and whole values. */
export function StarRating({ label, name, value, onChange, step = 0.5, required = false, disabled = false, className = "" }: StarRatingProps) {
  const id = useId();
  const [preview, setPreview] = useState<number | null>(null);
  const [justRated, setJustRated] = useState(false);
  const [burst, setBurst] = useState<{ star: number; key: number } | null>(null);
  const displayed = preview ?? value ?? 0;

  useEffect(() => {
    if (!justRated) return;
    const timer = setTimeout(() => setJustRated(false), 200);
    return () => clearTimeout(timer);
  }, [justRated]);

  return (
    <fieldset
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-hint`}
      aria-required={required || undefined}
      disabled={disabled}
      className={`min-w-0 ${disabled ? "opacity-60" : ""} ${className}`}
    >
      <legend id={`${id}-label`} className={getFieldLabelClasses()}>
        {label}{required && <span className="shrink-0 text-red-500" aria-hidden="true">*</span>}
      </legend>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex shrink-0 gap-1" onPointerLeave={() => setPreview(null)}>
          {stars.map((star) => (
            <span key={star} className="relative flex size-11 items-center justify-center rounded-lg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-black/50 dark:has-[:focus-visible]:outline-white/60">
              <span className={`pointer-events-none size-8 motion-safe:transition-transform motion-safe:duration-200 ${justRated && value !== null && star <= Math.ceil(value) ? "motion-safe:scale-125" : preview !== null && star === Math.ceil(preview) ? "motion-safe:scale-110 drop-shadow-[0_0_6px_rgb(251_191_36_/_0.6)]" : ""}`}>
                <RatingStar fill={Math.min(1, Math.max(0, displayed - star + 1))} />
              </span>
              {burst?.star === star && <RatingBurst key={burst.key} rating={burst.star} />}
              {(step === 1 ? [star] : [star - 0.5, star]).map((rating) => (
                <label
                  key={rating}
                  className={`absolute inset-y-0 ${step === 1 ? "inset-x-0" : rating === star ? "right-0 w-1/2" : "left-0 w-1/2"} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                  onPointerEnter={(event) => {
                    if (!disabled && event.pointerType === "mouse") setPreview(rating);
                  }}
                >
                  <input
                    type="radio"
                    name={name}
                    value={rating}
                    checked={value === rating}
                    required={required}
                    disabled={disabled}
                    className={`absolute inset-0 m-0 size-full opacity-0 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                    onChange={() => { setPreview(null); setJustRated(true); setBurst({ star: Math.ceil(rating), key: Date.now() }); onChange(rating); }}
                  />
                  <span className="sr-only">{rating} {rating === 1 ? "star" : "stars"}</span>
                </label>
              ))}
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums text-black/70 dark:text-white/70" aria-hidden="true">
          {preview === null && value ? <><FiCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />Rated {value} out of 5</> : displayed ? `${displayed} out of 5` : "Choose a rating"}
        </span>
      </div>
      <p id={`${id}-hint`} className={step === 1 ? "sr-only" : "mt-1 text-sm text-black/70 dark:text-white/70"}>{step === 1 ? "Choose one to five stars. Use the arrow keys to change your rating." : "Choose a star. Use its left half for a half star."}</p>
    </fieldset>
  );
}
