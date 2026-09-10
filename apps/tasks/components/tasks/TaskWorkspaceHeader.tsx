"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Avatar, Button, Heading, Tooltip } from "@ryanmeetup/ui";
import {
  FiArchive,
  FiChevronDown,
  FiEdit2,
  FiFolder,
  FiGrid,
  FiList,
  FiTag,
  FiUsers,
} from "react-icons/fi";
import { CountBadge } from "@/components/global";
import { ProjectFavoriteButton } from "@/components/projects/ProjectFavoriteButton";
import type { Category, Project } from "@/lib/resources/resource-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import {
  ResourceAttachmentsPreview,
  ResourceChipsSkeleton,
  ResourceLinks,
  useResourceAttachments,
} from "@/components/resources";

export type TaskWorkspaceHeaderScope = {
  assignee: string;
  demoMode: boolean;
  isMyTasks: boolean;
  myTasksName: string;
  previewing: boolean;
  projectFavorite: boolean;
  projectFavoritePending: boolean;
  projectOwners: Profile[];
  /**
   * How many attachments the selected project and category are known to have,
   * from the counts loaded with the page. Zero suppresses the loading
   * placeholder entirely; undefined means the count is unknown, so the
   * placeholder shows rather than risking a silent pop-in.
   */
  projectAttachmentCount: number | undefined;
  categoryAttachmentCount: number | undefined;
  scopeDescription: string | null | undefined;
  selectedCategory: Category | null | undefined;
  selectedProject: Project | null | undefined;
  taskCount: number;
  view: "board" | "list";
  visibility: "active" | "archived";
  viewTitle: string;
  viewingAsGroup: boolean;
};

export type TaskWorkspaceHeaderControls = {
  onEditProject: () => void;
  onToggleProjectFavorite: () => void;
  onEditCategory: () => void;
  onSetAssignee: (value: string) => void;
  onSetView: (value: "board" | "list") => void;
  onSetVisibility: (value: "active" | "archived") => void;
};

/**
 * Header details that collapse on mobile and stay open from `md` up.
 *
 * The panel was a native `<details>`, which snaps between states with no
 * animation. Animating the row track instead lets it grow and fade at the
 * same pace as the rest of the app's collapses. Desktop keeps the panel open
 * through `max-md:` overrides rather than the media-query state, so the wide
 * layout is right on the first paint instead of after the effect runs.
 */
