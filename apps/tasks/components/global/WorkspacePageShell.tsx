"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { IconButton, Spinner } from "@ryanmeetup/ui";
import { FiSidebar } from "react-icons/fi";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import {
  TaskHeaderActions,
  TaskHeaderBrand,
  TaskSearch,
  TasksFooter,
  TasksSidebar,
} from "@/components/navigation";
import { TaskBanners } from "./TaskBanners";
import { InstanceWordmark } from "./InstanceWordmark";
import { NewTaskModal } from "@/components/tasks/NewTaskModal";

type WorkspaceShellRegistration = {
  id: symbol;
  data: WorkspaceData;
  demoMode: boolean;
  onCreateCategory?: () => void;
  onCreateProject?: () => void;
  onNewTask?: () => void;
  setData: Dispatch<SetStateAction<WorkspaceData>>;
};

type PersistentShellContextValue = {
  register: (registration: WorkspaceShellRegistration) => void;
  unregister: (id: symbol) => void;
};

const PersistentShellContext =
  createContext<PersistentShellContextValue | null>(null);

const desktopSidebarStorageKey = "ryanmeetup.tasks.desktop-sidebar-open";

function useDesktopSidebarOpen() {
  const [open, setOpen] = useState(true);
  const loaded = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(desktopSidebarStorageKey);
        if (saved !== null) setOpen(saved === "true");
      } catch {
        // Storage can be unavailable in privacy-restricted browsers. The
        // sidebar still works for the current visit in that case.
      } finally {
        loaded.current = true;
      }
    });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(desktopSidebarStorageKey, String(open));
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }, [open]);

  return [open, setOpen] as const;
}

type WorkspacePageShellProps = {
  children: ReactNode;
  contentClassName?: string;
  data: WorkspaceData;
  demoMode: boolean;
  onCreateCategory?: () => void;
  onCreateProject?: () => void;
  onNewTask?: () => void;
  setData: Dispatch<SetStateAction<WorkspaceData>>;
  setSidebarOpen: (open: boolean) => void;
  sidebarOpen: boolean;
};

