"use client";

import { useRouter } from "next/navigation";
import { Button, Card, ErrorCallout, Heading } from "@ryanmeetup/ui";
import { FiLogOut, FiRefreshCw } from "react-icons/fi";
import { InstanceWordmark, ThemeToggle } from "@/components/global";
import { createClient } from "@/lib/supabase/client";

export function AccountProvisioningError() {
  const router = useRouter();
  return (
    <main className="grid min-h-screen place-items-center bg-[#f1f2ef] px-4 py-12 text-black dark:bg-[#101010] dark:text-white">
      <div className="fixed right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-lg" size="lg">
        <p className="mb-6 text-center font-cooper text-2xl uppercase tracking-caps-tight sm:text-3xl">
          <InstanceWordmark />
        </p>
        <Heading size="h1">Your account needs provisioning</Heading>
        <ErrorCallout className="mt-5">
          You’re signed in, but your workspace profile was not created. Nothing
          is wrong with your password. Try again, then ask an owner to check
          Workspace foundation in Admin if this continues.
        </ErrorCallout>
        <div className="mt-6 grid gap-3 sm:flex sm:justify-end">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<FiLogOut />}
            onClick={async () => {
              await createClient().auth.signOut();
              router.replace("/login");
              router.refresh();
            }}
          >
            Sign out
          </Button>
          <Button size="md" leftIcon={<FiRefreshCw />} onClick={() => router.refresh()}>
            Try again
          </Button>
        </div>
      </Card>
    </main>
  );
}
