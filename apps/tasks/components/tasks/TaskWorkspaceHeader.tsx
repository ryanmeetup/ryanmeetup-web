"use client";

import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import {
  Avatar,
  DropdownMenu,
  DropdownMenuButton,
  DropdownMenuItem,
  DropdownMenuItems,
  DropdownMenuSeparator,
  Heading,
  IconButton,
  Pill,
  Tooltip,
} from "@ryanmeetup/ui";
import {
  FiArchive,
  FiChevronDown,
  FiEdit2,
  FiExternalLink,
  FiFolder,
  FiGrid,
  FiList,
  FiStar,
  FiTag,
  FiUsers,
} from "react-icons/fi";
import { CountBadge } from "@/components/global";
import { ProjectFavoriteButton } from "@/components/projects/ProjectFavoriteButton";
import { ProjectContextDialog } from "@/components/projects/ProjectDetailsCard";
import type {
  Category,
  Project,
  ResourceLink,
} from "@/lib/resources/resource-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import {
  ResourceAttachmentsPreview,
  ResourceChipsSkeleton,
  ResourceLinks,
  useResourceAttachments,
} from "@/components/resources";

export type TaskWorkspaceHeaderScope = {
  assignee: string;
  currentUserId: string;
  demoMode: boolean;
  isMyTasks: boolean;
  myTasksName: string;
  previewing: boolean;
  projectFavorite: boolean;
  projectFavoritePending: boolean;
  projectDetailsHref: string | null;
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
  onProjectLinksSaved: (links: ResourceLink[]) => void;
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

type WorkspaceSwitchOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Set when the option cannot be chosen; the text says why, in a tooltip. */
  unavailable?: string;
};

/**
 * The workspace's segmented switches - view, assignee, status - in the two
 * surfaces they appear on. `toolbar` sits inside the desktop filter bar, which
 * supplies its own border and background. `grid` is the captioned, full-width
 * form the mobile actions menu stacks, where each switch has to carry its own
 * track and say what it controls.
 */
