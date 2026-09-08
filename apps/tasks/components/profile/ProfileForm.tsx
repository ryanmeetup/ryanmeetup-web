"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  DropdownSelect,
  ErrorCallout,
  Heading,
  Input,
  SuccessCallout,
  toast,
} from "@ryanmeetup/ui";
import { FiLock, FiSave } from "react-icons/fi";
import type { Profile } from "@/lib/workspace/workspace-types";
import { mutate } from "@/lib/mutation-client";
import { errorMessage as getErrorMessage } from "@/lib/presentation";
import { displayNameError, normalizeDisplayName } from "@/lib/display-name";
import { createClient } from "@/lib/supabase/client";
import {
  editorSurfaceOptions,
  isEditorSurface,
  type EditorSurfacePreference,
} from "@/lib/workspace/editor-surface";
import {
  filterPanelsExpandedPreferenceKey,
  paginationPageSizePreferenceKey,
} from "@/lib/user-preferences";
import { ProfileAvatarField } from "./ProfileAvatarField";
import {
  calendarDefaultViewOptions,
  isCalendarDefaultView,
  type CalendarDefaultView,
} from "@/lib/calendar/calendar-view-preference";

const avatarTypes = ["image/jpeg", "image/png", "image/webp"];
const maxAvatarSize = 5 * 1024 * 1024;

