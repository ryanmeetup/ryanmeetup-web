"use client";

import {
  useMemo,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Avatar,
  Button,
  ConfirmationDialog,
  DropdownSelect,
  FilterChip,
  IconButton,
  Input,
  ManagementSurface,
  ModalActions,
  MultiSelect,
  PendingResults,
  Pill,
  SearchInput,
  TagInput,
  Textarea,
  toast,
  Tooltip,
} from "@ryanmeetup/ui";
import { useQueryParamState, useSearchFilter } from "@ryanmeetup/hooks";
import {
  FiArchive,
  FiArrowRight,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
  FiTag,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { withAccessPreview } from "@/lib/access/access-preview";
import {
  CountBadge,
  EditorSurface,
  editorTriggers,
  ManagementCard,
  ManagementCardTitle,
  ResourceOwnerSelect,
  useEditorReturnPath,
} from "@/components/global";
import type { Category } from "@/lib/resources/resource-types";
import type { CategoryController } from "./category-workspace";
import {
  ExpandableResourceEditor,
  ResourceFields,
  useResourceModalState,
  useResourceMutations,
  useResourceEditState,
  useResourceAccessState,
  ResourceAttachments,
  ResourceLinks,
  ResourceLinksFields,
} from "@/components/resources";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import {
  archiveFilter,
  filterAndSortResources,
  resourceSearchText,
  sameIds,
} from "@/lib/resources/resource-management";

type CategoryAccessGroup = {
  id: string;
  name: string;
  kind: "tier" | "team";
  hierarchy_rank: number | null;
  grants_global_content: boolean;
};

function randomCategoryColor(exclude?: string) {
  let color: string;
  do {
    color = `#${Math.floor(Math.random() * 0x1000000)
      .toString(16)
      .padStart(6, "0")}`;
  } while (color === exclude);
  return color;
}

type CategoriesModalOptions = {
  embedded?: boolean;
  createOnly?: boolean;
  editCategoryId?: string | null;
  readOnly?: boolean;
  /**
   * `"page"` renders the create and edit forms as the dedicated editor routes
   * instead of dialogs. See `docs/MOBILE_EDITOR_SURFACES.md`.
   */
  presentation?: "modal" | "page";
};

type CategoriesModalCommonProps = {
  controller: CategoryController;
  events?: {
    onCreate?: () => void;
    onCategoryUpdated?: (category: Category) => void;
  };
};

export type CategoriesModalProps = CategoriesModalCommonProps &
  (
    | {
        modal?: never;
        options: CategoriesModalOptions & { embedded: true };
      }
    | {
        modal: {
          open: boolean;
          setOpen: (value: boolean) => void;
        };
        options?: CategoriesModalOptions & { embedded?: false };
      }
  );

export function CategoriesModal({
  modal,
  controller,
  options,
  events,
}: CategoriesModalProps) {
  const setOpen = modal?.setOpen;
  const { view: data, commands, demoMode } = controller;
  /**
   * Where the mobile editor routes return to. This surface is embedded on both
   * `/categories` and `/projects`, so the page it is actually on is the honest
   * answer rather than a hardcoded default.
   */
  const listPath = useEditorReturnPath();
  const triggers = editorTriggers(data.currentProfile.editor_surface);
  const {
    embedded = false,
    createOnly: createOnlyOption,
    editCategoryId = null,
    readOnly = false,
    presentation = "modal",
  } = options ?? {};
  /**
   * The editor routes mount this component with `createOnly` or
   * `editCategoryId` set, so only those two surfaces ever render as a page.
   * Each one names the record it is editing, so the trail is built per surface
   * rather than once for the component.
   */
  const pageSurface = (crumb: string) =>
    presentation === "page"
      ? {
          presentation: "page" as const,
          parents: [
            {
              href: "/categories",
              title: "Categories",
              icon: <FiTag aria-hidden className="shrink-0" />,
            },
          ],
          crumb: { title: crumb },
        }
      : ({ presentation: "modal" } as const);
  const createOnly = createOnlyOption ?? !embedded;
  const { onCreate, onCategoryUpdated } = events ?? {};
  const resourceMutations = useResourceMutations("category");
  const directEditCategory = editCategoryId
    ? (data.categories.find((category) => category.id === editCategoryId) ??
      null)
    : null;
  const createState = useResourceModalState(data.currentProfile.id);
  const {
    name,
    description,
    links,
    attachments,
    ownerIds: newOwnerIds,
  } = createState.draft;
  const {
    setName,
    setDescription,
    setLinks,
    setAttachments,
    setOwnerIds: setNewOwnerIds,
  } = createState.changes;
  const {
    creating,
    setCreating,
    detailsOpen: createDetailsOpen,
    setDetailsOpen: setCreateDetailsOpen,
  } = createState;
  const [color, setColor] = useState(() => randomCategoryColor());
  const [tags, setTags] = useState<string[]>([]);
  const [newAccessMode, setNewAccessMode] =
    useState<Category["access_mode"]>("open");
  const [newAccessGroupIds, setNewAccessGroupIds] = useState<string[]>([]);
  const [confirmManagersOnlyCreate, setConfirmManagersOnlyCreate] =
    useState(false);
  const [categoryStatusParam, setCategoryStatus] = useQueryParamState(
    "category-status",
    "active",
  );
  const categoryStatus = archiveFilter(categoryStatusParam);
  const editState = useResourceEditState(
    directEditCategory,
    directEditCategory
      ? data.categoryOwners
          .filter((item) => item.category_id === directEditCategory.id)
          .map((item) => item.profile_id)
      : [],
  );
  const {
    resourceId: editingId,
    detailsOpen: editDetailsOpen,
    setDetailsOpen: setEditDetailsOpen,
    saving,
    setSaving,
  } = editState;
  const {
    name: editingName,
    description: editingDescription,
    links: editingLinks,
    ownerIds: editingOwnerIds,
  } = editState.draft;
  const {
    setName: setEditingName,
    setDescription: setEditingDescription,
    setLinks: setEditingLinks,
    setOwnerIds: setEditingOwnerIds,
  } = editState.changes;
  const [editingColor, setEditingColor] = useState(
    directEditCategory?.color ?? "",
  );
  const [editingTags, setEditingTags] = useState<string[]>(
    directEditCategory?.tags ?? [],
  );
  const accessState = useResourceAccessState<
    CategoryAccessGroup,
    Category["access_mode"]
  >({
    initialAccessMode: directEditCategory?.access_mode ?? "open",
    demoMode,
  });
  const accessGroups = accessState.groups;
  const {
    accessMode: editingAccessMode,
    groupIds: editingAccessGroupIds,
    savedGroupIds: savedAccessGroupIds,
  } = accessState.selection;
  const {
    setAccessMode: setEditingAccessMode,
    setGroupIds: setEditingAccessGroupIds,
  } = accessState.changes;
  const accessLoaded = accessState.loaded;
  const [confirmManagersOnlyCategory, setConfirmManagersOnlyCategory] =
    useState<Category | null>(null);
  const [supportingDetailsChanged, setSupportingDetailsChanged] =
    useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const {
    query,
    setQuery,
    filtered: searchedCategories,
    isPending: searchPending,
  } = useSearchFilter({
    data: data.categories,
    buildHaystack: resourceSearchText,
    queryParam: "category-search",
  });
  const categories = useMemo(
    () => filterAndSortResources(searchedCategories, categoryStatus),
    [categoryStatus, searchedCategories],
  );

  async function addCategory(
    event?: FormEvent<HTMLFormElement>,
    managersOnlyConfirmed = false,
  ) {
    event?.preventDefault();
    const nextName = name.trim();
    const nextDescription = description.trim();
    const nextTags = tags;
    if (!nextName || !nextDescription || newOwnerIds.length === 0) {
      toast.error("Add a category name, description, and at least one owner.");
      return;
    }
    if (
      data.currentProfile.app_role === "owner" &&
      newAccessMode === "restricted" &&
      newAccessGroupIds.length === 0 &&
      !managersOnlyConfirmed
    ) {
      setConfirmManagersOnlyCreate(true);
      return;
    }
    setCreating(true);
    try {
      let category: Category = {
        id: crypto.randomUUID(),
        name: nextName,
        description: nextDescription,
        color,
        links,
        tags: nextTags,
        created_by: data.currentProfile.id,
        archived_at: null,
        access_mode: newAccessMode,
      };
      if (!demoMode)
        category = (
          await resourceMutations.save("POST", {
            name: nextName,
            description: nextDescription,
            color,
            links,
            tags: nextTags,
            ownerIds: newOwnerIds,
            ...(data.currentProfile.app_role === "owner"
              ? {
                  accessMode: newAccessMode,
                  accessGroupIds:
                    newAccessMode === "restricted" ? newAccessGroupIds : [],
                }
              : {}),
          })
        ).category!;
      if (!demoMode && attachments.length > 0) {
        const failedAttachments = await resourceMutations.uploadDrafts(
          attachments,
          category.id,
        );
        if (failedAttachments > 0)
          toast.error(
            `${failedAttachments} ${failedAttachments === 1 ? "attachment" : "attachments"} could not be added. You can retry from Edit category.`,
          );
      }
      commands.add(category, newOwnerIds);
      createState.reset();
      setTags([]);
      setNewAccessMode("open");
      setNewAccessGroupIds([]);
      setColor(randomCategoryColor(color));
      toast.success(`${category.name} created.`);
      if (createOnly) setOpen?.(false);
    } catch (error) {
      toast.error(errorMessage(error, "The category could not be created."));
    } finally {
      setCreating(false);
    }
  }

  async function loadCategoryAccess(categoryId?: string) {
    if (demoMode || data.currentProfile.app_role !== "owner") return;
    try {
      await accessState.load(
        (signal) =>
          mutate<{
            groups: CategoryAccessGroup[];
            groupIds: string[];
          }>(
            categoryId
              ? `/api/category-access?categoryId=${encodeURIComponent(categoryId)}`
              : "/api/category-access",
            { method: "GET", signal },
          ),
        { applySelection: Boolean(categoryId) },
      );
    } catch (error) {
      toast.error(
        errorMessage(error, "Category access settings could not be loaded."),
      );
    }
  }

  useEffect(() => {
    // Direct-edit modals receive owner-only access metadata from the API after mount.
    if (directEditCategory) void loadCategoryAccess(directEditCategory.id);
    else if (createOnly && data.currentProfile.app_role === "owner")
      void loadCategoryAccess();
    // This modal's direct-edit target is fixed while it is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOnly, directEditCategory?.id]);

  function beginEdit(category: Category) {
    setSupportingDetailsChanged(false);
    editState.begin(
      category,
      data.categoryOwners
        .filter((item) => item.category_id === category.id)
        .map((item) => item.profile_id),
    );
    setEditingColor(category.color);
    setEditingTags(category.tags);
    accessState.begin(category.access_mode);
    void loadCategoryAccess(category.id);
  }

  function closeEditor() {
    setSupportingDetailsChanged(false);
    if (editState.close() && editCategoryId) setOpen?.(false);
  }

  async function updateCategory(
    category: Category,
    managersOnlyConfirmed = false,
  ) {
    const nextName = editingName.trim();
    if (!nextName || editingOwnerIds.length === 0) {
      toast.error("Add a category name and at least one owner.");
      return;
    }
    const nextDescription = editingDescription.trim() || null;
    const nextTags = editingTags;
    const currentOwnerIds = data.categoryOwners
      .filter((item) => item.category_id === category.id)
      .map((item) => item.profile_id);
    const ownersChanged = !sameIds(currentOwnerIds, editingOwnerIds);
    if (
      data.currentProfile.app_role === "owner" &&
      editingAccessMode === "restricted" &&
      editingAccessGroupIds.length === 0 &&
      !managersOnlyConfirmed
    ) {
      setConfirmManagersOnlyCategory(category);
      return;
    }
    setSaving(true);
    try {
      if (!demoMode)
        await resourceMutations.save("PATCH", {
          id: category.id,
          name: nextName,
          description: nextDescription,
          color: editingColor,
          links: editingLinks,
          tags: nextTags,
          ...(ownersChanged ? { ownerIds: editingOwnerIds } : {}),
        });
      if (!demoMode && data.currentProfile.app_role === "owner") {
        await mutate("/api/category-access", {
          method: "POST",
          body: JSON.stringify({
            categoryId: category.id,
            accessMode: editingAccessMode,
            groupIds:
              editingAccessMode === "restricted" ? editingAccessGroupIds : [],
          }),
        });
      }
      const updatedCategory: Category = {
        ...category,
        name: nextName,
        description: nextDescription,
        color: editingColor,
        links: editingLinks,
        tags: nextTags,
        access_mode: editingAccessMode,
      };
      commands.update(
        updatedCategory,
        ownersChanged ? editingOwnerIds : undefined,
      );
      accessState.commit();
      onCategoryUpdated?.(updatedCategory);
      setSupportingDetailsChanged(false);
      editState.complete();
      if (editCategoryId) setOpen?.(false);
      toast.success(`${nextName} updated.`);
    } catch (error) {
      toast.error(errorMessage(error, "The category could not be updated."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchived(category: Category) {
    const archived = !category.archived_at;
    try {
      if (!demoMode)
        await resourceMutations.save("PATCH", {
          id: category.id,
          name: category.name,
          description: category.description,
          color: category.color,
          links: category.links,
          tags: category.tags,
          archived,
        });
      commands.setArchived(
        category.id,
        archived ? new Date().toISOString() : null,
      );
      toast.success(`${category.name} ${archived ? "archived" : "restored"}.`);
    } catch (error) {
      toast.error(errorMessage(error, "The category could not be updated."));
    }
  }

  async function deleteCategory() {
    if (!deleteTarget) return;
    const category = deleteTarget;
    setDeletePending(true);
    try {
      if (!demoMode)
        await resourceMutations.save("DELETE", { id: category.id });
      commands.remove(category.id);
      setDeleteTarget(null);
      toast.success(`${category.name} deleted.`);
    } catch (error) {
      toast.error(errorMessage(error, "The category could not be deleted."));
    } finally {
      setDeletePending(false);
    }
  }

  const colorControl = (
    id: string,
    currentColor: string,
    setCurrentColor: (value: string) => void,
    disabled: boolean,
  ) => (
    <div className="date-field">
      <span>
        <label htmlFor={id}>Color</label>
        <span className="text-red-500">*</span>
      </span>
      {/* The swatch and its randomiser sit in their own row so the label text
          cannot stretch the column: the wider "Color *" caption used to push
          the button away from the swatch and eat into the name field. */}
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          type="color"
          className="color-input !h-10 !w-10"
          value={currentColor}
          onChange={(event) => setCurrentColor(event.target.value)}
          disabled={disabled}
          required
        />
        <IconButton
          label="Randomize category color"
          size="md"
          onClick={() => setCurrentColor(randomCategoryColor(currentColor))}
          disabled={disabled}
        >
          <FiRefreshCw />
        </IconButton>
      </div>
    </div>
  );

  const ownerControl = (
    value: string[],
    onChange: (value: string[]) => void,
    disabled: boolean,
  ) => (
    <ResourceOwnerSelect
      label="Category owners"
      profiles={data.profiles}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );

  const newCategoryAccessControl = (
    <>
      <DropdownSelect
        label="Who can access this category?"
        required
        variant="field"
        value={newAccessMode}
        onChange={(value) => setNewAccessMode(value as Category["access_mode"])}
        options={[
          { label: "Everyone in the workspace", value: "open" },
          {
            label: "Selected access groups",
            value: "restricted",
          },
        ]}
        disabled={
          creating || data.currentProfile.app_role !== "owner" || !accessLoaded
        }
      />
      {data.currentProfile.app_role !== "owner" && (
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          New categories are open by default. App owners manage category access.
        </p>
      )}
      {data.currentProfile.app_role === "owner" &&
        newAccessMode === "restricted" && (
          <div className="mt-4">
            <MultiSelect
              label="Allowed access groups"
              options={accessGroups.map((group) => ({
                label: group.name,
                value: group.id,
              }))}
              value={newAccessGroupIds}
              onChange={setNewAccessGroupIds}
              placeholder={
                accessLoaded
                  ? "Owners and managers only"
                  : "Loading access groups…"
              }
              searchable
              searchPlaceholder="Search access groups"
              disabled={creating || !accessLoaded}
            />
            <p className="mt-2 text-sm text-black/70 dark:text-white/70">
              App owners, and any tier that grants workspace-wide content
              access, always retain access. Select any additional groups that
              should see this category.
            </p>
          </div>
        )}
    </>
  );

  const newCategoryPrimaryFields = (
    <ResourceFields
      section="primary"
      resource={{ kind: "category" }}
      values={{ name, description, ownerIds: newOwnerIds, links, attachments }}
      changes={{
        setName,
        setDescription,
        setOwnerIds: setNewOwnerIds,
        setLinks,
        setAttachments,
      }}
      editor={{
        disabled: creating,
        demoMode,
        currentUserId: data.currentProfile.id,
        profiles: data.profiles,
      }}
      copy={{
        nameLabel: "Category name",
        namePlaceholder: "Marketing",
        descriptionPlaceholder: "What kind of work belongs in this category?",
      }}
      nameSlot={colorControl("new-category-color", color, setColor, creating)}
      primarySlot={
        <>
          <TagInput
            label="Tags"
            value={tags}
            onChange={setTags}
            placeholder="Feature"
            disabled={creating}
          />
          {newCategoryAccessControl}
        </>
      }
    />
  );
  const newCategorySecondaryFields = (
    <ResourceFields
      section="supporting"
      resource={{ kind: "category" }}
      values={{ name, description, ownerIds: newOwnerIds, links, attachments }}
      changes={{
        setName,
        setDescription,
        setOwnerIds: setNewOwnerIds,
        setLinks,
        setAttachments,
      }}
      editor={{
        disabled: creating,
        demoMode,
        currentUserId: data.currentProfile.id,
        profiles: data.profiles,
      }}
      copy={{
        nameLabel: "Category name",
        namePlaceholder: "Marketing",
        descriptionPlaceholder: "What kind of work belongs in this category?",
      }}
    />
  );

  const renderSurface = (children: ReactNode) => {
    const title = createOnly ? (
      "New Category"
    ) : (
      <>
        Categories <CountBadge size="lg">{categories.length}</CountBadge>
      </>
    );

    if (embedded) {
      return (
        <ManagementSurface
          title={title}
          description="Categories make work easier to scan and filter across projects."
          actions={
            onCreate && !readOnly ? (
              <>
                {triggers.route && (
                  <Button.Link
                    href={`/categories/new?from=${encodeURIComponent(listPath)}`}
                    size="sm"
                    className={`w-full ${triggers.routeClassName}`}
                    leftIcon={<FiPlus aria-hidden />}
                  >
                    New Category
                  </Button.Link>
                )}
                {triggers.dialog && (
                  <Button
                    type="button"
                    size="sm"
                    className={triggers.dialogClassName}
                    leftIcon={<FiPlus aria-hidden />}
                    onClick={onCreate}
                  >
                    New Category
                  </Button>
                )}
              </>
            ) : undefined
          }
        >
          {children}
        </ManagementSurface>
      );
    }

    if (!modal) return null;

    return (
      <EditorSurface
        {...pageSurface("New category")}
        open={modal.open && !editingId}
        setOpen={modal.setOpen}
        title={title}
        description={
          createOnly
            ? "Give related work a recognizable label and color. You can edit or archive it from the Categories page later."
            : undefined
        }
        actions={
          <ModalActions
            confirmForm="create-category-form"
            confirmLabel="Create category"
            onCancel={() => modal.setOpen(false)}
            pending={creating}
            pendingLabel="Creating..."
          />
        }
        formId={createOnly ? "create-category-form" : undefined}
        onSubmit={createOnly ? addCategory : undefined}
        size={
          createOnly && createDetailsOpen ? "2xl" : createOnly ? "lg" : "xl"
        }
        panelClassName={
          createOnly
            ? "transition-[max-width] duration-300 ease-out motion-reduce:transition-none"
            : undefined
        }
        footerContent={
          !createOnly ? (
            <form
              id="create-category-form"
              className="grid gap-4"
              onSubmit={addCategory}
            >
              <ExpandableResourceEditor
                expanded={createDetailsOpen}
                setExpanded={setCreateDetailsOpen}
                primary={newCategoryPrimaryFields}
                secondary={newCategorySecondaryFields}
              />
            </form>
          ) : undefined
        }
      >
        {children}
      </EditorSurface>
    );
  };

  return (
    <>
      {renderSurface(
        <>
          {createOnly ? (
            <div className="space-y-4">
              <ExpandableResourceEditor
                expanded={createDetailsOpen}
                setExpanded={setCreateDetailsOpen}
                primary={newCategoryPrimaryFields}
                secondary={newCategorySecondaryFields}
              />
            </div>
          ) : (
            <>
              {!embedded && (
                <p className="mb-5 text-sm text-black/60 dark:text-white/60">
                  Categories make work easier to scan and filter across
                  projects.
                </p>
              )}
              <div className="sticky top-0 z-20 -mx-1 mb-4 grid gap-3 bg-white px-1 pb-3 dark:bg-[#181818] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="relative">
                  <SearchInput
                    label="Search categories"
                    name="category-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search categories..."
                    pending={searchPending}
                    pendingLabel="Loading category results"
                  />
                </div>
                <div
                  className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap"
                  aria-label="Filter categories"
                >
                  {(["active", "archived", "all"] as const).map((status) => (
                    <FilterChip
                      key={status}
                      active={categoryStatus === status}
                      variant="soft"
                      onClick={() => setCategoryStatus(status)}
                      className="h-10 w-full justify-center px-2 py-0 sm:w-auto sm:px-4"
                    >
                      {status}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <PendingResults
                pending={searchPending}
                label="Loading categories"
              >
                <div
                  className={`grid items-stretch gap-4 md:grid-cols-2 ${embedded ? "lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3" : ""}`}
                >
                  {categories.map((category) => {
                    const taskCount = data.taskCategories.filter(
                      (item) => item.category_id === category.id,
                    ).length;
                    const owners = data.categoryOwners
                      .filter((item) => item.category_id === category.id)
                      .flatMap((item) => {
                        const profile = data.profiles.find(
                          (candidate) => candidate.id === item.profile_id,
                        );
                        return profile ? [profile] : [];
                      });
                    return (
                      <ManagementCard
                        key={category.id}
                        body={
                          category.description ||
                          (category.links ?? []).length ||
                          category.tags.length ? (
                            <div className="min-w-0">
                              {category.description && (
                                <p className="text-sm text-black/60 dark:text-white/60">
                                  {category.description}
                                </p>
                              )}
                              {(category.links ?? []).length > 0 && (
                                <div className="mt-3">
                                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                                    Useful links
                                  </p>
                                  <ResourceLinks links={category.links} />
                                </div>
                              )}
                              {category.tags.length > 0 && (
                                <div className="mb-3 mt-3">
                                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                                    Available tags
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {category.tags.slice(0, 4).map((tag) => (
                                      <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold text-black/70 dark:text-white/75"
                                        style={{
                                          borderColor: `${category.color}55`,
                                          backgroundColor: `${category.color}18`,
                                        }}
                                      >
                                        <FiTag
                                          aria-hidden
                                          className="h-2.5 w-2.5"
                                        />
                                        {tag}
                                      </span>
                                    ))}
                                    {category.tags.length > 4 && (
                                      <Tooltip
                                        content={category.tags
                                          .slice(4)
                                          .join(", ")}
                                        placement="top"
                                      >
                                        <span
                                          className="inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold text-black/60 dark:text-white/65"
                                          style={{
                                            borderColor: `${category.color}55`,
                                            backgroundColor: `${category.color}18`,
                                          }}
                                        >
                                          +{category.tags.length - 4}
                                        </span>
                                      </Tooltip>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : undefined
                        }
                        footerClassName="flex-wrap justify-start"
                        footer={
                          <>
                            {owners.length > 0 ? (
                              <div
                                className="flex shrink-0 -space-x-2"
                                aria-label={`${owners.length} ${owners.length === 1 ? "owner" : "owners"}`}
                              >
                                {owners.slice(0, 3).map((owner) => (
                                  <Tooltip
                                    key={owner.id}
                                    content={owner.full_name}
                                    placement="top"
                                  >
                                    <Avatar
                                      name={owner.full_name}
                                      src={owner.avatar_url}
                                      size="md"
                                      className="ring-2 ring-white dark:ring-[#181818]"
                                    />
                                  </Tooltip>
                                ))}
                                {owners.length > 3 && (
                                  <Tooltip
                                    content={owners
                                      .slice(3)
                                      .map((owner) => owner.full_name)
                                      .join(", ")}
                                    placement="top"
                                  >
                                    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-white bg-black text-[10px] font-bold text-white dark:border-[#181818] dark:bg-white dark:text-black">
                                      +{owners.length - 3}
                                    </span>
                                  </Tooltip>
                                )}
                              </div>
                            ) : (
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-black/25 text-black/40 dark:border-white/25 dark:text-white/40">
                                <FiUsers aria-hidden size={14} />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/40">
                                Owners
                              </p>
                              <p
                                className="truncate text-xs font-medium text-black/65 dark:text-white/65"
                                title={owners
                                  .map((owner) => owner.full_name)
                                  .join(", ")}
                              >
                                {owners.length > 0
                                  ? `${owners
                                      .slice(0, 3)
                                      .map((owner) => owner.full_name)
                                      .join(
                                        ", ",
                                      )}${owners.length > 3 ? ` +${owners.length - 3}` : ""}`
                                  : "Unassigned"}
                              </p>
                            </div>
                            {embedded && (
                              <Button.Link
                                href={withAccessPreview(
                                  `/board?category=${encodeURIComponent(category.name)}`,
                                  data.accessPreview,
                                )}
                                variant="secondary"
                                size="sm"
                                className="w-full justify-center sm:ml-auto sm:w-auto"
                                rightIcon={<FiArrowRight aria-hidden />}
                              >
                                Open board
                              </Button.Link>
                            )}
                          </>
                        }
                      >
                        <span
                          aria-hidden
                          className="h-4 w-4 shrink-0 rounded-full ring-4 ring-black/5 dark:ring-white/5"
                          style={{ backgroundColor: category.color }}
                        />
                        <div className="min-w-0 flex-1 py-1">
                          <ManagementCardTitle
                            className={
                              category.archived_at
                                ? "text-black/60 dark:text-white/60"
                                : undefined
                            }
                          >
                            <span className="inline-flex max-w-full items-center gap-2">
                              <span className="truncate">{category.name}</span>
                              <Tooltip
                                content={`${taskCount} ${taskCount === 1 ? "task" : "tasks"} in this category`}
                                placement="top"
                              >
                                <CountBadge label="task" className="shrink-0">
                                  {taskCount}
                                </CountBadge>
                              </Tooltip>
                            </span>
                          </ManagementCardTitle>
                        </div>
                        {category.archived_at && (
                          <Pill
                            variant="neutral"
                            size="sm"
                            className="shrink-0 !px-2.5 !tracking-[0.16em]"
                          >
                            Archived
                          </Pill>
                        )}
                        {!readOnly && (
                          <>
                            {/* Route or dialog, per the profile. */}
                            {triggers.route && (
                              <IconButton.Link
                                href={`/categories/${category.id}/edit?from=${encodeURIComponent(listPath)}`}
                                label={`Edit “${category.name}”`}
                                variant="edit"
                                tooltipTriggerClassName={
                                  triggers.routeClassName
                                }
                              >
                                <FiEdit2 />
                              </IconButton.Link>
                            )}
                            {triggers.dialog && (
                              <IconButton
                                label={`Edit “${category.name}”`}
                                variant="edit"
                                tooltipTriggerClassName={
                                  triggers.dialogClassName
                                }
                                onClick={() => beginEdit(category)}
                              >
                                <FiEdit2 />
                              </IconButton>
                            )}
                            <IconButton
                              label={`${category.archived_at ? "Restore" : "Archive"} “${category.name}”`}
                              variant="archive"
                              onClick={() => void toggleArchived(category)}
                            >
                              {category.archived_at ? (
                                <FiRotateCcw />
                              ) : (
                                <FiArchive />
                              )}
                            </IconButton>
                            {taskCount === 0 && (
                              <IconButton
                                label={`Delete “${category.name}”`}
                                variant="danger"
                                onClick={() => setDeleteTarget(category)}
                              >
                                <FiTrash2 />
                              </IconButton>
                            )}
                          </>
                        )}
                      </ManagementCard>
                    );
                  })}
                  {categories.length === 0 && (
                    <div
                      className={`rounded-xl border border-dashed border-black/10 px-4 py-10 text-center text-sm text-black/55 dark:border-white/10 dark:text-white/55 md:col-span-2 ${embedded ? "lg:col-span-1 xl:col-span-2 2xl:col-span-3" : ""}`}
                    >
                      No categories match this search.
                    </div>
                  )}
                </div>
              </PendingResults>
            </>
          )}
        </>,
      )}

      {editingId &&
        (() => {
          const category = data.categories.find(
            (item) => item.id === editingId,
          );
          if (!category) return null;
          const categoryChanged =
            editingName.trim() !== category.name ||
            editingDescription.trim() !== (category.description ?? "") ||
            editingColor !== category.color ||
            JSON.stringify(editingTags) !== JSON.stringify(category.tags) ||
            JSON.stringify(editingLinks) !==
              JSON.stringify(category.links ?? []) ||
            supportingDetailsChanged ||
            editingAccessMode !== category.access_mode ||
            !sameIds(editingAccessGroupIds, savedAccessGroupIds) ||
            !sameIds(
              editingOwnerIds,
              data.categoryOwners
                .filter((item) => item.category_id === category.id)
                .map((item) => item.profile_id),
            );
          return (
            <EditorSurface
              {...pageSurface(category.name)}
              setOpen={(nextOpen) => {
                if (!nextOpen) closeEditor();
              }}
              title={`Edit ${category.name}`}
              description="Update the label, color, and who this category is for."
              size={editDetailsOpen ? "2xl" : "lg"}
              panelClassName="transition-[max-width] duration-300 ease-out motion-reduce:transition-none"
              actions={
                <ModalActions
                  confirmDisabled={
                    !categoryChanged ||
                    (data.currentProfile.app_role === "owner" && !accessLoaded)
                  }
                  confirmForm={`edit-category-form-${category.id}`}
                  confirmLabel="Save changes"
                  confirmTooltip="Make a change before saving."
                  onCancel={closeEditor}
                  pending={saving}
                  pendingLabel="Saving..."
                />
              }
            >
              <form
                id={`edit-category-form-${category.id}`}
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void updateCategory(category);
                }}
              >
                <ExpandableResourceEditor
                  expanded={editDetailsOpen}
                  setExpanded={setEditDetailsOpen}
                  primary={
                    <>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                        <Input
                          label="Category name"
                          name={`edit-category-${category.id}`}
                          required
                          autoFocus
                          value={editingName}
                          onChange={(event) =>
                            setEditingName(event.target.value)
                          }
                          disabled={saving}
                        />
                        {colorControl(
                          `edit-category-color-${category.id}`,
                          editingColor,
                          setEditingColor,
                          saving,
                        )}
                      </div>
                      <Textarea
                        id={`edit-category-description-${category.id}`}
                        label="Description"
                        name={`edit-category-description-${category.id}`}
                        value={editingDescription}
                        onChange={(event) =>
                          setEditingDescription(event.target.value)
                        }
                        placeholder="What kind of work belongs here?"
                        rows={3}
                        disabled={saving}
                      />
                      <TagInput
                        label="Tags"
                        value={editingTags}
                        onChange={setEditingTags}
                        placeholder="Feature"
                        disabled={saving}
                      />
                      <>
                        <DropdownSelect
                          label="Who can access this category?"
                          required
                          variant="field"
                          value={editingAccessMode}
                          onChange={(value) =>
                            setEditingAccessMode(
                              value as Category["access_mode"],
                            )
                          }
                          options={[
                            {
                              label: "Everyone in the workspace",
                              value: "open",
                            },
                            {
                              label: "Selected access groups",
                              value: "restricted",
                            },
                          ]}
                          disabled={
                            saving || data.currentProfile.app_role !== "owner"
                          }
                        />
                        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
                          Restricted categories and their work are hidden from
                          everyone except the selected access groups.
                        </p>
                        {data.currentProfile.app_role === "owner" &&
                          editingAccessMode === "restricted" && (
                            <div className="mt-4">
                              <MultiSelect
                                label="Allowed access groups"
                                options={accessGroups.map((group) => ({
                                  label: group.name,
                                  value: group.id,
                                }))}
                                value={editingAccessGroupIds}
                                onChange={setEditingAccessGroupIds}
                                placeholder={
                                  !accessLoaded
                                    ? "Loading access groups…"
                                    : "Owners and managers only"
                                }
                                searchable
                                searchPlaceholder="Search access groups"
                                disabled={saving || !accessLoaded}
                              />
                              <p className="mt-2 text-sm text-black/70 dark:text-white/70">
                                App owners, and any tier that grants
                                workspace-wide content access, always retain
                                access. Select any additional groups that should
                                see this category.
                              </p>
                            </div>
                          )}
                      </>
                      {ownerControl(
                        editingOwnerIds,
                        setEditingOwnerIds,
                        saving,
                      )}
                    </>
                  }
                  secondary={
                    <>
                      <ResourceLinksFields
                        links={editingLinks}
                        setLinks={setEditingLinks}
                        disabled={saving}
                        namePrefix={`category-${category.id}`}
                      />
                      <ResourceAttachments
                        resource={{ kind: "category", id: category.id }}
                        editor={{
                          demoMode,
                          disabled: saving,
                          currentUserId: data.currentProfile.id,
                        }}
                        onMutation={() => setSupportingDetailsChanged(true)}
                      />
                    </>
                  }
                />
              </form>
            </EditorSurface>
          );
        })()}
      <ConfirmationDialog
        open={Boolean(confirmManagersOnlyCategory)}
        setOpen={(nextOpen) => {
          if (!nextOpen) setConfirmManagersOnlyCategory(null);
        }}
        title="Restrict to owners and managers?"
        description="No additional access groups are selected. Only app owners and tiers that grant workspace-wide content access will see this category and its work."
        confirmLabel="Restrict category"
        onConfirm={() => {
          const category = confirmManagersOnlyCategory;
          setConfirmManagersOnlyCategory(null);
          if (category) void updateCategory(category, true);
        }}
      />
      <ConfirmationDialog
        open={confirmManagersOnlyCreate}
        setOpen={setConfirmManagersOnlyCreate}
        title="Create for owners and managers only?"
        description="No additional access groups are selected. Only app owners and tiers that grant workspace-wide content access will see this category and its work."
        confirmLabel="Create restricted category"
        onConfirm={() => {
          setConfirmManagersOnlyCreate(false);
          void addCategory(undefined, true);
        }}
      />
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        setOpen={(nextOpen) =>
          !nextOpen && !deletePending && setDeleteTarget(null)
        }
        title="Delete this category?"
        description={`This permanently removes “${deleteTarget?.name ?? "this category"}”. This cannot be undone.`}
        confirmLabel="Delete category"
        pendingLabel="Deleting category..."
        pending={deletePending}
        destructive
        onConfirm={() => void deleteCategory()}
      />
    </>
  );
}
