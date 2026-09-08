import type { TaskActivity } from "@/lib/activity/activity-types";
import type { WorkspaceAreaKey } from "@/lib/access/workspace-areas";
import type { EditorSurfacePreference } from "@/lib/workspace/editor-surface";
import type { CalendarDefaultView } from "@/lib/calendar/calendar-view-preference";
import type { PaginationState } from "@/lib/pagination";
import type {
  Category,
  CategoryOwner,
  Project,
  ProjectOwner,
} from "@/lib/resources/resource-types";
import type {
  Label,
  Status,
  Subtask,
  Task,
  TaskAssignee,
  TaskAttachment,
  TaskCategory,
  TaskComment,
  TaskLabel,
  TaskReference,
} from "@/lib/tasks/task-types";

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  onboarding_completed: boolean;
  task_details_open_by_default: boolean;
  assign_new_tasks_to_self: boolean;
  editor_surface: EditorSurfacePreference;
  calendar_default_view: CalendarDefaultView;
  favorite_project_ids?: string[];
  app_role?: "owner" | "member";
};

export type AccessPreview = {
  kind: "group" | "user";
  subjectId: string;
  subjectName: string;
  subjectProfile?: Profile;
  accessibleCategoryIds?: string[];
  inaccessibleTaskIds?: string[];
  accessibleAreas?: WorkspaceAreaKey[];
  calendarAccess?: boolean;
};

export type WorkspaceData = {
  tasks: Task[];
  taskReferences?: TaskReference[];
  statuses: Status[];
  categories: Category[];
  projects: Project[];
  projectTaskCounts?: Record<string, number>;
  /**
   * How many attachments each project and category holds, counted at page
   * load. Attachments themselves are fetched lazily by the view that shows
   * them; this lets a header reserve space only for a resource that actually
   * has some, rather than flashing a placeholder over every empty one. A count
   * can go stale against a later write - it only decides whether a placeholder
   * is worth showing, never what is rendered.
   */
  resourceAttachmentCounts?: {
    projects: Record<string, number>;
    categories: Record<string, number>;
  };
  profiles: Profile[];
  currentProfile: Profile;
  canManageCategories: boolean;
  /**
   * The lockable pages this member reaches. Absent only in demo mode, where
   * there is no server to ask and every page is open. See
   * `lib/access/workspace-areas.ts`.
   */
  accessibleAreas?: WorkspaceAreaKey[];
  subtasks: Subtask[];
  comments: TaskComment[];
  activity: TaskActivity[];
  attachments: TaskAttachment[];
  labels: Label[];
  taskAssignees: TaskAssignee[];
  taskLabels: TaskLabel[];
  taskCategories: TaskCategory[];
  projectOwners: ProjectOwner[];
  categoryOwners: CategoryOwner[];
  taskPage?: PaginationState;
  activityPage?: PaginationState;
  accessPreview?: AccessPreview;
};