export function ProfileForm({
  profile,
  email,
  onboardingRequired,
  returnTo,
  onChangePassword,
}: {
  profile: Profile;
  email: string;
  onboardingRequired: boolean;
  returnTo: string;
  onChangePassword: () => void;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.full_name || "");
  const [savedDisplayName, setSavedDisplayName] = useState(
    profile.full_name || "",
  );
  const [saving, setSaving] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url);
  const [taskDetailsOpenByDefault, setTaskDetailsOpenByDefault] = useState(
    profile.task_details_open_by_default,
  );
  const [assignNewTasksToSelf, setAssignNewTasksToSelf] = useState(
    profile.assign_new_tasks_to_self,
  );
  const [editorSurface, setEditorSurface] = useState(profile.editor_surface);
  const [calendarDefaultView, setCalendarDefaultView] = useState(
    profile.calendar_default_view,
  );
  const [paginationPageSize, setPaginationPageSize] = useState(
    10 as 10 | 25 | 50 | 100,
  );
  const [filterPanelsExpanded, setFilterPanelsExpanded] = useState(true);

  useEffect(() => {
    const saved = Number.parseInt(
      localStorage.getItem(paginationPageSizePreferenceKey) ?? "",
      10,
    );
    if ([10, 25, 50, 100].includes(saved))
      queueMicrotask(() => setPaginationPageSize(saved as 10 | 25 | 50 | 100));
    const savedFilterPreference = localStorage.getItem(
      filterPanelsExpandedPreferenceKey,
    );
    if (savedFilterPreference !== null)
      queueMicrotask(() =>
        setFilterPanelsExpanded(savedFilterPreference === "true"),
      );
  }, []);

  useEffect(
    () => () => {
      if (avatarPreview?.startsWith("blob:"))
        URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!avatarTypes.includes(file.type) || file.size > maxAvatarSize) {
      const errorMessage =
        "Choose a JPG, PNG, or WebP image that is 5 MB or smaller.";
      setMessage(errorMessage);
      setHasError(true);
      event.target.value = "";
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setMessage("");
    setHasError(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setHasError(false);
    const normalizedName = normalizeDisplayName(displayName);
    const validationError = displayNameError(normalizedName);
    if (validationError) {
      setMessage(validationError);
      setHasError(true);
      setSaving(false);
      return;
    }
    if (onboardingRequired && password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      setHasError(true);
      setSaving(false);
      return;
    }
    if (onboardingRequired && password !== passwordConfirmation) {
      setMessage("Passwords do not match.");
      setHasError(true);
      setSaving(false);
      return;
    }
    try {
      if (onboardingRequired) {
        const { error: passwordError } = await createClient().auth.updateUser({
          password,
        });
        if (passwordError) {
          // Supabase rejects a password identical to the current one, which
          // here is the temporary password an owner set for this account. Say
          // so plainly: the generic wording left people retyping the password
          // they were given.
          const passwordMessage =
            passwordError.code === "same_password"
              ? "That matches the temporary password you were given. Choose a new one so the old password stops working."
              : "Your password could not be set. Try a different password.";
          setMessage(passwordMessage);
          setHasError(true);
          toast.error(passwordMessage);
          return;
        }
      }
      let avatarPath: string | undefined;
      if (avatarFile) {
        avatarPath = `${profile.id}/avatar`;
        const { error: uploadError } = await createClient()
          .storage.from("profile-avatars")
          .upload(avatarPath, avatarFile, {
            cacheControl: "3600",
            contentType: avatarFile.type,
            upsert: true,
          });
        if (uploadError) throw uploadError;
      }
      const result = await mutate<{ profile: Profile }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: normalizedName,
          avatarPath,
          taskDetailsOpenByDefault,
          assignNewTasksToSelf,
          editorSurface,
          calendarDefaultView,
        }),
      });
      setDisplayName(result.profile.full_name || "");
      setSavedDisplayName(result.profile.full_name || "");
      setAvatarFile(null);
      setAvatarPreview(result.profile.avatar_url);
      if (onboardingRequired) {
        router.replace(returnTo);
        router.refresh();
        return;
      }
      setMessage("Profile saved.");
    } catch (error) {
      const errorMessage = getErrorMessage(
        error,
        "Your profile could not be saved.",
      );
      setMessage(errorMessage);
      setHasError(true);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function changeTaskDetailsPreference(nextValue: boolean) {
    const previousValue = taskDetailsOpenByDefault;
    setTaskDetailsOpenByDefault(nextValue);
    await savePreferences({ taskDetailsOpenByDefault: nextValue }, () =>
      setTaskDetailsOpenByDefault(previousValue),
    );
  }

  async function changeAssignToSelfPreference(nextValue: boolean) {
    const previousValue = assignNewTasksToSelf;
    setAssignNewTasksToSelf(nextValue);
    await savePreferences({ assignNewTasksToSelf: nextValue }, () =>
      setAssignNewTasksToSelf(previousValue),
    );
  }

  async function changeEditorSurfacePreference(
    nextValue: EditorSurfacePreference,
  ) {
    const previousValue = editorSurface;
    setEditorSurface(nextValue);
    await savePreferences({ editorSurface: nextValue }, () =>
      setEditorSurface(previousValue),
    );
    // Every create and edit trigger reads this off the profile its page was
    // server-rendered with, so the router cache would keep handing back the old
    // surface on the way out of here.
    router.refresh();
  }

  async function changeCalendarDefaultView(nextValue: CalendarDefaultView) {
    const previousValue = calendarDefaultView;
    setCalendarDefaultView(nextValue);
    await savePreferences({ calendarDefaultView: nextValue }, () =>
      setCalendarDefaultView(previousValue),
    );
    router.refresh();
  }

  async function savePreferences(
    changed: {
      taskDetailsOpenByDefault?: boolean;
      assignNewTasksToSelf?: boolean;
      editorSurface?: EditorSurfacePreference;
      calendarDefaultView?: CalendarDefaultView;
    },
    revert: () => void,
  ) {
    setSavingPreferences(true);
    setMessage("");
    setHasError(false);
    try {
      await mutate<{ profile: Profile }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: savedDisplayName,
          taskDetailsOpenByDefault,
          assignNewTasksToSelf,
          editorSurface,
          calendarDefaultView,
          ...changed,
        }),
      });
    } catch (error) {
      revert();
      const errorMessage = getErrorMessage(
        error,
        "Your preference could not be saved.",
      );
      setMessage(errorMessage);
      setHasError(true);
      toast.error(errorMessage);
    } finally {
      setSavingPreferences(false);
    }
  }

  function changeFilterPanelsPreference(nextValue: boolean) {
    setFilterPanelsExpanded(nextValue);
    localStorage.setItem(filterPanelsExpandedPreferenceKey, String(nextValue));
  }

  function changePaginationPageSize(nextValue: 10 | 25 | 50 | 100) {
    setPaginationPageSize(nextValue);
    localStorage.setItem(paginationPageSizePreferenceKey, String(nextValue));
  }

  // The labels are short enough to fit the control; what each one actually does
  // is the part worth spelling out, so the row's description follows the
  // selection rather than describing the setting in the abstract.
  const editorSurfaceDescription =
    editorSurfaceOptions.find((option) => option.value === editorSurface)
      ?.description ?? "";

  return (
    <form className="space-y-5" onSubmit={save}>
      <ProfileAvatarField
        preview={avatarPreview}
        fallbackName={displayName || profile.full_name || ""}
        disabled={saving}
        onChange={selectAvatar}
      />
      <Input
        label="Display name"
        name="display-name"
        required
        maxLength={80}
        autoComplete="name"
        autoFocus={onboardingRequired}
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="First and last name"
      />
      <p className="-mt-3 text-xs text-black/55 dark:text-white/55">
        Use your first and last name. This is how you appear on tasks, comments,
        and projects.
      </p>
      <Input
        label="Email"
        name="profile-email"
        type="email"
        value={email}
        readOnly
        onChange={() => undefined}
        inputClassName="cursor-default bg-black/[0.035] text-black/65 dark:bg-white/[0.035] dark:text-white/65"
      />
      <p className="-mt-3 text-xs text-black/55 dark:text-white/55">
        Your sign-in email cannot be changed here.
      </p>
      {onboardingRequired && (
        <>
          <Input
            label="Password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
          />
          <Input
            label="Confirm password"
            name="password-confirmation"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            placeholder="Enter it again"
          />
        </>
      )}
      <div className="grid gap-3 sm:flex sm:flex-wrap sm:justify-end">
        {!onboardingRequired && (
          <Button
            type="button"
            variant="secondary"
            leftIcon={<FiLock />}
            className="w-full sm:w-auto"
            onClick={onChangePassword}
          >
            Change password
          </Button>
        )}
        <Button
          type="submit"
          size={onboardingRequired ? "md" : "sm"}
          leftIcon={<FiSave />}
          className={onboardingRequired ? "w-full" : "w-full sm:w-auto"}
          loading={saving}
          loadingText="Saving..."
        >
          {onboardingRequired ? "Save and continue" : "Save profile"}
        </Button>
      </div>
      {onboardingRequired && (
        <p className="-mt-2 text-center text-xs text-black/55 dark:text-white/55">
          This saves your password, name, and photo, then takes you into the
          workspace.
        </p>
      )}
      {!onboardingRequired && (
        <section className="space-y-5 border-t border-black/10 pt-8 dark:border-white/10">
          <div>
            <Heading size="h2" className="text-2xl">
              Preferences
            </Heading>
            <p className="mt-2 text-sm text-black/65 dark:text-white/65">
              Choose how views and forms behave when you open them.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="flex cursor-pointer items-center justify-between gap-5 rounded-xl border border-black/10 bg-black/[0.02] p-4 transition hover:border-black/20 dark:border-white/10 dark:bg-white/[0.025] dark:hover:border-white/20">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  Open task details by default
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-black/55 dark:text-white/55">
                  Show checklists, attachments, comments, and activity whenever
                  you edit a task.
                </span>
              </span>
              <span className="relative inline-flex shrink-0">
                <input
                  type="checkbox"
                  role="switch"
                  checked={taskDetailsOpenByDefault}
                  disabled={saving || savingPreferences}
                  onChange={(event) =>
                    void changeTaskDetailsPreference(event.target.checked)
                  }
                  className="peer sr-only"
                />
                <span className="h-7 w-12 rounded-full bg-black/15 transition peer-checked:bg-black peer-focus-visible:ring-2 peer-focus-visible:ring-black/30 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-white/20 dark:peer-checked:bg-white dark:peer-focus-visible:ring-white/40 dark:peer-focus-visible:ring-offset-[#181818]" />
                <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 dark:bg-black" />
              </span>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-5 rounded-xl border border-black/10 bg-black/[0.02] p-4 transition hover:border-black/20 dark:border-white/10 dark:bg-white/[0.025] dark:hover:border-white/20">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  Assign new tasks to me
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-black/55 dark:text-white/55">
                  Start every task you create assigned to yourself. You can
                  still pick someone else before saving.
                </span>
              </span>
              <span className="relative inline-flex shrink-0">
                <input
                  type="checkbox"
                  role="switch"
                  checked={assignNewTasksToSelf}
                  disabled={saving || savingPreferences}
                  onChange={(event) =>
                    void changeAssignToSelfPreference(event.target.checked)
                  }
                  className="peer sr-only"
                />
                <span className="h-7 w-12 rounded-full bg-black/15 transition peer-checked:bg-black peer-focus-visible:ring-2 peer-focus-visible:ring-black/30 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-white/20 dark:peer-checked:bg-white dark:peer-focus-visible:ring-white/40 dark:peer-focus-visible:ring-offset-[#181818]" />
                <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 dark:bg-black" />
              </span>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-5 rounded-xl border border-black/10 bg-black/[0.02] p-4 transition hover:border-black/20 dark:border-white/10 dark:bg-white/[0.025] dark:hover:border-white/20">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  Expand filters by default
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-black/55 dark:text-white/55">
                  Show filtering controls automatically on boards, task lists,
                  and activity views.
                </span>
              </span>
              <span className="relative inline-flex shrink-0">
                <input
                  type="checkbox"
                  role="switch"
                  checked={filterPanelsExpanded}
                  disabled={saving || savingPreferences}
                  onChange={(event) =>
                    changeFilterPanelsPreference(event.target.checked)
                  }
                  className="peer sr-only"
                />
                <span className="h-7 w-12 rounded-full bg-black/15 transition peer-checked:bg-black peer-focus-visible:ring-2 peer-focus-visible:ring-black/30 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-white/20 dark:peer-checked:bg-white dark:peer-focus-visible:ring-white/40 dark:peer-focus-visible:ring-offset-[#181818]" />
                <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 dark:bg-black" />
              </span>
            </label>
            <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.025]">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  Create and edit forms
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-black/55 dark:text-white/55">
                  {editorSurfaceDescription}
                </span>
              </span>
              <DropdownSelect
                label="Open in"
                value={editorSurface}
                disabled={saving || savingPreferences}
                onChange={(value) => {
                  if (isEditorSurface(value))
                    void changeEditorSurfacePreference(value);
                }}
                options={editorSurfaceOptions.map((option) => ({
                  label: option.label,
                  value: option.value,
                }))}
              />
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.025]">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  Default calendar view
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-black/55 dark:text-white/55">
                  {calendarDefaultViewOptions.find(
                    (option) => option.value === calendarDefaultView,
                  )?.description ?? "Choose what appears when Calendar opens."}
                </span>
              </span>
              <DropdownSelect
                label="Show"
                value={calendarDefaultView}
                disabled={saving || savingPreferences}
                onChange={(value) => {
                  if (isCalendarDefaultView(value))
                    void changeCalendarDefaultView(value);
                }}
                options={calendarDefaultViewOptions.map((option) => ({
                  label: option.label,
                  value: option.value,
                }))}
              />
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.025]">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  Default rows per page
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-black/55 dark:text-white/55">
                  Used when opening task lists and activity without a page-size
                  override.
                </span>
              </span>
              <DropdownSelect
                label="Rows"
                value={String(paginationPageSize)}
                disabled={saving}
                onChange={(value) =>
                  changePaginationPageSize(
                    Number.parseInt(value, 10) as 10 | 25 | 50 | 100,
                  )
                }
                options={[10, 25, 50, 100].map((size) => ({
                  label: String(size),
                  value: String(size),
                }))}
              />
            </div>
          </div>
          <p className="text-sm text-black/65 dark:text-white/65">
            Preferences sync automatically when changed.
          </p>
        </section>
      )}
      {hasError ? (
        <ErrorCallout>{message}</ErrorCallout>
      ) : message ? (
        <SuccessCallout>{message}</SuccessCallout>
      ) : null}
    </form>
  );
}
