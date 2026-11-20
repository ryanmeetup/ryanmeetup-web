"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { usePathname } from "next/navigation";
import { useSearchFilter } from "@ryanmeetup/hooks";
import {
  formatInstagramHandle,
  formatPhoneNumber,
  normalizeHttpUrl,
} from "@ryanmeetup/utils";
import {
  Breadcrumbs,
  Button,
  Card,
  DropdownSelect,
  IconButton,
  Input,
  Modal,
  ModalActions,
  SearchInput,
  Textarea,
  Tooltip,
} from "@ryanmeetup/ui";
import {
  FiBriefcase,
  FiEdit2,
  FiInstagram,
  FiMail,
  FiPhone,
  FiPlus,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import type {
  Contact,
  ContactDraft,
  ContactMethod,
  ContactDraftPerson,
} from "@/lib/contacts/contact-types";
import { CONTACT_GROUPS } from "@/lib/contacts/contact-types";
import { contactDraftSignature } from "@/lib/contacts/contact-draft";
import { CountBadge, PageHeader } from "@/components/global";

const blankPerson = (): ContactDraftPerson => ({
  full_name: "",
  title: null,
  emails: [],
  phones: [],
  instagram_handle: null,
});

const editorFormId = "contact-editor-form";

const makeDraft = (contact?: Contact | null): ContactDraft => ({
  id: contact?.id,
  displayName: contact?.display_name ?? "",
  imageUrl: contact?.image_path ? "" : (contact?.image_url ?? ""),
  retainImage: Boolean(contact?.image_path),
  contactGroup: contact?.contact_group ?? "",
  notes: contact?.notes ?? "",
  categoryIds: contact?.categories.map((category) => category.id) ?? [],
  newCategoryNames: [],
  people:
    contact?.people.map((person) => ({
      ...person,
      emails: person.emails.map((method) => ({ ...method })),
      phones: person.phones.map((method) => ({ ...method })),
    })) ?? [],
});

function ContactMethodsEditor({
  kind,
  personIndex,
  methods,
  disabled,
  onChange,
}: {
  kind: "email" | "phone";
  personIndex: number;
  methods: ContactMethod[];
  disabled: boolean;
  onChange: (methods: ContactMethod[]) => void;
}) {
  const noun = kind === "email" ? "email address" : "phone number";
  const heading = kind === "email" ? "Email addresses" : "Phone numbers";
  const Icon = kind === "email" ? FiMail : FiPhone;
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="sr-only">{heading}</legend>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            aria-hidden
            className="shrink-0 text-black/50 dark:text-white/50"
          />
          <span className="text-xs font-semibold uppercase tracking-caps-tight text-black/60 dark:text-white/60">
            {heading}
          </span>
          <CountBadge>{methods.length}</CountBadge>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          leftIcon={<FiPlus aria-hidden />}
          disabled={disabled || methods.length >= 10}
          title={
            methods.length >= 10
              ? `Up to 10 ${heading.toLowerCase()}`
              : undefined
          }
          onClick={() => onChange([...methods, { label: null, value: "" }])}
        >
          Add {kind === "email" ? "email" : "phone"}
        </Button>
      </div>
      {methods.length === 0 && (
        <p className="rounded-lg border border-dashed border-black/15 px-3 py-4 text-center text-xs text-black/50 dark:border-white/15 dark:text-white/50">
          No {heading.toLowerCase()} added.
        </p>
      )}
      {methods.map((method, index) => (
        <div
          key={index}
          className="grid items-end gap-3 rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-black/10 sm:grid-cols-[minmax(7rem,0.7fr)_minmax(0,2fr)]"
        >
          <Input
            label="Label"
            name={`person-${personIndex}-${kind}-${index}-label`}
            value={method.label ?? ""}
            maxLength={40}
            placeholder={kind === "email" ? "Work" : "Work cell"}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                methods.map((item, methodIndex) =>
                  methodIndex === index
                    ? { ...item, label: event.target.value }
                    : item,
                ),
              )
            }
          />
          <Input
            label={noun[0].toUpperCase() + noun.slice(1)}
            name={`person-${personIndex}-${kind}-${index}-value`}
            type={kind === "email" ? "email" : "text"}
            inputMode={kind === "phone" ? "tel" : "email"}
            required
            autoFocus={!method.value && index === methods.length - 1}
            value={method.value}
            maxLength={kind === "email" ? 254 : 40}
            placeholder={
              kind === "email" ? "name@example.com" : "(555) 555-0123"
            }
            disabled={disabled}
            onChange={(event) =>
              onChange(
                methods.map((item, methodIndex) =>
                  methodIndex === index
                    ? {
                        ...item,
                        value:
                          kind === "phone"
                            ? formatPhoneNumber(event.target.value)
                            : event.target.value,
                      }
                    : item,
                ),
              )
            }
            trailingAction={
              <IconButton
                label={`Remove ${method.label?.trim() || noun}`}
                variant="danger"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    methods.filter((_, methodIndex) => methodIndex !== index),
                  )
                }
              >
                <FiTrash2 aria-hidden />
              </IconButton>
            }
          />
        </div>
      ))}
    </fieldset>
  );
}

