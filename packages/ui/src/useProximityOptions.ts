"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function orderProximityOptions<
  T extends { value: string; group?: { label: string } },
>(
  options: T[],
  opensUpward: boolean,
  proximityValue?: string,
  proximityGroup?: string,
) {
  const proximityOptions = proximityValue
    ? options.filter((option) => option.value === proximityValue)
    : proximityGroup
      ? options.filter((option) => option.group?.label === proximityGroup)
      : [];
  if (proximityOptions.length === 0) return options;
  const proximityValues = new Set(
    proximityOptions.map((option) => option.value),
  );
  const remainingOptions = options.filter(
    (option) => !proximityValues.has(option.value),
  );
  return opensUpward
    ? [...remainingOptions, ...proximityOptions]
    : [...proximityOptions, ...remainingOptions];
}

export function initialProximityScrollTop(
  opensUpward: boolean,
  hasProximityOptions: boolean,
  scrollHeight: number,
) {
  return opensUpward && hasProximityOptions ? scrollHeight : 0;
}

export function useProximityOptions<
  T extends { value: string; group?: { label: string } },
>(options: T[], proximityValue?: string, proximityGroup?: string) {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const scrollElementRef = useRef<HTMLElement | null>(null);
  const [scrollElementVersion, setScrollElementVersion] = useState(0);
  const [opensUpward, setOpensUpward] = useState(false);
  const setScrollElement = useCallback((element: HTMLElement | null) => {
    scrollElementRef.current = element;
    if (element) setScrollElementVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!anchorElement) return;
    const syncDirection = () =>
      setOpensUpward(anchorElement.dataset.anchor?.split(" ")[0] === "top");
    syncDirection();
    const observer = new MutationObserver(syncDirection);
    observer.observe(anchorElement, {
      attributeFilter: ["data-anchor"],
      attributes: true,
    });
    return () => observer.disconnect();
  }, [anchorElement]);

  const hasProximityOptions = proximityValue
    ? options.some((option) => option.value === proximityValue)
    : proximityGroup
      ? options.some((option) => option.group?.label === proximityGroup)
      : false;

  useEffect(() => {
    let settledFrame = 0;
    const layoutFrame = requestAnimationFrame(() => {
      settledFrame = requestAnimationFrame(() => {
        const scrollElement = scrollElementRef.current;
        if (!scrollElement) return;
        scrollElement.scrollTop = initialProximityScrollTop(
          opensUpward,
          hasProximityOptions,
          scrollElement.scrollHeight,
        );
      });
    });
    return () => {
      cancelAnimationFrame(layoutFrame);
      cancelAnimationFrame(settledFrame);
    };
  }, [hasProximityOptions, opensUpward, scrollElementVersion]);

  const orderedOptions = useMemo(
    () =>
      orderProximityOptions(
        options,
        opensUpward,
        proximityValue,
        proximityGroup,
      ),
    [opensUpward, options, proximityGroup, proximityValue],
  );

  return {
    opensUpward,
    orderedOptions,
    setAnchorElement,
    setScrollElement,
  };
}
