"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Button,
  Avatar,
  DropdownMenu,
  DropdownMenuButton,
  DropdownMenuItem,
  DropdownMenuItems,
  DropdownMenuSeparator,
} from "@ryanmeetup/ui";
import {
  FiCheckSquare,
  FiChevronDown,
  FiFolder,
  FiLogOut,
  FiMenu,
  FiMoon,
  FiPlus,
  FiSliders,
  FiSun,
  FiTag,
  FiUser,
} from "react-icons/fi";
import type { Profile } from "@/lib/workspace/workspace-types";
import { editorTriggers, ThemeToggle, useTheme } from "@/components/global";
import { ADMIN_ROOT } from "@/lib/admin/admin-routes";
import { HeaderProfileControls } from "./HeaderProfileControls";
import { createClient } from "@/lib/supabase/client";
import { profileDisplayName } from "@/lib/presentation";

/**
 * Icon only where the header is tight, icon and label from `sm` up. Both halves
 * of the trigger pair wear it, because either one can now be the half that
 * renders at every width.
 */
const newTaskClassName =
  "max-sm:gap-0 max-sm:px-3 [&>span:last-child]:hidden sm:gap-2 sm:px-4 sm:[&>span:last-child]:inline";

/**
 * The create menu's trigger, for when there is more than one thing to create.
 * It wears the New task button's look: icon only on a phone, icon, label, and
 * chevron from `sm` up.
 */
const createTriggerClassName =
  "relative inline-flex items-center justify-center gap-2 rounded-lg border border-black/60 bg-black px-3 py-2 text-sm/4 font-semibold text-white sm:px-4 shadow-lg transition hover:border-black/80 hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 data-open:bg-black/90 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-white/90 dark:focus-visible:ring-white/30 dark:data-open:bg-white/90";