function WorkspaceHeaderDetails({
  children,
  desktop,
  icon,
  label,
  open,
  setOpen,
}: {
  children: ReactNode;
  desktop: boolean;
  icon: ReactNode;
  label: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const panelId = useId();
  return (
    <div className="mt-3 rounded-2xl border border-black/10 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5 md:border-0 md:bg-transparent md:shadow-none md:dark:bg-transparent">
      <div className="md:hidden">
        <button
          type="button"
          aria-controls={panelId}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2 rounded-2xl p-4 text-left text-xs font-semibold uppercase tracking-widest text-black/50 transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:text-white/50 dark:hover:text-white dark:focus-visible:ring-white/30"
        >
          {icon}
          {label}
          <FiChevronDown
            aria-hidden
            className={`ml-auto shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${
              open ? "-rotate-180" : ""
            }`}
          />
        </button>
      </div>
      <div
        id={panelId}
        aria-hidden={!open && !desktop}
        className={`grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
          open
            ? ""
            : "max-md:pointer-events-none max-md:grid-rows-[0fr] max-md:opacity-0"
        }`}
      >
        <div
          inert={!open && !desktop}
          className="min-h-0 overflow-hidden md:overflow-visible"
        >
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-4 pb-4 md:p-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaskWorkspaceHeader({
  scope,
  controls,
}: {
  scope: TaskWorkspaceHeaderScope;
  controls: TaskWorkspaceHeaderControls;
}) {
  const [desktopDetails, setDesktopDetails] = useState(false);
  const [projectDetailsOpen, setProjectDetailsOpen] = useState(false);
  const [categoryDetailsOpen, setCategoryDetailsOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktopDetails(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const {
    assignee,
    demoMode,
    isMyTasks,
    myTasksName,
    previewing,
    projectFavorite,
    projectFavoritePending,
    projectOwners,
    projectAttachmentCount,
    categoryAttachmentCount,
    scopeDescription,
    selectedCategory,
    selectedProject,
    taskCount,
    view,
    viewTitle,
    viewingAsGroup,
    visibility,
  } = scope;
  const {
    onEditProject,
    onEditCategory,
    onSetAssignee,
    onSetView,
    onSetVisibility,
    onToggleProjectFavorite,
  } = controls;
  // Favorites belong to the viewer's own profile, so an access preview - which
  // borrows someone else's view - has none to show.
  const showFavorite = Boolean(
    selectedProject && !previewing && !selectedProject.archived_at,
  );
  const projectAttachments = useResourceAttachments({
    kind: "project",
    resourceId: selectedProject?.id,
    demoMode,
    currentUserId: "",
  });
  const categoryAttachments = useResourceAttachments({
    kind: "category",
    resourceId: selectedCategory?.id,
    demoMode,
    currentUserId: "",
  });
  // Only reserve space for attachments that are actually coming. A resource
  // counted at zero skips the placeholder, so an empty project no longer
  // flashes an Attachments heading that removes itself a moment later.
  const projectAttachmentsPending =
    projectAttachments.loading && projectAttachmentCount !== 0;
  const categoryAttachmentsPending =
    categoryAttachments.loading && categoryAttachmentCount !== 0;
  return (
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-black/50 dark:text-white/50">
          {selectedProject
            ? "Project workspace"
            : selectedCategory
              ? "Category workspace"
              : isMyTasks
                ? "Personal workspace"
                : "Team workspace"}
        </p>
        <Heading size="h1" className="text-2xl sm:text-4xl">
          {viewTitle}&nbsp;
          <CountBadge size="lg" label="task">
            {taskCount}
          </CountBadge>
          {showFavorite && (
            <ProjectFavoriteButton
              projectName={selectedProject?.name ?? "project"}
              favorite={projectFavorite}
              pending={projectFavoritePending}
              onToggle={onToggleProjectFavorite}
            />
          )}
        </Heading>
        {scopeDescription && (
          <p className="mt-2 text-sm text-black/70 dark:text-white/70 sm:text-base">
            {scopeDescription}
          </p>
        )}
        {selectedProject && (
          <WorkspaceHeaderDetails
            label="Project details"
            icon={<FiFolder aria-hidden />}
            open={projectDetailsOpen}
            setOpen={setProjectDetailsOpen}
            desktop={desktopDetails}
          >
            <div className="min-w-0">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                Owners
              </p>
              <div className="flex min-h-8 min-w-0 items-center gap-3">
                {projectOwners.length > 0 ? (
                  <Tooltip
                    content={projectOwners
                      .map((owner) => owner.full_name)
                      .join(", ")}
                    placement="bottom"
                  >
                    <div
                      className="flex shrink-0 -space-x-2"
                      aria-label={`${projectOwners.length} ${projectOwners.length === 1 ? "project owner" : "project owners"}`}
                    >
                      {projectOwners.slice(0, 3).map((owner) => (
                        <Avatar
                          key={owner.id}
                          name={owner.full_name}
                          src={owner.avatar_url}
                          size="md"
                          className="ring-2 ring-[#f1f2ef] dark:ring-[#101010]"
                        />
                      ))}
                    </div>
                  </Tooltip>
                ) : (
                  <>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-black/25 text-black/45 dark:border-white/25 dark:text-white/45">
                      <FiUsers aria-hidden size={14} />
                    </span>
                    <p className="text-xs font-medium text-black/70 dark:text-white/70">
                      Unassigned
                    </p>
                  </>
                )}
              </div>
            </div>
            {selectedProject.links.length > 0 && (
              <div className="min-w-0">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                  Useful links
                </p>
                <ResourceLinks links={selectedProject.links} />
              </div>
            )}
            {(projectAttachmentsPending ||
              projectAttachments.notes.length > 0 ||
              projectAttachments.files.length > 0) && (
              <div className="min-w-0">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                  Attachments
                </p>
                {projectAttachmentsPending ? (
                  <ResourceChipsSkeleton
                    count={projectAttachmentCount}
                    label="Loading project attachments"
                  />
                ) : (
                  <ResourceAttachmentsPreview
                    notes={projectAttachments.notes}
                    files={projectAttachments.files}
                  />
                )}
              </div>
            )}
          </WorkspaceHeaderDetails>
        )}
        {selectedCategory &&
          ((selectedCategory.links ?? []).length > 0 ||
            categoryAttachmentsPending ||
            categoryAttachments.notes.length > 0 ||
            categoryAttachments.files.length > 0) && (
            <WorkspaceHeaderDetails
              label="Category details"
              icon={<FiTag aria-hidden />}
              open={categoryDetailsOpen}
              setOpen={setCategoryDetailsOpen}
              desktop={desktopDetails}
            >
              {(selectedCategory.links ?? []).length > 0 && (
                <div className="min-w-0">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    Useful links
                  </p>
                  <ResourceLinks links={selectedCategory.links ?? []} />
                </div>
              )}
              {(categoryAttachmentsPending ||
                categoryAttachments.notes.length > 0 ||
                categoryAttachments.files.length > 0) && (
                <div className="min-w-0">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    Attachments
                  </p>
                  {categoryAttachmentsPending ? (
                    <ResourceChipsSkeleton
                      count={categoryAttachmentCount}
                      label="Loading category attachments"
                    />
                  ) : (
                    <ResourceAttachmentsPreview
                      notes={categoryAttachments.notes}
                      files={categoryAttachments.files}
                    />
                  )}
                </div>
              )}
            </WorkspaceHeaderDetails>
          )}
      </div>
      <div className="flex w-full flex-col gap-2 xl:w-auto xl:items-end">
        {selectedProject && !previewing && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<FiEdit2 aria-hidden />}
            onClick={onEditProject}
          >
            Edit project
          </Button>
        )}
        {selectedCategory && !previewing && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<FiEdit2 aria-hidden />}
            onClick={onEditCategory}
          >
            Edit category
          </Button>
        )}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="grid w-full min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-3 sm:block sm:w-auto">
            <p
              aria-hidden="true"
              className="text-[9px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/45 sm:hidden"
            >
              Assignee
            </p>
            <div
              role="group"
              className="grid min-w-0 grid-cols-2 rounded-lg border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-white/5 sm:flex"
              aria-label="Task assignee"
            >
              <button
                aria-pressed={assignee === "all"}
                onClick={() => onSetAssignee("all")}
                className={`view-button min-h-11 min-w-0 px-2 tracking-[0.08em] sm:min-h-0 sm:px-3 sm:tracking-[0.14em] ${assignee === "all" ? "view-button-active" : ""}`}
              >
                All
              </button>
              {viewingAsGroup ? (
                <Tooltip content="Mine is unavailable when viewing as an access group because a group is not a task assignee.">
                  <button
                    type="button"
                    disabled
                    className="view-button min-h-11 min-w-0 px-2 tracking-[0.08em] opacity-40 sm:min-h-0 sm:px-3 sm:tracking-[0.14em]"
                  >
                    Mine
                  </button>
                </Tooltip>
              ) : (
                <button
                  aria-pressed={isMyTasks}
                  onClick={() => onSetAssignee(myTasksName)}
                  className={`view-button min-h-11 min-w-0 px-2 tracking-[0.08em] sm:min-h-0 sm:px-3 sm:tracking-[0.14em] ${isMyTasks ? "view-button-active" : ""}`}
                >
                  Mine
                </button>
              )}
            </div>
          </div>
          <div className="grid w-full min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-3 sm:block sm:w-auto">
            <p
              aria-hidden="true"
              className="text-[9px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/45 sm:hidden"
            >
              Status
            </p>
            <div
              role="group"
              className="grid min-w-0 grid-cols-2 rounded-lg border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-white/5 sm:flex"
              aria-label="Task status"
            >
              <button
                aria-pressed={visibility === "active"}
                onClick={() => onSetVisibility("active")}
                className={`view-button min-h-11 min-w-0 px-2 tracking-[0.08em] sm:min-h-0 sm:px-3 sm:tracking-[0.14em] ${visibility === "active" ? "view-button-active" : ""}`}
              >
                Active
              </button>
              <button
                aria-pressed={visibility === "archived"}
                onClick={() => onSetVisibility("archived")}
                className={`view-button min-h-11 min-w-0 gap-1 px-2 tracking-[0.08em] sm:min-h-0 sm:gap-2 sm:px-3 sm:tracking-[0.14em] ${visibility === "archived" ? "view-button-active" : ""}`}
              >
                <FiArchive aria-hidden className="hidden sm:block" /> Archive
              </button>
            </div>
          </div>
          {/* Archived work has no board: only a status that closes work can
              hold an archived task, so the lanes would be empty. */}
          {visibility === "active" && (
            <div className="grid w-full min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-3 sm:block sm:w-auto">
              <p
                aria-hidden="true"
                className="text-[9px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/45 sm:hidden"
              >
                Layout
              </p>
              <div
                role="group"
                className="grid min-w-0 grid-cols-2 rounded-lg border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-white/5 sm:flex"
                aria-label="Task layout"
              >
                <button
                  aria-pressed={view === "board"}
                  onClick={() => onSetView("board")}
                  className={`view-button min-h-11 min-w-0 gap-1 px-2 tracking-[0.08em] sm:min-h-0 sm:gap-2 sm:px-3 sm:tracking-[0.14em] ${view === "board" ? "view-button-active" : ""}`}
                >
                  <FiGrid aria-hidden /> Board
                </button>
                <button
                  aria-pressed={view === "list"}
                  onClick={() => onSetView("list")}
                  className={`view-button min-h-11 min-w-0 gap-1 px-2 tracking-[0.08em] sm:min-h-0 sm:gap-2 sm:px-3 sm:tracking-[0.14em] ${view === "list" ? "view-button-active" : ""}`}
                >
                  <FiList aria-hidden /> List
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