function WorkspaceSwitch({
  ariaLabel,
  caption,
  onChange,
  options,
  value,
  variant = "toolbar",
}: {
  ariaLabel: string;
  caption: string;
  onChange: (value: string) => void;
  options: WorkspaceSwitchOption[];
  value: string;
  variant?: "toolbar" | "grid";
}) {
  const grid = variant === "grid";
  const track = (
    <div
      role="group"
      aria-label={ariaLabel}
      className={
        grid
          ? "grid w-full min-w-0 auto-cols-fr grid-flow-col rounded-lg border border-black/10 bg-white p-0.5 dark:border-white/10 dark:bg-white/5"
          : "flex min-w-0 p-1"
      }
    >
      {options.map((option) => {
        const button = (
          <button
            type="button"
            aria-pressed={
              option.unavailable ? undefined : option.value === value
            }
            disabled={Boolean(option.unavailable)}
            onClick={() => onChange(option.value)}
            className={`view-button [&_svg]:size-4 [&_svg]:shrink-0 ${
              grid
                ? "min-h-9 w-full min-w-0 px-2 tracking-[0.08em]"
                : "px-3 tracking-[0.14em]"
            } ${option.unavailable ? "opacity-40" : ""} ${
              option.value === value ? "view-button-active" : ""
            }`}
          >
            {option.icon} {option.label}
          </button>
        );
        return option.unavailable ? (
          <Tooltip key={option.value} content={option.unavailable}>
            {button}
          </Tooltip>
        ) : (
          <Fragment key={option.value}>{button}</Fragment>
        );
      })}
    </div>
  );
  if (!grid) return track;
  return (
    <div>
      <p
        aria-hidden="true"
        className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/45"
      >
        {caption}
      </p>
      {track}
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
  const [projectContextOpen, setProjectContextOpen] = useState(false);
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
    currentUserId,
    demoMode,
    isMyTasks,
    myTasksName,
    previewing,
    projectFavorite,
    projectFavoritePending,
    projectDetailsHref,
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
    onProjectLinksSaved,
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
  // Actions belonging to the selected project or category, as opposed to the
  // board/list switch, which changes how any scope renders. Below `sm` these
  // collapse into one menu beside the title; archived views of a personal or
  // team workspace have none of them.
  const canEditScope = Boolean(
    (selectedProject || selectedCategory) && !previewing,
  );
  const hasScopeActions = Boolean(
    showFavorite || (selectedProject && projectDetailsHref) || canEditScope,
  );
  // The menu carries the filters as well as the scope's own actions, so it is
  // never empty and the trigger always has something to open.
  const scopeActionsLabel = selectedProject
    ? "Project options"
    : selectedCategory
      ? "Category options"
      : "Workspace options";
  const viewOptions: WorkspaceSwitchOption[] = [
    { value: "board", label: "Board", icon: <FiGrid aria-hidden /> },
    { value: "list", label: "List", icon: <FiList aria-hidden /> },
  ];
  const assigneeOptions: WorkspaceSwitchOption[] = [
    { value: "all", label: "All" },
    {
      value: myTasksName,
      label: "Mine",
      unavailable: viewingAsGroup
        ? "Mine is unavailable when viewing as an access group because a group is not a task assignee."
        : undefined,
    },
  ];
  const statusOptions: WorkspaceSwitchOption[] = [
    { value: "active", label: "Active" },
    { value: "archived", label: "Archive", icon: <FiArchive aria-hidden /> },
  ];
  // A third person's name matches neither option, which is what the old markup
  // did too: All and Mine both read as unpressed.
  const assigneeValue = isMyTasks ? myTasksName : assignee;
  // View goes last: archived work has no board, so the switch drops out, and
  // at the bottom of the stack nothing above it moves when it does.
  const filterSwitches = (
    <>
      <WorkspaceSwitch
        variant="grid"
        caption="Assignee"
        ariaLabel="Task assignee"
        options={assigneeOptions}
        value={assigneeValue}
        onChange={onSetAssignee}
      />
      <WorkspaceSwitch
        variant="grid"
        caption="Status"
        ariaLabel="Task status"
        options={statusOptions}
        value={visibility}
        onChange={(next) => onSetVisibility(next as "active" | "archived")}
      />
      {visibility === "active" && (
        <WorkspaceSwitch
          variant="grid"
          caption="View"
          ariaLabel="Task layout"
          options={viewOptions}
          value={view}
          onChange={(next) => onSetView(next as "board" | "list")}
        />
      )}
    </>
  );
  const projectAttachments = useResourceAttachments({
    kind: "project",
    resourceId: selectedProject?.id,
    demoMode,
    currentUserId,
  });
  const categoryAttachments = useResourceAttachments({
    kind: "category",
    resourceId: selectedCategory?.id,
    demoMode,
    currentUserId,
  });
  // Only reserve space for attachments that are actually coming. A resource
  // counted at zero skips the placeholder, so an empty project no longer
  // flashes an Attachments heading that removes itself a moment later.
  const projectAttachmentsPending =
    projectAttachments.loading && projectAttachmentCount !== 0;
  const categoryAttachmentsPending =
    categoryAttachments.loading && categoryAttachmentCount !== 0;
  // One badge, two slots. Below `xl` the count rides the eyebrow line, where
  // there is room to spare; from `xl` up it closes the toolbar's right edge
  // alongside the description instead.
  const taskCountBadge = (
    <CountBadge label="task" variant="ghost" className="task-workspace-count">
      {taskCount}
    </CountBadge>
  );
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-black/50 dark:text-white/50">
          {selectedProject
            ? "Project workspace"
            : selectedCategory
              ? "Category workspace"
              : isMyTasks
                ? "Personal workspace"
                : "Team workspace"}
        </p>
        <span className="shrink-0 xl:hidden">{taskCountBadge}</span>
      </div>
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-x-8 xl:gap-y-0">
        <div className="min-w-0 flex-1 xl:contents">
          <div className="flex min-w-0 items-center gap-2 max-sm:flex-wrap xl:col-start-1 xl:row-start-1">
            <div className="flex min-w-0 max-w-full items-center gap-2">
              <Heading size="h1" className="min-w-0 text-2xl sm:text-4xl">
                {viewTitle}
              </Heading>
              <DropdownMenu>
                <DropdownMenuButton
                  unstyled
                  aria-label={scopeActionsLabel}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black/50 transition hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 data-open:bg-black/5 data-open:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/30 dark:data-open:bg-white/10 dark:data-open:text-white sm:hidden"
                >
                  <FiChevronDown aria-hidden size={18} />
                </DropdownMenuButton>
                <DropdownMenuItems
                  align="start"
                  className="w-64 [--anchor-padding:16px]"
                >
                  {showFavorite && (
                    <DropdownMenuItem
                      disabled={projectFavoritePending}
                      onClick={onToggleProjectFavorite}
                    >
                      <FiStar
                        aria-hidden
                        className={projectFavorite ? "text-amber-500" : ""}
                        fill={projectFavorite ? "currentColor" : "none"}
                      />
                      {projectFavorite
                        ? "Remove from favorites"
                        : "Add to favorites"}
                    </DropdownMenuItem>
                  )}
                  {selectedProject && projectDetailsHref && (
                    <DropdownMenuItem.Link href={projectDetailsHref}>
                      <FiExternalLink aria-hidden /> Project details
                    </DropdownMenuItem.Link>
                  )}
                  {selectedProject && !previewing && (
                    <DropdownMenuItem onClick={onEditProject}>
                      <FiEdit2 aria-hidden /> Edit project
                    </DropdownMenuItem>
                  )}
                  {selectedCategory && !previewing && (
                    <DropdownMenuItem onClick={onEditCategory}>
                      <FiEdit2 aria-hidden /> Edit category
                    </DropdownMenuItem>
                  )}
                  {hasScopeActions && <DropdownMenuSeparator />}
                  <div className="space-y-2 px-3 pb-1 pt-2">
                    {filterSwitches}
                  </div>
                </DropdownMenuItems>
              </DropdownMenu>
            </div>
            {/* The title and its menu trigger travel together; below `sm` the
              badge wraps onto its own line rather than squeezing the title,
              so archiving never moves the trigger or the menu anchored to it. */}
            {visibility === "archived" && (
              <Pill
                variant="neutral"
                size="sm"
                className="shrink-0 gap-1 !px-2 !py-0.5 !text-[10px] font-medium !tracking-[0.12em]"
              >
                <FiArchive aria-hidden /> Archived
              </Pill>
            )}
            {hasScopeActions && (
              <div
                data-workspace-title-actions=""
                className="hidden w-auto items-center gap-2 sm:flex"
              >
                {showFavorite && (
                  <ProjectFavoriteButton
                    projectName={selectedProject?.name ?? "project"}
                    favorite={projectFavorite}
                    pending={projectFavoritePending}
                    size="md"
                    onToggle={onToggleProjectFavorite}
                  />
                )}
                {selectedProject && projectDetailsHref && (
                  <IconButton.Link
                    href={projectDetailsHref}
                    label={`Open ${selectedProject.name} project details`}
                    size="md"
                    tooltipPlacement="bottom"
                  >
                    <FiExternalLink aria-hidden />
                  </IconButton.Link>
                )}
                {selectedProject && !previewing && (
                  <IconButton
                    label="Edit project"
                    size="md"
                    tooltipPlacement="bottom"
                    onClick={onEditProject}
                  >
                    <FiEdit2 aria-hidden />
                  </IconButton>
                )}
                {selectedCategory && !previewing && (
                  <IconButton
                    label="Edit category"
                    size="md"
                    tooltipPlacement="bottom"
                    onClick={onEditCategory}
                  >
                    <FiEdit2 aria-hidden />
                  </IconButton>
                )}
              </div>
            )}
          </div>
          {scopeDescription && (
            <p className="mt-2 max-w-[85ch] text-sm text-black/70 dark:text-white/70 sm:text-base xl:col-start-1 xl:row-start-2 xl:self-baseline">
              {scopeDescription}
            </p>
          )}
          <div className="xl:col-start-1 xl:row-start-3">
            {selectedProject && (
              <WorkspaceHeaderDetails
                label="Project details"
                icon={<FiFolder aria-hidden />}
                open={projectDetailsOpen}
                setOpen={setProjectDetailsOpen}
                desktop={desktopDetails}
              >
                <div className="min-w-0">
                  <div className="mb-1 flex min-h-8 items-center">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                      Owners
                    </p>
                  </div>
                  <div className="flex min-h-8 min-w-0 items-center gap-3">
                    {projectOwners.length > 0 ? (
                      <div
                        className="flex shrink-0 -space-x-2"
                        aria-label={`${projectOwners.length} ${projectOwners.length === 1 ? "project owner" : "project owners"}`}
                      >
                        {projectOwners.slice(0, 3).map((owner) => (
                          <Tooltip
                            key={owner.id}
                            content={owner.full_name}
                            placement="bottom"
                          >
                            <Avatar
                              name={owner.full_name}
                              src={owner.avatar_url}
                              size="md"
                              className="ring-2 ring-[#f1f2ef] dark:ring-[#101010]"
                            />
                          </Tooltip>
                        ))}
                      </div>
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
                {(!previewing ||
                  selectedProject.links.length > 0 ||
                  projectAttachmentsPending ||
                  projectAttachments.notes.length > 0 ||
                  projectAttachments.files.length > 0) && (
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex min-h-8 items-center gap-1">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                        Project context
                      </p>
                      {!previewing && (
                        <IconButton
                          label="Manage project context"
                          size="sm"
                          variant="plain"
                          tooltipPlacement="bottom"
                          onClick={() => setProjectContextOpen(true)}
                        >
                          <FiEdit2 aria-hidden />
                        </IconButton>
                      )}
                    </div>
                    <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
                      {selectedProject.links.length > 0 && (
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
                            Links
                          </p>
                          <ResourceLinks links={selectedProject.links} />
                        </div>
                      )}
                      {projectAttachmentsPending ? (
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
                            Notes &amp; files
                          </p>
                          <ResourceChipsSkeleton
                            count={projectAttachmentCount}
                            label="Loading project attachments"
                          />
                        </div>
                      ) : (
                        <>
                          {projectAttachments.notes.length > 0 && (
                            <div className="flex min-w-0 flex-col gap-1.5">
                              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
                                Notes
                              </p>
                              <ResourceAttachmentsPreview
                                notes={projectAttachments.notes}
                                files={[]}
                              />
                            </div>
                          )}
                          {projectAttachments.files.length > 0 && (
                            <div className="flex min-w-0 flex-col gap-1.5">
                              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
                                Files
                              </p>
                              <ResourceAttachmentsPreview
                                notes={[]}
                                files={projectAttachments.files}
                              />
                            </div>
                          )}
                        </>
                      )}
                      {!projectAttachmentsPending &&
                        selectedProject.links.length === 0 &&
                        projectAttachments.notes.length === 0 &&
                        projectAttachments.files.length === 0 && (
                          <p className="text-xs text-black/45 dark:text-white/45">
                            No links, notes, or files yet.
                          </p>
                        )}
                    </div>
                  </div>
                )}
              </WorkspaceHeaderDetails>
            )}
            {selectedProject && !previewing && projectContextOpen && (
              <ProjectContextDialog
                project={selectedProject}
                attachments={[
                  ...projectAttachments.notes,
                  ...projectAttachments.files,
                ]}
                demoMode={demoMode}
                currentUserId={currentUserId}
                onClose={() => setProjectContextOpen(false)}
                onLinksSaved={onProjectLinksSaved}
              />
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
        </div>
        <div className="hidden w-full flex-col gap-2 sm:flex xl:contents">
          <div
            data-task-toolbar=""
            className="flex flex-nowrap items-center justify-end self-end rounded-xl border border-black/10 bg-white p-0.5 dark:border-white/10 dark:bg-white/5 xl:col-start-2 xl:row-start-1 xl:justify-self-end xl:self-start"
          >
            {/* Archived work has no board lanes. Keep the status switch at the
              trailing edge when the board/list switch disappears. */}
            {visibility === "active" && (
              <WorkspaceSwitch
                caption="View"
                ariaLabel="Task layout"
                options={viewOptions}
                value={view}
                onChange={(next) => onSetView(next as "board" | "list")}
              />
            )}
            <div
              className={
                visibility === "active"
                  ? "border-l border-black/10 dark:border-white/10"
                  : ""
              }
            >
              <WorkspaceSwitch
                caption="Assignee"
                ariaLabel="Task assignee"
                options={assigneeOptions}
                value={assigneeValue}
                onChange={onSetAssignee}
              />
            </div>
            <div className="border-l border-black/10 dark:border-white/10">
              <WorkspaceSwitch
                caption="Status"
                ariaLabel="Task status"
                options={statusOptions}
                value={visibility}
                onChange={(next) =>
                  onSetVisibility(next as "active" | "archived")
                }
              />
            </div>
          </div>
          <div className="hidden xl:col-start-2 xl:row-start-2 xl:mr-2 xl:block xl:justify-self-end xl:self-baseline">
            {taskCountBadge}
          </div>
        </div>
      </div>
    </div>
  );
}