export function TaskHeaderActions({
  profile,
  demoMode,
  canCreateTasks = true,
  canCreateProjects = false,
  canCreateCategories = false,
  onNewTask,
  onCreateProject,
  onCreateCategory,
}: {
  profile: Profile;
  demoMode: boolean;
  canCreateTasks?: boolean;
  canCreateProjects?: boolean;
  canCreateCategories?: boolean;
  onNewTask: () => void;
  onCreateProject?: () => void;
  onCreateCategory?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  // Demo builds hide /admin entirely, so the entry points go with it.
  const isOwner = !demoMode && profile.app_role === "owner";
  const profileName = profileDisplayName(profile);
  const triggers = editorTriggers(profile.editor_surface);
  // One menu offers everything this person can create. It is the workspace's
  // only create entry point; the sidebar no longer carries its own. With only
  // tasks to create it stays the plain New task button.
  const createMenu =
    canCreateTasks && (canCreateProjects || canCreateCategories);
  return (
    <>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
        {isOwner && (
          <span className="hidden items-center gap-3 sm:flex">
            <Button.Link
              href={ADMIN_ROOT}
              variant="secondary"
              size="sm"
              leftIcon={<FiSliders />}
            >
              Admin
            </Button.Link>
          </span>
        )}
        <span className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuButton
              unstyled
              aria-label="Open account and workspace settings"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 text-black transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:text-white dark:hover:bg-white/10 dark:focus-visible:ring-white/30"
            >
              <FiMenu aria-hidden />
            </DropdownMenuButton>
            <DropdownMenuItems align="end">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={profileName} src={profile.avatar_url} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {profileName}
                  </span>
                  <span className="block text-[10px] uppercase tracking-widest text-black/45 dark:text-white/45">
                    {profile.app_role === "owner" ? "Owner" : "Team member"}
                    {demoMode ? " · Demo" : ""}
                  </span>
                </span>
              </div>
              <DropdownMenuSeparator />
              {!demoMode && (
                <>
                  <div
                    id="mobile-account-menu-account"
                    className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-black/45 dark:text-white/45"
                  >
                    Account
                  </div>
                  <div
                    role="group"
                    aria-labelledby="mobile-account-menu-account"
                  >
                    <DropdownMenuItem onClick={() => router.push("/profile")}>
                      <FiUser aria-hidden /> View profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        await createClient().auth.signOut();
                        router.replace("/login");
                        router.refresh();
                      }}
                    >
                      <FiLogOut aria-hidden /> Sign out
                    </DropdownMenuItem>
                  </div>
                </>
              )}
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <div
                    id="mobile-account-menu-admin"
                    className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-black/45 dark:text-white/45"
                  >
                    Admin
                  </div>
                  <div role="group" aria-labelledby="mobile-account-menu-admin">
                    <DropdownMenuItem onClick={() => router.push(ADMIN_ROOT)}>
                      <FiSliders aria-hidden /> Admin
                    </DropdownMenuItem>
                  </div>
                </>
              )}
              <DropdownMenuSeparator />
              <div
                id="mobile-account-menu-preferences"
                className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-black/45 dark:text-white/45"
              >
                Preferences
              </div>
              <div
                role="group"
                aria-labelledby="mobile-account-menu-preferences"
              >
                <DropdownMenuItem
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? (
                    <FiSun aria-hidden />
                  ) : (
                    <FiMoon aria-hidden />
                  )}
                  Use {theme === "dark" ? "light" : "dark"} theme
                </DropdownMenuItem>
              </div>
            </DropdownMenuItems>
          </DropdownMenu>
        </span>
        {createMenu && (
          <DropdownMenu>
            <DropdownMenuButton
              unstyled
              aria-label="Create new"
              className={createTriggerClassName}
            >
              <span className="text-base">
                <FiPlus aria-hidden />
              </span>
              <span className="hidden sm:inline">New</span>
              <FiChevronDown aria-hidden className="hidden sm:block" />
            </DropdownMenuButton>
            <DropdownMenuItems align="end">
              {/*
                  Each entry is a route/dialog pair, as everywhere else: on the
                  default preference the route half shows on a phone and the
                  dialog half from `sm` up.
                */}
              {triggers.route && (
                <DropdownMenuItem.Link
                  href="/task/new"
                  className={triggers.routeClassName}
                >
                  <FiCheckSquare aria-hidden /> New task
                </DropdownMenuItem.Link>
              )}
              {triggers.dialog && (
                <DropdownMenuItem
                  className={triggers.dialogClassName}
                  onClick={onNewTask}
                >
                  <FiCheckSquare aria-hidden /> New task
                </DropdownMenuItem>
              )}
              {canCreateProjects && (
                <>
                  {triggers.route && (
                    <DropdownMenuItem.Link
                      href={`/projects/new?from=${encodeURIComponent(pathname)}`}
                      className={triggers.routeClassName}
                    >
                      <FiFolder aria-hidden /> New project
                    </DropdownMenuItem.Link>
                  )}
                  {triggers.dialog && onCreateProject && (
                    <DropdownMenuItem
                      className={triggers.dialogClassName}
                      onClick={onCreateProject}
                    >
                      <FiFolder aria-hidden /> New project
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {canCreateCategories && (
                <>
                  {triggers.route && (
                    <DropdownMenuItem.Link
                      href={`/categories/new?from=${encodeURIComponent(pathname)}`}
                      className={triggers.routeClassName}
                    >
                      <FiTag aria-hidden /> New category
                    </DropdownMenuItem.Link>
                  )}
                  {triggers.dialog && onCreateCategory && (
                    <DropdownMenuItem
                      className={triggers.dialogClassName}
                      onClick={onCreateCategory}
                    >
                      <FiTag aria-hidden /> New category
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuItems>
          </DropdownMenu>
        )}
        {canCreateTasks && !createMenu && (
          <>
            {/*
              One control, two surfaces. The link goes to the dedicated create
              page; the button opens the dialog over whatever the author was
              looking at. On the default preference both are rendered and the
              breakpoint hides one, so the choice never depends on JavaScript
              measuring the viewport. See components/global/editor-routes.ts.
            */}
            {triggers.route && (
              <Button.Link
                href="/task/new"
                size="sm"
                leftIcon={<FiPlus />}
                aria-label="New task"
                className={`${newTaskClassName} ${triggers.routeClassName}`}
              >
                New task
              </Button.Link>
            )}
            {triggers.dialog && (
              <Button
                size="sm"
                leftIcon={<FiPlus />}
                onClick={onNewTask}
                aria-label="New task"
                className={`${newTaskClassName} ${triggers.dialogClassName}`}
              >
                New task
              </Button>
            )}
          </>
        )}
        {/* The theme is the viewer's own, so it stays usable in a preview. */}
        <span className="hidden sm:inline-flex" data-preview-allow>
          <ThemeToggle />
        </span>
        <span className="hidden sm:inline-flex">
          <HeaderProfileControls profile={profile} demoMode={demoMode} />
        </span>
      </div>
    </>
  );
}
