import "server-only";
import { getAdminClient } from "@/lib/server/admin-client";
import type { AppOwnerContact } from "@/lib/access/access-types";
import { requireQueryData } from "@/lib/server/workspace-loader";

/**
 * Who to ask for access: this instance's app owners, by name. A guest reads
 * only their own profile, so the names come through the privileged client,
 * and only names and avatars leave it. Never hardcode a person here — each
 * instance has its own owners.
 */
export async function loadAppOwnerContacts(): Promise<AppOwnerContact[]> {
  const admin = getAdminClient();
  if (!admin) return [];
  const owners = requireQueryData(
    "app owner contacts",
    await admin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("app_role", "owner")
      .order("full_name"),
  );
  return owners.flatMap((owner) =>
    owner.full_name?.trim()
      ? [
          {
            id: owner.id,
            name: owner.full_name.trim(),
            avatarUrl: owner.avatar_url,
          },
        ]
      : [],
  );
}