function WorkspaceChrome({
  children,
  contentClassName,
  data,
  demoMode,
  onCreateCategory,
  onCreateProject,
  onNewTask,
  setData,
  setSidebarOpen,
  sidebarOpen,
}: WorkspacePageShellProps) {
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useDesktopSidebarOpen();
  const previewing = Boolean(data.accessPreview);
  return (
    <div
      data-workspace-shell
      className="tasks-workspace-background min-h-dvh text-black dark:text-white"
      style={
        {
          "--workspace-sidebar-width": desktopSidebarOpen ? "17.5rem" : "0rem",
        } as CSSProperties
      }
    >
      <TasksSidebar
        data={data}
        demoMode={demoMode}
        desktopOpen={desktopSidebarOpen}
        setDesktopOpen={setDesktopSidebarOpen}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        onCreateCategory={onCreateCategory ?? (() => undefined)}
        onCreateProject={onCreateProject ?? (() => undefined)}
      />
      <main className="flex min-h-dvh min-w-0 flex-col overflow-x-clip transition-[padding] duration-200 ease-out motion-reduce:transition-none lg:pl-[var(--workspace-sidebar-width)]">
        <header className="tasks-app-header">
          <IconButton
            label="Open navigation"
            tooltipTriggerClassName="lg:hidden"
            aria-controls="mobile-workspace-navigation"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <FiSidebar />
          </IconButton>
          {!desktopSidebarOpen && (
            <IconButton
              label="Show navigation"
              tooltipPlacement="right"
              tooltipTriggerClassName="hidden lg:inline-flex"
              aria-controls="desktop-workspace-navigation"
              aria-expanded={false}
              onClick={() => setDesktopSidebarOpen(true)}
            >
              <FiSidebar />
            </IconButton>
          )}
          <TaskHeaderBrand />
          <TaskSearch
            tasks={data.tasks}
            projects={data.projects}
            categories={data.categories}
            statuses={data.statuses}
            profiles={data.profiles}
            taskAssignees={data.taskAssignees}
          />
          <TaskHeaderActions
            profile={data.currentProfile}
            previewing={previewing}
            demoMode={demoMode}
            onNewTask={onNewTask ?? (() => setNewTaskOpen(true))}
          />
        </header>
        <div className="hidden h-16 lg:block" aria-hidden="true" />
        <TaskBanners demoMode={demoMode} preview={data.accessPreview} />
        <div
          className={["flex min-h-0 flex-1 flex-col", contentClassName]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>
        <TasksFooter inShell />
      </main>
      {!onNewTask && !previewing && (
        <NewTaskModal
          data={data}
          demoMode={demoMode}
          open={newTaskOpen}
          setData={setData}
          setOpen={setNewTaskOpen}
        />
      )}
    </div>
  );
}

/**
 * What the workspace looks like before its data arrives: the same chrome
 * geometry with a spinner where the page will be, and no footer to sit alone on
 * an otherwise empty document. The nav and search are omitted rather than
 * rendered empty — there is nothing to navigate to or search yet — but the
 * wordmark and header bar hold their positions so the real shell replaces this
 * without the page jumping.
 */
export function WorkspaceShellSkeleton() {
  return (
    <div
      data-workspace-shell-loading
      aria-busy="true"
      className="tasks-workspace-background min-h-screen text-black dark:text-white"
    >
      <aside
        aria-hidden="true"
        className="fixed inset-y-0 left-0 z-40 hidden w-[17.5rem] flex-col border-r border-black/10 bg-white px-4 pt-4 dark:border-white/10 dark:bg-black lg:flex"
      >
        <div className="relative flex h-12 items-center px-2">
          <p className="whitespace-nowrap px-2 py-1 font-cooper text-2xl uppercase">
            <InstanceWordmark />
          </p>
        </div>
      </aside>
      <main className="min-w-0 overflow-x-clip lg:pl-[17.5rem]">
        <header className="tasks-app-header">
          <TaskHeaderBrand />
        </header>
        <div className="hidden h-16 lg:block" aria-hidden="true" />
        <div className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4 py-12">
          <Spinner
            size={28}
            label="Loading workspace"
            className="text-black/45 dark:text-white/45"
          />
        </div>
      </main>
    </div>
  );
}

export function WorkspacePageShell(props: WorkspacePageShellProps) {
  const persistentShell = useContext(PersistentShellContext);
  const registrationId = useRef(Symbol("workspace-shell-page"));
  const {
    children,
    contentClassName,
    data,
    demoMode,
    onCreateCategory,
    onCreateProject,
    onNewTask,
    setData,
  } = props;

  useLayoutEffect(() => {
    if (!persistentShell) return;
    const id = registrationId.current;
    persistentShell.register({
      id,
      data,
      demoMode,
      onCreateCategory,
      onCreateProject,
      onNewTask,
      setData,
    });
    return () => persistentShell.unregister(id);
  }, [
    data,
    demoMode,
    onCreateCategory,
    onCreateProject,
    onNewTask,
    persistentShell,
    setData,
  ]);

  if (persistentShell) {
    return (
      <div
        className={["min-h-0 flex-1", contentClassName]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    );
  }

  return <WorkspaceChrome {...props} />;
}

export function PersistentWorkspaceShell({
  children,
  initialData,
  demoMode,
}: {
  children: ReactNode;
  initialData: WorkspaceData;
  demoMode: boolean;
}) {
  const workspace = useWorkspaceData(initialData, demoMode);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [registration, setRegistration] =
    useState<WorkspaceShellRegistration | null>(null);
  const context = useMemo<PersistentShellContextValue>(
    () => ({
      register: setRegistration,
      unregister: (id) =>
        setRegistration((current) =>
          current?.id === id ? null : current,
        ),
    }),
    [],
  );
  const activeWorkspace = registration ?? workspace;

  return (
    <PersistentShellContext.Provider value={context}>
      <WorkspaceChrome
        data={activeWorkspace.data}
        setData={activeWorkspace.setData}
        demoMode={registration?.demoMode ?? demoMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onCreateCategory={registration?.onCreateCategory}
        onCreateProject={registration?.onCreateProject}
        onNewTask={registration?.onNewTask}
      >
        {children}
      </WorkspaceChrome>
    </PersistentShellContext.Provider>
  );
}
