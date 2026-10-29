"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, IconButton, Tooltip } from "@ryanmeetup/ui";
import { FiLogOut } from "react-icons/fi";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/workspace/workspace-types";
import { profileDisplayName } from "@/lib/presentation";

export function HeaderProfileControls({
  demoMode,
  profile,
}: {
  demoMode: boolean;
  profile: Profile;
}) {
  const router = useRouter();
  const name = profileDisplayName(profile);
  const summary = (
    <>
      <Avatar name={name} src={profile.avatar_url} />
      <span className="hidden min-w-0 2xl:block">
        <span className="block max-w-36 truncate text-sm font-semibold">
          {name}
        </span>
        <span className="block text-[10px] uppercase tracking-widest text-black/45 dark:text-white/45">
          {profile.app_role === "owner" ? "Owner" : "Team member"}
          {demoMode ? " · Demo" : ""}
        </span>
      </span>
    </>
  );

  return (
    <div className="flex shrink-0 items-center gap-1 border-l border-black/10 pl-1.5 dark:border-white/10 sm:gap-2 sm:pl-3">
      {demoMode ? (
        <div className="flex min-w-0 items-center gap-2">{summary}</div>
      ) : (
        <Tooltip content="View profile">
          <Link
            href="/profile"
            aria-label={`View ${name}'s profile`}
            className="flex min-w-0 items-center gap-2 rounded-lg transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:hover:bg-white/10 dark:focus-visible:ring-white/40 2xl:px-2 2xl:py-1"
          >
            {summary}
          </Link>
        </Tooltip>
      )}
      {!demoMode && (
        <span className="hidden sm:inline-flex">
          <IconButton
            label="Sign out"
            onClick={async () => {
              await createClient().auth.signOut();
              router.push("/login");
              router.refresh();
            }}
          >
            <FiLogOut />
          </IconButton>
        </span>
      )}
    </div>
  );
}
