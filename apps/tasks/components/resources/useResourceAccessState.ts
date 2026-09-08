"use client";

import { useEffect, useRef, useState } from "react";
import { LatestRequestTracker } from "@/lib/latest-request";

type ResourceAccessResult<TGroup, TMode> = {
  groups: TGroup[];
  accessMode?: TMode;
  groupIds?: string[];
};

export function useResourceAccessState<TGroup, TMode>({
  initialAccessMode,
  demoMode,
}: {
  initialAccessMode: TMode;
  demoMode: boolean;
}) {
  const requests = useRef(new LatestRequestTracker());
  const [groups, setGroups] = useState<TGroup[]>([]);
  /**
   * The mode the editor opened with, straight off the record. The mode field
   * renders from it immediately instead of waiting on the access request, so
   * this is also the marker for "the reader has not touched it yet".
   */
  const seededAccessMode = useRef(initialAccessMode);
  const [accessMode, setAccessMode] = useState(initialAccessMode);
  const [savedAccessMode, setSavedAccessMode] = useState(initialAccessMode);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [savedGroupIds, setSavedGroupIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(demoMode);

  useEffect(
    () => () => {
      const active = requests.current.getActive();
      if (active) requests.current.abort(active);
    },
    [],
  );

  function begin(nextAccessMode: TMode) {
    const active = requests.current.getActive();
    if (active) requests.current.abort(active);
    seededAccessMode.current = nextAccessMode;
    setAccessMode(nextAccessMode);
    setSavedAccessMode(nextAccessMode);
    setGroupIds([]);
    setSavedGroupIds([]);
    setLoaded(demoMode);
  }

  async function load(
    request: (
      signal: AbortSignal,
    ) => Promise<ResourceAccessResult<TGroup, TMode>>,
    { applySelection = true }: { applySelection?: boolean } = {},
  ) {
    const ticket = requests.current.start();
    setLoaded(false);
    try {
      const result = await request(ticket.controller.signal);
      if (!requests.current.isLatest(ticket)) return false;
      setGroups(result.groups);
      if (applySelection) {
        if (result.accessMode !== undefined) {
          const fetched = result.accessMode;
          // The field is live while this request is in flight, so adopt the
          // fetched mode only if the reader has not already picked one. The
          // saved copy always takes it: it is the baseline the editor compares
          // against to decide whether there is anything to save.
          setAccessMode((current) =>
            current === seededAccessMode.current ? fetched : current,
          );
          setSavedAccessMode(fetched);
        }
        const nextGroupIds = result.groupIds ?? [];
        setGroupIds(nextGroupIds);
        setSavedGroupIds(nextGroupIds);
      }
      setLoaded(true);
      return true;
    } catch (error) {
      if (!requests.current.isLatest(ticket)) return false;
      throw error;
    } finally {
      requests.current.finish(ticket);
    }
  }

  function commit() {
    setSavedAccessMode(accessMode);
    setSavedGroupIds(groupIds);
  }

  return {
    groups,
    selection: {
      accessMode,
      groupIds,
      savedAccessMode,
      savedGroupIds,
    },
    changes: { setAccessMode, setGroupIds },
    loaded,
    begin,
    load,
    commit,
  };
}
