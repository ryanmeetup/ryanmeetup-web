import type { SVGAttributes } from "react";

export type SpinnerProps = SVGAttributes<SVGSVGElement> & {
  label?: string;
  /** Width and height in pixels. A word such as "sm" is not a size: SVG would fall back to 300×150. */
  size?: number;
};

const Spinner = ({
  label = "Loading",
  size = 20,
  className,
  ...props
}: SpinnerProps) => (
  <svg
    {...props}
    role="status"
    aria-label={label}
    width={size}
    height={size}
    className={`animate-spin text-current motion-reduce:animate-none ${className ?? ""}`}
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="9"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    />
    <path
      d="M12 3a9 9 0 0 1 9 9"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="3"
    />
  </svg>
);

export { Spinner };
