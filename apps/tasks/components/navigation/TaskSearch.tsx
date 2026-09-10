"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiLoader, FiSearch, FiX } from "react-icons/fi";
import type { Category, Project } from "@/lib/resources/resource-types";
import type { Status, Task, TaskAssignee } from "@/lib/tasks/task-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import {
  findRelatedTaskSearchResults,
  firstRelatedTaskSearchHref,
  orderTaskSearchGroups,
  partitionArchivedTasks,
  rankTaskSearchResults,
  taskSearchAllHref,
  taskSearchFilterHref,
  taskSearchProjectHref,
  taskSearchResultHref,
  TASK_SEARCH_MIN_LENGTH,
  type TaskSearchPreview,
} from "@/lib/tasks/task-search";
import {
  ACCESS_PREVIEW_PARAM,
  USER_ACCESS_PREVIEW_PARAM,
} from "@/lib/access/access-preview";
import { useSearchCombobox } from "@/hooks/useSearchCombobox";
import { TaskSearchResults } from "./TaskSearchResults";

const DEBOUNCE_MS = 200;
const DESKTOP_SEARCH_PLACEHOLDER_QUERY = "(min-width: 64rem)";

export function TaskSearch({
  tasks,
  projects = [],
  categories = [],
  statuses = [],
  profiles = [],
  taskAssignees = [],
}: {
  tasks: Task[];
  projects?: Project[];
  categories?: Category[];
  statuses?: Status[];
  profiles?: Profile[];
  taskAssignees?: TaskAssignee[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [showDetailedPlaceholder, setShowDetailedPlaceholder] = useState(false);
  const [deferredQuery, setDeferredQuery] = useState("");
  const [remoteTasks, setRemoteTasks] = useState<Task[] | null>(null);
  const [remoteArchivedTasks, setRemoteArchivedTasks] = useState<Task[] | null>(
    null,
  );
  const [remoteTaskAssignees, setRemoteTaskAssignees] = useState<
    TaskAssignee[] | null
  >(null);
  const [remoteTotalCount, setRemoteTotalCount] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const isTooShort = query.trim().length < TASK_SEARCH_MIN_LENGTH;
  const isPending = query.trim() !== deferredQuery || isFetching;
  const projectNames = useMemo(
    () => new Map(projects.map((item) => [item.id, item.name])),
    [projects],
  );
  const statusNames = useMemo(
    () => new Map(statuses.map((item) => [item.id, item.name])),
    [statuses],
  );
  const profilesById = useMemo(
    () => new Map(profiles.map((item) => [item.id, item])),
    [profiles],
  );
  const preview = useMemo<TaskSearchPreview>(
    () => ({
      [ACCESS_PREVIEW_PARAM]: searchParams.get(ACCESS_PREVIEW_PARAM),
      [USER_ACCESS_PREVIEW_PARAM]: searchParams.get(USER_ACCESS_PREVIEW_PARAM),
    }),
    [searchParams],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_SEARCH_PLACEHOLDER_QUERY);
    const updatePlaceholder = () =>
      setShowDetailedPlaceholder(mediaQuery.matches);
    updatePlaceholder();
    mediaQuery.addEventListener("change", updatePlaceholder);
    return () => mediaQuery.removeEventListener("change", updatePlaceholder);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextQuery = query.trim();
      setDeferredQuery(nextQuery);
      setIsFetching(nextQuery.length >= TASK_SEARCH_MIN_LENGTH);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (deferredQuery.length < TASK_SEARCH_MIN_LENGTH) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: deferredQuery });
    Object.entries(preview).forEach(([name, value]) => {
      if (value) params.set(name, value);
    });
    fetch(`/api/tasks/search?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Task search failed");
        return (await response.json()) as {
          tasks?: Task[];
          archivedTasks?: Task[];
          taskAssignees?: TaskAssignee[];
          totalCount?: number;
        };
      })
      .then((result) => {
        setRemoteTasks(result.tasks ?? []);
        setRemoteArchivedTasks(result.archivedTasks ?? []);
        setRemoteTaskAssignees(result.taskAssignees ?? []);
        setRemoteTotalCount(result.totalCount ?? 0);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setRemoteTasks(null);
        setRemoteArchivedTasks(null);
        setRemoteTaskAssignees(null);
        setRemoteTotalCount(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsFetching(false);
      });
    return () => controller.abort();
  }, [deferredQuery, preview]);

  // Demo mode has no search endpoint, so the local list is both sources at
  // once and has to be split the way the server splits its two queries.
  const local = useMemo(() => partitionArchivedTasks(tasks), [tasks]);
  const results = useMemo(
    () =>
      rankTaskSearchResults({
        tasks: remoteTasks ?? local.active,
        query: deferredQuery,
        projectNames,
      }),
    [deferredQuery, local.active, projectNames, remoteTasks],
  );
  const archivedResults = useMemo(
    () =>
      rankTaskSearchResults({
        tasks: remoteArchivedTasks ?? local.archived,
        query: deferredQuery,
        projectNames,
      }),
    [deferredQuery, local.archived, projectNames, remoteArchivedTasks],
  );
  // One index space for the keyboard, in the order the two sections read.
  const options = useMemo(
    () => [...results, ...archivedResults],
    [archivedResults, results],
  );
  const related = useMemo(
    () =>
      findRelatedTaskSearchResults({
        query: deferredQuery,
        projects,
        categories,
        profiles,
        statuses,
      }),
    [categories, deferredQuery, profiles, projects, statuses],
  );
  const groupOrder = useMemo(
    () => orderTaskSearchGroups(related, remoteTotalCount ?? results.length),
    [related, remoteTotalCount, results.length],
  );
  const { open, setOpen, activeIndex, setActiveIndex, reset, onKeyDown } =
    useSearchCombobox(options.length, isPending);
  const showDropdown = open && Boolean(query.trim());

  function clear(close = true) {
    setQuery("");
    setDeferredQuery("");
    setRemoteTasks(null);
    setRemoteArchivedTasks(null);
    setRemoteTaskAssignees(null);
    setRemoteTotalCount(null);
    setIsFetching(false);
    if (close) reset();
  }

  function navigate(href: string) {
    clear();
    router.push(href);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const selected = options[activeIndex] ?? options[0];
    const href = selected
      ? taskSearchResultHref(selected, preview)
      : firstRelatedTaskSearchHref(related, preview, projects);
    if (href) navigate(href);
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className="relative order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto sm:max-w-[35rem]"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <FiSearch
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40"
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search tasks"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={showDropdown}
        aria-activedescendant={
          showDropdown && !isPending && options[activeIndex]
            ? `${listboxId}-${options[activeIndex].id}`
            : undefined
        }
        aria-busy={isPending}
        autoComplete="off"
        value={query}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setIsFetching(value.trim().length >= TASK_SEARCH_MIN_LENGTH);
          setActiveIndex(0);
          setOpen(true);
        }}
        placeholder={
          showDetailedPlaceholder
            ? "Search tasks by title, ID, or project..."
            : "Search tasks…"
        }
        className="h-10 w-full rounded-lg border border-black/10 bg-white pl-10 pr-20 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10 [&::-webkit-search-cancel-button]:appearance-none dark:border-white/10 dark:bg-white/5 dark:focus:border-white/30"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            clear();
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-black/55 hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/40"
        >
          <FiX aria-hidden />
        </button>
      )}
      {isPending && (
        <span
          role="status"
          aria-label="Finding tasks"
          className="absolute right-11 top-1/2 -translate-y-1/2 text-black/45 dark:text-white/45"
        >
          <FiLoader className="animate-spin motion-reduce:animate-none" />
        </span>
      )}
      {showDropdown && (
        <TaskSearchResults
          listboxId={listboxId}
          isPending={isPending}
          isTooShort={isTooShort}
          results={results}
          archivedResults={archivedResults}
          related={related}
          groupOrder={groupOrder}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          selectTask={(task) => navigate(taskSearchResultHref(task, preview))}
          projectNames={projectNames}
          statusNames={statusNames}
          profilesById={profilesById}
          taskAssignees={remoteTaskAssignees ?? taskAssignees}
          remoteTotalCount={remoteTotalCount}
          allResultsHref={taskSearchAllHref(deferredQuery, preview)}
          filterHref={(name, value) =>
            taskSearchFilterHref(name, value, preview)
          }
          projectHref={(project) =>
            taskSearchProjectHref(project, projects, preview)
          }
        />
      )}
    </form>
  );
}