type ContactEditorProps = {
  contact?: Contact | null;
  saving: boolean;
  backHref: string;
  onClose: () => void;
  onSave: (draft: ContactDraft, imageFile: File | null) => void;
};

export function ContactEditor(props: ContactEditorProps) {
  const { contact, saving, backHref, onClose, onSave } = props;
  const pathname = usePathname();
  const [draft, setDraft] = useState(() => makeDraft(contact));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(contact?.image_url ?? null);
  const [imageError, setImageError] = useState("");
  const [activePersonIndex, setActivePersonIndex] = useState<number | null>(
    null,
  );
  const [personBeforeEdit, setPersonBeforeEdit] =
    useState<ContactDraftPerson | null>(null);
  const [removePersonOnCancel, setRemovePersonOnCancel] = useState(false);
  useEffect(
    () => () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );
  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setImageError(
        "Choose a JPG, PNG, or WebP image that is 5 MB or smaller.",
      );
      event.target.value = "";
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setDraft((current) => ({
      ...current,
      imageUrl: "",
      retainImage: false,
    }));
    setImageError("");
  }
  const updatePerson = (index: number, patch: Partial<ContactDraftPerson>) =>
    setDraft((current) => ({
      ...current,
      people: current.people.map((person, personIndex) =>
        personIndex === index ? { ...person, ...patch } : person,
      ),
    }));
  const valid =
    !imageError &&
    Boolean(draft.displayName.trim()) &&
    draft.people.every(
      (person) =>
        person.full_name.trim() &&
        [...person.emails, ...person.phones].every((method) =>
          method.value.trim(),
        ),
    );
  // An edit that saves the same values is a request the server accepts and a
  // page reload the reader learns nothing from, so the button says so instead.
  // A brand-new contact has nothing to compare against; `valid` already holds
  // its Create button until the form is worth submitting.
  const savedSignature = useMemo(
    () => contactDraftSignature(makeDraft(contact)),
    [contact],
  );
  const unchanged =
    Boolean(contact) &&
    imageFile === null &&
    contactDraftSignature(draft) === savedSignature;
  const indexedPeople = useMemo(
    () => draft.people.map((person, index) => ({ person, index })),
    [draft.people],
  );
  const {
    query: peopleQuery,
    setQuery: setPeopleQuery,
    filtered: visiblePeople,
    isPending: peopleSearchPending,
  } = useSearchFilter({
    data: indexedPeople,
    queryParam: "contactPerson",
    buildHaystack: ({ person }) =>
      [
        person.full_name,
        person.title,
        ...person.emails.flatMap((method) => [method.label, method.value]),
        ...person.phones.flatMap((method) => [method.label, method.value]),
        person.instagram_handle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
  });
  const filteredPeople =
    draft.people.length >= 8 ? visiblePeople : indexedPeople;
  const displayedPeople = filteredPeople;
  const activePerson =
    activePersonIndex === null ? null : draft.people[activePersonIndex];

  function removePerson(index: number) {
    setDraft((current) => ({
      ...current,
      people: current.people.filter((_, personIndex) => personIndex !== index),
    }));
    setActivePersonIndex((current) => {
      if (current === null || current === index) return null;
      return current > index ? current - 1 : current;
    });
    if (activePersonIndex === index) setPersonBeforeEdit(null);
  }

  function cancelPersonEdit() {
    if (activePersonIndex === null) return;

    if (!removePersonOnCancel && personBeforeEdit) {
      updatePerson(activePersonIndex, personBeforeEdit);
      setActivePersonIndex(null);
    } else {
      removePerson(activePersonIndex);
    }
    setPersonBeforeEdit(null);
    setRemovePersonOnCancel(false);
  }

  // Only the unchanged case is worth a tooltip: an incomplete form already
  // marks its own fields, and a save in flight explains itself. A disabled
  // button swallows the hover the tooltip needs, so it gives up its pointer
  // events to the wrapper that carries them — it refuses clicks either way.
  const explainUnchanged = unchanged && valid && !saving;
  const saveButton = (
    <Button
      type="submit"
      className={`w-full sm:w-auto ${explainUnchanged ? "pointer-events-none" : ""}`}
      disabled={!valid || saving || unchanged}
      loading={saving}
      loadingText={contact ? "Saving…" : "Creating…"}
    >
      {contact ? "Save changes" : "Create contact"}
    </Button>
  );
  const editorActions = (
    <div className="flex flex-col-reverse gap-2 border-t border-black/10 pt-5 dark:border-white/10 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto"
        disabled={saving}
        onClick={onClose}
      >
        Cancel
      </Button>
      {explainUnchanged ? (
        <Tooltip
          content="No changes to save yet."
          triggerClassName="w-full cursor-not-allowed sm:w-auto"
        >
          {saveButton}
        </Tooltip>
      ) : (
        saveButton
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
      {/* The trail replaces the old back button and the kicker above the
          title, which both said "Contacts" a second time. It goes to the
          directory itself; Cancel is the control that returns to the list the
          way it was left. */}
      <div className="min-w-0 space-y-2">
        <Breadcrumbs
          variant="compact"
          crumbs={[
            {
              current: false,
              href: backHref,
              icon: <FiUsers aria-hidden className="shrink-0" />,
              title: "Contacts",
            },
            {
              current: true,
              href: pathname,
              icon: <FiBriefcase aria-hidden className="shrink-0" />,
              title: contact?.display_name ?? "New contact",
            },
          ]}
        />
        <PageHeader
          title={contact ? `Edit ${contact.display_name}` : "New contact"}
          description="Manage this contact and the people you know there."
        />
      </div>
      <form
        id={editorFormId}
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !unchanged) onSave(draft, imageFile);
        }}
      >
        <Card size="lg">
          <div className="grid items-start gap-6 sm:grid-cols-[8rem_minmax(0,1fr)] lg:gap-8">
            <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-3">
              <div
                role="img"
                aria-label="Contact image preview"
                className="grid aspect-square w-20 shrink-0 place-items-center rounded-2xl border border-black/10 bg-white bg-cover bg-center text-xl font-semibold text-black/50 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-white/50 sm:w-32"
                style={
                  imagePreview
                    ? {
                        backgroundImage: `url(${JSON.stringify(imagePreview)})`,
                      }
                    : undefined
                }
              >
                {!imagePreview &&
                  (draft.displayName.trim().slice(0, 2).toUpperCase() || "CO")}
              </div>
              <div className="min-w-0 space-y-2 sm:contents">
                <label
                  htmlFor="contact-image"
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-black/20 bg-white/80 px-3 py-2 text-xs font-semibold transition hover:bg-black/5 focus-within:ring-2 focus-within:ring-black/30 dark:border-white/20 dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:ring-white/30 sm:w-32"
                >
                  {imagePreview ? "Change image" : "Upload image"}
                  <input
                    id="contact-image"
                    name="contact-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={saving}
                    onChange={selectImage}
                  />
                </label>
                <p className="max-w-48 text-xs leading-relaxed text-black/50 dark:text-white/50 sm:max-w-32">
                  JPG, PNG, or WebP. 5 MB max.
                </p>
              </div>
            </div>
            <div className="w-full min-w-0 space-y-5">
              <div>
                <Input
                  label="Contact name"
                  name="contact-display-name"
                  required
                  value={draft.displayName}
                  maxLength={160}
                  placeholder="Brand, venue, company, team, or group"
                  autoFocus
                  disabled={saving}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                />
              </div>
              {/* The button sits on the field's baseline, so its `md` height
                  matches the input's rather than floating above it. */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Input
                    label="Direct image URL"
                    name="contact-image-url"
                    type="text"
                    value={draft.imageUrl}
                    maxLength={2048}
                    placeholder="https://example.com/logo.png"
                    error={Boolean(imageError)}
                    disabled={saving}
                    onBlur={() => {
                      if (!draft.imageUrl.trim()) return;
                      const normalized = normalizeHttpUrl(draft.imageUrl);
                      if (!normalized) {
                        setImageError("Enter a valid HTTP or HTTPS image URL.");
                        return;
                      }
                      setDraft((current) => ({
                        ...current,
                        imageUrl: normalized,
                      }));
                      setImagePreview(normalized);
                      setImageError("");
                    }}
                    onChange={(event) => {
                      setImageFile(null);
                      setDraft((current) => ({
                        ...current,
                        imageUrl: event.target.value,
                        retainImage: false,
                      }));
                      setImagePreview(event.target.value || null);
                      setImageError("");
                    }}
                  />
                </div>
                {imagePreview && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="field"
                    className="w-full shrink-0 sm:w-auto"
                    disabled={saving}
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setImageError("");
                      setDraft((current) => ({
                        ...current,
                        imageUrl: "",
                        retainImage: false,
                      }));
                    }}
                  >
                    Remove image
                  </Button>
                )}
              </div>
              <DropdownSelect
                variant="field"
                label="Group"
                value={draft.contactGroup}
                options={[
                  { label: "Uncategorized", value: "" },
                  ...CONTACT_GROUPS.map((group) => ({
                    label: group,
                    value: group,
                  })),
                ]}
                disabled={saving}
                onChange={(contactGroup) =>
                  setDraft((current) => ({
                    ...current,
                    contactGroup: contactGroup as ContactDraft["contactGroup"],
                  }))
                }
              />
              {imageError && (
                <p
                  role="alert"
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  {imageError}
                </p>
              )}
              <Textarea
                id="contact-notes"
                name="contact-notes"
                label="Description"
                value={draft.notes}
                maxLength={5000}
                rows={3}
                placeholder="Add context about the contact or relationship"
                disabled={saving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          {/* Existing contacts keep their actions near the fields most often
              edited. People changes remain part of this same form submission. */}
          {contact && <div className="mt-6">{editorActions}</div>}
        </Card>

        <Card size="lg" className="space-y-3">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-caps">
                People <CountBadge>{draft.people.length}</CountBadge>
              </h2>
              <p className="mt-1 text-xs text-black/55 dark:text-white/55">
                Add the individual people associated with this contact.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full whitespace-nowrap sm:w-auto sm:shrink-0"
              leftIcon={<FiPlus />}
              disabled={activePersonIndex !== null || saving}
              onClick={() => {
                setPeopleQuery("");
                setPersonBeforeEdit(null);
                setRemovePersonOnCancel(true);
                setDraft((current) => ({
                  ...current,
                  people: [...current.people, blankPerson()],
                }));
                setActivePersonIndex(draft.people.length);
              }}
            >
              Add person
            </Button>
          </div>
          {draft.people.length === 0 && (
            <p className="rounded-xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-black/55 dark:border-white/15 dark:text-white/55">
              {contact
                ? "No people added yet. Add anyone you know here, then save your changes."
                : "No people added yet. Add the people you know here before creating the contact."}
            </p>
          )}
          {activePerson && activePersonIndex !== null && (
            <Modal
              open
              setIsOpen={(open) => {
                if (!open && !saving) cancelPersonEdit();
              }}
              title={activePerson.id ? "Edit person" : "Add person"}
              description="Add their name and the best ways to reach them."
              size="xl"
              actions={
                <ModalActions
                  confirmLabel={activePerson.id ? "Save person" : "Add person"}
                  confirmDisabled={
                    !activePerson.full_name.trim() ||
                    [...activePerson.emails, ...activePerson.phones].some(
                      (method) => !method.value.trim(),
                    ) ||
                    saving
                  }
                  onCancel={cancelPersonEdit}
                  onConfirm={() => {
                    setActivePersonIndex(null);
                    setPersonBeforeEdit(null);
                    setRemovePersonOnCancel(false);
                  }}
                />
              }
              supportingActions={
                activePerson.id ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    leftIcon={<FiTrash2 aria-hidden />}
                    disabled={saving}
                    onClick={() => removePerson(activePersonIndex)}
                  >
                    Remove person
                  </Button>
                ) : undefined
              }
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr]">
                <Input
                  label="Name"
                  name={`person-${activePersonIndex}-name`}
                  required
                  autoFocus={!activePerson.id}
                  disabled={saving}
                  value={activePerson.full_name}
                  maxLength={160}
                  onChange={(event) =>
                    updatePerson(activePersonIndex, {
                      full_name: event.target.value,
                    })
                  }
                />
                <Input
                  label="Title"
                  name={`person-${activePersonIndex}-title`}
                  value={activePerson.title ?? ""}
                  maxLength={160}
                  placeholder="Partnerships manager"
                  disabled={saving}
                  onChange={(event) =>
                    updatePerson(activePersonIndex, {
                      title: event.target.value,
                    })
                  }
                />
                <div className="md:col-span-2 xl:col-span-1">
                  <Input
                    label="Instagram handle"
                    name={`person-${activePersonIndex}-instagram`}
                    value={activePerson.instagram_handle ?? ""}
                    maxLength={100}
                    placeholder="@handle"
                    disabled={saving}
                    onChange={(event) =>
                      updatePerson(activePersonIndex, {
                        instagram_handle: formatInstagramHandle(
                          event.target.value,
                        ),
                      })
                    }
                  />
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-black/10 bg-white/50 p-3 dark:border-white/10 dark:bg-black/10 sm:p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold">Contact details</h3>
                  <p className="mt-1 text-xs text-black/55 dark:text-white/55">
                    Add as many ways to reach this person as you need.
                  </p>
                </div>
                <div className="grid gap-5 xl:grid-cols-2 xl:gap-6">
                  <ContactMethodsEditor
                    kind="email"
                    personIndex={activePersonIndex}
                    methods={activePerson.emails}
                    disabled={saving}
                    onChange={(emails) =>
                      updatePerson(activePersonIndex, { emails })
                    }
                  />
                  <div>
                    <ContactMethodsEditor
                      kind="phone"
                      personIndex={activePersonIndex}
                      methods={activePerson.phones}
                      disabled={saving}
                      onChange={(phones) =>
                        updatePerson(activePersonIndex, { phones })
                      }
                    />
                  </div>
                </div>
              </div>
            </Modal>
          )}
          {draft.people.length >= 8 && (
            <SearchInput
              label="Search people"
              name="people-search"
              value={peopleQuery}
              onChange={(event) => setPeopleQuery(event.target.value)}
              placeholder="Search by name, title, email, or phone..."
              disabled={saving}
              pending={peopleSearchPending}
              pendingLabel="Loading people results"
            />
          )}
          <div
            className="grid grid-cols-1 gap-2 lg:grid-cols-2"
            aria-busy={peopleSearchPending}
          >
            {displayedPeople
              .filter(({ index }) => index !== activePersonIndex)
              .map(({ person, index }) => (
                <div
                  key={person.id ?? index}
                  className="rounded-xl border border-black/10 bg-black/[0.025] dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {person.full_name.trim() || "New person"}
                      </p>
                      {person.title && (
                        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-black/55 dark:text-white/55">
                          <FiBriefcase aria-hidden className="shrink-0" />
                          <span className="truncate">{person.title}</span>
                        </p>
                      )}
                      <div className="mt-1 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-black/60 dark:text-white/60">
                        {person.emails[0] && (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <FiMail aria-hidden className="shrink-0" />
                            <span className="truncate">
                              {person.emails[0].label
                                ? `${person.emails[0].label}: `
                                : ""}
                              {person.emails[0].value}
                              {person.emails.length > 1
                                ? ` +${person.emails.length - 1}`
                                : ""}
                            </span>
                          </span>
                        )}
                        {person.phones[0] && (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <FiPhone aria-hidden className="shrink-0" />
                            <span className="truncate">
                              {person.phones[0].label
                                ? `${person.phones[0].label}: `
                                : ""}
                              {formatPhoneNumber(person.phones[0].value)}
                              {person.phones.length > 1
                                ? ` +${person.phones.length - 1}`
                                : ""}
                            </span>
                          </span>
                        )}
                        {person.instagram_handle && (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <FiInstagram aria-hidden className="shrink-0" />
                            <span className="truncate">
                              @{formatInstagramHandle(person.instagram_handle)}
                            </span>
                          </span>
                        )}
                        {!person.emails[0] &&
                          !person.phones[0] &&
                          !person.instagram_handle && (
                            <span>No contact details</span>
                          )}
                      </div>
                    </div>
                    <IconButton
                      label={`Edit ${person.full_name.trim() || `person ${index + 1}`}`}
                      variant="edit"
                      onClick={() => {
                        setPersonBeforeEdit({
                          ...person,
                          emails: person.emails.map((method) => ({
                            ...method,
                          })),
                          phones: person.phones.map((method) => ({
                            ...method,
                          })),
                        });
                        setRemovePersonOnCancel(false);
                        setActivePersonIndex(index);
                      }}
                      disabled={saving}
                    >
                      <FiEdit2 aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Remove ${person.full_name.trim() || `person ${index + 1}`}`}
                      variant="danger"
                      disabled={saving}
                      onClick={() => removePerson(index)}
                    >
                      <FiTrash2 aria-hidden />
                    </IconButton>
                  </div>
                </div>
              ))}
          </div>
          {draft.people.length > 0 &&
            displayedPeople.filter(({ index }) => index !== activePersonIndex)
              .length === 0 &&
            !activePerson && (
              <p className="rounded-xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-black/55 dark:border-white/15 dark:text-white/55">
                No people match that search.
              </p>
            )}
        </Card>
        {!contact && editorActions}
      </form>
    </div>
  );
}
