"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  ErrorCallout,
  Modal,
  ModalActions,
} from "@ryanmeetup/ui";
import { FiLock, FiLogOut, FiUser } from "react-icons/fi";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "@/components/auth";
import { CategoriesModal } from "@/components/categories";
import { categoryController } from "@/components/categories/category-workspace";
import {
  InstanceWordmark,
  PageHeader,
  ThemeToggle,
  WorkspacePageShell,
} from "@/components/global";
import { ProjectsModal } from "@/components/projects";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

export function ProfilePageClient({
  initialData,
  email,
  onboardingRequired,
  workspaceLoadReference,
  entryReason,
  returnTo,
}: {
  initialData: WorkspaceData;
  email: string;
  onboardingRequired: boolean;
  workspaceLoadReference?: string;
  entryReason?: "onboarding";
  returnTo: string;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const passwordFormId = "change-password-form";

  // Onboarding is a gate, not a page inside the workspace: every other route
  // redirects back here until the profile is complete, so showing the sidebar
  // and header would only offer links that bounce straight back. Sign out is
  // the one way forward other than finishing the form.
  if (onboardingRequired)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f1f2ef] px-4 py-12 text-black dark:bg-[#101010] dark:text-white">
        <div className="fixed right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
          <ThemeToggle />
          <Button
            variant="secondary"
            leftIcon={<FiLogOut />}
            onClick={async () => {
              await createClient().auth.signOut();
              router.push("/login");
              router.refresh();
            }}
          >
            Sign out
          </Button>
        </div>
        <Card className="w-full max-w-lg" size="lg">
          <p className="mb-6 text-center font-cooper text-2xl uppercase tracking-[0.08em] sm:text-3xl">
            <InstanceWordmark />
          </p>
          <PageHeader
            kicker="Welcome"
            icon={FiUser}
            title="Complete your profile"
            description="Choose your sign-in password and confirm how your name appears before continuing."
          />
          {entryReason === "onboarding" ? (
            <p className="mt-6 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm font-semibold leading-relaxed text-blue-800 dark:border-blue-400/25 dark:text-blue-200">
              This one-time step is required before the rest of the workspace
              opens. After saving, you’ll return to where you were headed.
            </p>
          ) : null}
          {workspaceLoadReference ? (
            <ErrorCallout className="mt-6">
              The rest of the workspace could not be loaded. You can still
              complete your profile, but if this continues, share reference{" "}
              <code>{workspaceLoadReference}</code>.
            </ErrorCallout>
          ) : null}
          <div className="mt-8 border-t border-black/10 pt-8 dark:border-white/10">
            <ProfileForm
              profile={data.currentProfile}
              email={email}
              onboardingRequired
              returnTo={returnTo}
              onChangePassword={() => undefined}
            />
          </div>
        </Card>
      </main>
    );

  return (
    <>
      <WorkspacePageShell
        data={data}
        demoMode={false}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onCreateCategory={() => setCategoryOpen(true)}
        onCreateProject={() => setProjectOpen(true)}
        setData={setData}
        contentClassName="p-4 sm:p-6 lg:p-8"
      >
        <div className="mx-auto w-full min-w-0 max-w-5xl">
          <PageHeader
            kicker="Your account"
            icon={FiUser}
            title="Profile"
            description="Manage how teammates see you across the workspace."
          />
          {workspaceLoadReference ? (
            <ErrorCallout className="mt-6">
              Your profile loaded, but the rest of the workspace did not. Try
              again in a moment, and share reference{" "}
              <code>{workspaceLoadReference}</code> if the problem continues.
            </ErrorCallout>
          ) : null}
          <div className="mt-10">
            <ProfileForm
              profile={data.currentProfile}
              email={email}
              onboardingRequired={false}
              returnTo="/"
              onChangePassword={() => setPasswordOpen(true)}
            />
          </div>
        </div>
      </WorkspacePageShell>
      {categoryOpen && (
        <CategoriesModal
          modal={{ open: categoryOpen, setOpen: setCategoryOpen }}
          controller={categoryController(data, setData, false)}
          options={{ createOnly: true }}
        />
      )}
      {projectOpen && (
        <ProjectsModal
          modal={{ open: projectOpen, setOpen: setProjectOpen }}
          workspace={{ data, setData, demoMode: false }}
          options={{ createOnly: true }}
        />
      )}
      {passwordOpen && (
        <Modal
          open={passwordOpen}
          setIsOpen={setPasswordOpen}
          title="Change Password"
          actions={
            <ModalActions
              confirmForm={passwordFormId}
              confirmIcon={<FiLock />}
              confirmLabel="Update password"
              onCancel={() => setPasswordOpen(false)}
              pending={passwordSaving}
              pendingLabel="Updating..."
            />
          }
        >
          <p className="mb-6 text-sm text-black/65 dark:text-white/65">
            Choose a new password for your account.
          </p>
          <PasswordForm
            email={email}
            formId={passwordFormId}
            hideSubmit
            onSavingChange={setPasswordSaving}
          />
        </Modal>
      )}
    </>
  );
}
