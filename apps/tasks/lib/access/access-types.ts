export type AccessGroup = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  kind: "tier" | "team";
  hierarchy_rank: number | null;
  grants_global_content: boolean;
  calendar_access: boolean;
  /** A tier whose members skip every open-to-the-workspace rule. */
  guest: boolean;
  is_default: boolean;
};

export type GroupMember = {
  group_id: string;
  profile_id: string;
  added_by: string;
  created_at: string;
};

export type UserAccessMetadata = {
  profileId: string;
  email: string | null;
  invitedAt: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  assigned: number;
  assignedOpen: number;
  assignedCompleted: number;
  created: number;
  reported: number;
};
