"use client";

import { useEffect, useState } from "react";

const storageKey = "ryanmeetup.tasks.collapsed-statuses";

export function useCollapsedStatuses() {
  const [collapsedStatusIds, setCollapsedStatusIds] =
    useState<Set<string> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    queueMicrotask(() => {
      try {
        setCollapsedStatusIds(
          new Set(saved ? (JSON.parse(saved) as string[]) : []),
        );
      } catch {
        localStorage.removeItem(storageKey);
        setCollapsedStatusIds(new Set());
      }
    });
  }, []);

  useEffect(() => {
    if (!collapsedStatusIds) return;
    localStorage.setItem(storageKey, JSON.stringify([...collapsedStatusIds]));
  }, [collapsedStatusIds]);

  const toggleStatusSection = (statusId: string) => {
    setCollapsedStatusIds((current) => {
      const next = new Set(current ?? []);
      if (next.has(statusId)) next.delete(statusId);
      else next.add(statusId);
      return next;
    });
  };

  const expandStatusSection = (statusId: string) => {
    setCollapsedStatusIds((current) => {
      if (!current?.has(statusId)) return current;
      const next = new Set(current);
      next.delete(statusId);
      return next;
    });
  };

  return {
    collapsedStatusIds,
    expandStatusSection,
    toggleStatusSection,
  };
}
