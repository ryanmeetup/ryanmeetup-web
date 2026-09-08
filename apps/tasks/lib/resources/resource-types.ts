export type ResourceLink = {
  label: string;
  url: string;
};

/** @deprecated Use ResourceLink. */
export type ProjectLink = ResourceLink;

export type ProjectStatus =
  | "discovery"
  | "queued"
  | "active"
  | "complete"
  | "paused";

export type Category = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  links: ResourceLink[];
  tags: string[];
  created_by: string;
  archived_at: string | null;
  access_mode: "open" | "restricted";
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  links: ResourceLink[];
  created_by: string;
  archived_at: string | null;
  created_at: string;
  /** The day work began. Null reads as `created_at`. */
  start_date: string | null;
  /** The day the work is meant to land. Never earlier than `start_date`. */
  due_date: string | null;
  status: ProjectStatus;
  access_mode: "owners" | "open" | "restricted";
};

export type ProjectAttachment = {
  id: string;
  project_id: string;
  kind: "note" | "file";
  name: string;
  body: string | null;
  url: string;
  file_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: string;
  created_at: string;
  sort_order: number;
};

export type CategoryAttachment = Omit<ProjectAttachment, "project_id"> & {
  category_id: string;
};

export type ResourceAttachment = ProjectAttachment | CategoryAttachment;

export type Note = {
  id: string;
  title: string | null;
  body: string;
  category_id: string | null;
  created_by: string;
  converted_task_id: string | null;
  converted_project_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type NoteComment = {
  id: string;
  note_id: string;
  body: string;
  created_by: string;
  created_at: string;
  edited_at: string | null;
};

export type ProjectOwner = { project_id: string; profile_id: string };
export type CategoryOwner = { category_id: string; profile_id: string };
