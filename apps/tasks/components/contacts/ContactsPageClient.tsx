"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchFilter } from "@ryanmeetup/hooks";
import { formatInstagramHandle, formatPhoneNumber } from "@ryanmeetup/utils";
import {
  AnimatedCollapse,
  Button,
  ConfirmationDialog,
  EmptyState,
  IconButton,
  ManagementSurface,
  PendingResults,
  SearchInput,
  toast,
  Tooltip,
} from "@ryanmeetup/ui";
import {
  FiBriefcase,
  FiChevronDown,
  FiChevronsDown,
  FiChevronsUp,
  FiEdit2,
  FiInstagram,
  FiMail,
  FiPhone,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { CountBadge, WorkspacePageShell } from "@/components/global";
import { contactEditPath } from "@/lib/contacts/contact-slug";
import { CONTACT_GROUPS, type Contact } from "@/lib/contacts/contact-types";
import { mutate } from "@/lib/mutation-client";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { errorMessage } from "@/lib/presentation";

function contactSearchText(contact: Contact) {
  return [
    contact.display_name,
    contact.contact_group,
    contact.notes,
    ...contact.categories.map((category) => category.name),
    ...contact.people.flatMap((person) => [
      person.full_name,
      person.title,
      ...person.emails.flatMap((method) => [method.label, method.value]),
      ...person.phones.flatMap((method) => [method.label, method.value]),
      person.instagram_handle,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function ContactsPageClient({
  initialData,
  initialContacts,
  demoMode,
}: {
  initialData: WorkspaceData;
  initialContacts: Contact[];
  demoMode: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [contacts, setContacts] = useState(initialContacts);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [deletingPending, setDeletingPending] = useState(false);
  const previewing = Boolean(data.accessPreview);
  const [expandedPeopleIds, setExpandedPeopleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    const medium = window.matchMedia("(min-width: 768px)");
    const extraLarge = window.matchMedia("(min-width: 1536px)");
    const updateColumnCount = () =>
      setColumnCount(extraLarge.matches ? 3 : medium.matches ? 2 : 1);

    updateColumnCount();
    medium.addEventListener("change", updateColumnCount);
    extraLarge.addEventListener("change", updateColumnCount);
    return () => {
      medium.removeEventListener("change", updateColumnCount);
      extraLarge.removeEventListener("change", updateColumnCount);
    };
  }, []);

  function togglePeople(contactId: string) {
    setExpandedPeopleIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  function toggleGroup(groupId: string) {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const {
    query,
    setQuery,
    filtered: searchedContacts,
    isPending: searchPending,
  } = useSearchFilter({
    data: contacts,
    buildHaystack: contactSearchText,
    queryParam: "contact-search",
  });
  const sortedContacts = useMemo(
    () =>
      [...searchedContacts].sort((a, b) =>
        a.display_name.localeCompare(b.display_name),
      ),
    [searchedContacts],
  );
  const contactGroups = useMemo(
    () =>
      [...CONTACT_GROUPS, null].flatMap((group) => {
        const groupContacts = sortedContacts.filter(
          (contact) => contact.contact_group === group,
        );
        if (!groupContacts.length) return [];
        return [
          {
            group,
            id: group
              ? group.toLowerCase().replace(/[^a-z0-9]+/g, "-")
              : "uncategorized",
            label: group ?? "Uncategorized",
            columns: Array.from({ length: columnCount }, (_, columnIndex) =>
              groupContacts.filter(
                (_, contactIndex) => contactIndex % columnCount === columnIndex,
              ),
            ),
            count: groupContacts.length,
          },
        ];
      }),
    [columnCount, sortedContacts],
  );
  const allExpanded =
    sortedContacts.length > 0 &&
    collapsedGroupIds.size === 0 &&
    sortedContacts.every((contact) => expandedPeopleIds.has(contact.id));

  function toggleAll() {
    if (allExpanded) {
      setCollapsedGroupIds(new Set(contactGroups.map((group) => group.id)));
      setExpandedPeopleIds(new Set());
      return;
    }
    setCollapsedGroupIds(new Set());
    setExpandedPeopleIds(new Set(sortedContacts.map((contact) => contact.id)));
  }

  async function deleteContact() {
    if (!deleting) return;
    setDeletingPending(true);
    try {
      if (!demoMode)
        await mutate("/api/contacts", {
          method: "DELETE",
          body: JSON.stringify({ id: deleting.id }),
        });
      setContacts((current) =>
        current.filter((contact) => contact.id !== deleting.id),
      );
      setDeleting(null);
      toast.success("Contact deleted.");
    } catch (error) {
      toast.error(errorMessage(error, "The contact could not be deleted."));
    } finally {
      setDeletingPending(false);
    }
  }

  return (
    <>
      <WorkspacePageShell
        data={data}
        setData={setData}
        demoMode={demoMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        contentClassName="p-3 sm:p-6 lg:p-6 xl:p-8"
      >
        <ManagementSurface
          title={
            <>
              Contacts{" "}
              <CountBadge size="lg">{sortedContacts.length}</CountBadge>
            </>
          }
          description="Browse the brands, venues, sponsors, teams, and groups we know, with the right people listed under each one."
          actions={
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full sm:w-auto"
                leftIcon={
                  allExpanded ? (
                    <FiChevronsUp aria-hidden />
                  ) : (
                    <FiChevronsDown aria-hidden />
                  )
                }
                onClick={toggleAll}
                disabled={sortedContacts.length === 0}
              >
                {allExpanded ? "Collapse All" : "Expand All"}
              </Button>
              {previewing ? (
                <Tooltip
                  content="Exit access preview to change contacts"
                  triggerClassName="w-full sm:w-auto"
                >
                  <Button
                    type="button"
                    size="sm"
                    className="w-full sm:w-auto"
                    leftIcon={<FiPlus aria-hidden />}
                    disabled
                  >
                    New Contact
                  </Button>
                </Tooltip>
              ) : (
                <Button.Link
                  href="/contacts/new"
                  size="sm"
                  className="w-full sm:w-auto"
                  leftIcon={<FiPlus aria-hidden />}
                >
                  New Contact
                </Button.Link>
              )}
            </>
          }
        >
          <div className="sticky top-0 z-20 -mx-1 mb-4 bg-white px-1 pb-3 dark:bg-[#181818]">
            <SearchInput
              label="Search contacts"
              name="contact-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search contacts and people..."
              pending={searchPending}
              pendingLabel="Loading contact results"
            />
          </div>
          <PendingResults pending={searchPending} label="Loading contacts">
            {sortedContacts.length === 0 ? (
              <EmptyState
                className="py-12"
                message={
                  contacts.length === 0
                    ? "No contacts yet. Add one using the button above."
                    : "No contacts or people match that search."
                }
              />
            ) : (
              <div className="space-y-8">
                {contactGroups.map(({ group, id, label, columns, count }) => {
                  const open = !collapsedGroupIds.has(id);
                  return (
                    <section key={id}>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`contact-group-${id}`}
                        onClick={() => toggleGroup(id)}
                        className="flex w-full items-center gap-2 rounded-lg border-b border-black/10 pb-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:focus-visible:ring-white/30"
                      >
                        <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                          {label}
                        </span>
                        <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold dark:bg-white/10">
                          {count}
                        </span>
                        <FiChevronDown
                          aria-hidden
                          className={`ml-auto transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      <AnimatedCollapse id={`contact-group-${id}`} open={open}>
                        <div
                          className="grid items-start gap-4 pt-3"
                          style={{
                            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                          }}
                        >
                          {columns.map((column, columnIndex) => (
                            <div
                              key={`${group ?? "uncategorized"}-column-${columnIndex}`}
                              className="min-w-0 space-y-4"
                            >
                              {column.map((contact) => (
                                <article
                                  key={contact.id}
                                  className="w-full rounded-2xl border border-black/15 bg-black/[0.035] p-5 shadow-sm shadow-black/5 dark:border-white/10 dark:bg-white/[0.055]"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="flex min-w-0 items-center gap-3">
                                        <span
                                          role="img"
                                          aria-label={`${contact.display_name} image`}
                                          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-black/10 bg-black/5 bg-cover bg-center text-sm font-semibold text-black/50 dark:border-white/10 dark:bg-white/10 dark:text-white/50"
                                          style={
                                            contact.image_url
                                              ? {
                                                  backgroundImage: `url(${JSON.stringify(contact.image_url)})`,
                                                }
                                              : undefined
                                          }
                                        >
                                          {!contact.image_url &&
                                            contact.display_name
                                              .slice(0, 2)
                                              .toUpperCase()}
                                        </span>
                                        <div className="min-w-0">
                                          <h2 className="truncate text-lg font-semibold">
                                            {contact.display_name}
                                          </h2>
                                        </div>
                                      </div>
                                    </div>
                                    {!previewing && (
                                      <div className="flex shrink-0 gap-1">
                                        <IconButton.Link
                                          href={contactEditPath(
                                            contact,
                                            contacts,
                                          )}
                                          label={`Edit “${contact.display_name}”`}
                                          variant="edit"
                                        >
                                          <FiEdit2 />
                                        </IconButton.Link>
                                        <IconButton
                                          label={`Delete “${contact.display_name}”`}
                                          variant="danger"
                                          onClick={() => setDeleting(contact)}
                                        >
                                          <FiTrash2 />
                                        </IconButton>
                                      </div>
                                    )}
                                  </div>
                                  {contact.notes && (
                                    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-black/65 dark:text-white/65">
                                      {contact.notes}
                                    </p>
                                  )}
                                  <div className="mt-5 border-t border-black/10 dark:border-white/10">
                                    <button
                                      type="button"
                                      aria-expanded={expandedPeopleIds.has(
                                        contact.id,
                                      )}
                                      aria-controls={`contact-people-${contact.id}`}
                                      onClick={() => togglePeople(contact.id)}
                                      className="flex w-full items-center gap-2 rounded-lg py-3 text-xs font-semibold uppercase tracking-[0.18em] text-black/65 transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/65 dark:hover:text-white dark:focus-visible:ring-white/30"
                                    >
                                      <span>People</span>
                                      <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] tracking-normal dark:bg-white/10">
                                        {contact.people.length}
                                      </span>
                                      <FiChevronDown
                                        aria-hidden
                                        className={`ml-auto transition-transform duration-200 motion-reduce:transition-none ${expandedPeopleIds.has(contact.id) ? "rotate-180" : ""}`}
                                      />
                                    </button>
                                    <AnimatedCollapse
                                      id={`contact-people-${contact.id}`}
                                      open={expandedPeopleIds.has(contact.id)}
                                    >
                                      <div className="grid divide-y divide-black/10 border-t border-black/10 md:grid-cols-2 md:gap-x-8 md:divide-y-0 dark:divide-white/10 dark:border-white/10">
                                        {contact.people.length === 0 ? (
                                          <p className="py-4 text-sm text-black/50 dark:text-white/50">
                                            No people added yet.
                                          </p>
                                        ) : (
                                          contact.people.map((person) => (
                                            <div
                                              key={person.id}
                                              className="py-4 last:pb-0"
                                            >
                                              <p className="font-semibold">
                                                {person.full_name}
                                              </p>
                                              {person.title && (
                                                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-black/55 dark:text-white/55">
                                                  <FiBriefcase
                                                    aria-hidden
                                                    className="shrink-0"
                                                  />
                                                  <span className="truncate">
                                                    {person.title}
                                                  </span>
                                                </p>
                                              )}
                                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-black/65 dark:text-white/65">
                                                {person.emails.map((email) => (
                                                  <a
                                                    key={`${email.label ?? ""}-${email.value}`}
                                                    className="inline-flex items-center gap-1.5 hover:text-black dark:hover:text-white"
                                                    href={`mailto:${email.value}`}
                                                  >
                                                    <FiMail aria-hidden />
                                                    <span>
                                                      {email.label && (
                                                        <span className="mr-1 text-black/45 dark:text-white/45">
                                                          {email.label}:
                                                        </span>
                                                      )}
                                                      {email.value}
                                                    </span>
                                                  </a>
                                                ))}
                                                {person.phones.map((phone) => (
                                                  <a
                                                    key={`${phone.label ?? ""}-${phone.value}`}
                                                    className="inline-flex items-center gap-1.5 hover:text-black dark:hover:text-white"
                                                    href={`tel:${phone.value}`}
                                                  >
                                                    <FiPhone aria-hidden />
                                                    <span>
                                                      {phone.label && (
                                                        <span className="mr-1 text-black/45 dark:text-white/45">
                                                          {phone.label}:
                                                        </span>
                                                      )}
                                                      {formatPhoneNumber(
                                                        phone.value,
                                                      )}
                                                    </span>
                                                  </a>
                                                ))}
                                                {person.instagram_handle && (
                                                  <a
                                                    className="inline-flex items-center gap-1.5 hover:text-black dark:hover:text-white"
                                                    href={`https://instagram.com/${formatInstagramHandle(person.instagram_handle)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                  >
                                                    <FiInstagram aria-hidden />@
                                                    {formatInstagramHandle(
                                                      person.instagram_handle,
                                                    )}
                                                  </a>
                                                )}
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </AnimatedCollapse>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ))}
                        </div>
                      </AnimatedCollapse>
                    </section>
                  );
                })}
              </div>
            )}
          </PendingResults>
        </ManagementSurface>
      </WorkspacePageShell>

      <ConfirmationDialog
        open={Boolean(deleting)}
        setOpen={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.display_name ?? "this contact"}?`}
        description="This permanently removes the contact and every person saved beneath it."
        confirmLabel="Delete contact"
        pending={deletingPending}
        destructive
        onConfirm={() => void deleteContact()}
      />
    </>
  );
}
