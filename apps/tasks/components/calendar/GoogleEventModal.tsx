"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Avatar, Button, Modal } from "@ryanmeetup/ui";
import {
  FiAlignLeft,
  FiCalendar,
  FiCheck,
  FiCopy,
  FiExternalLink,
  FiLink,
  FiMapPin,
  FiPaperclip,
  FiPhone,
  FiRepeat,
  FiUsers,
  FiVideo,
} from "react-icons/fi";
import { EditorPageSurface } from "@/components/global";
import {
  googleAttendeeName,
  googleEventPlace,
  googleEventRelativeWhen,
  googleEventWhen,
  googleNoteBlocks,
  googleResponseCounts,
  googleResponseLabel,
  linkedTextParts,
} from "@/lib/calendar/google-event-details";
import type {
  GoogleCalendarAttendee,
  GoogleCalendarConferenceEntry,
  GoogleCalendarEvent,
  GoogleCalendarResponse,
} from "@/lib/calendar/google-calendar-types";

// A roster longer than this is a mailing list rather than a guest list, and
// scrolling past it to reach the buttons helps nobody, so the rest waits behind
// a click. The same for a description that runs to a page of dial-in details.
const GUEST_PREVIEW = 8;
const LONG_NOTE_CHARACTERS = 600;
const LONG_NOTE_LINES = 12;

const responseStyles: Record<GoogleCalendarResponse, string> = {
  accepted:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-200",
  tentative:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:text-amber-200",
  declined:
    "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:border-rose-400/30 dark:text-rose-200",
  needsAction:
    "border-black/15 bg-black/[0.04] text-black/70 dark:border-white/15 dark:bg-white/[0.07] dark:text-white/70",
};

const quietText = "text-black/70 dark:text-white/70";

const inlineButton =
  "rounded-md text-xs font-semibold text-blue-700 underline underline-offset-2 transition hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-blue-300 dark:hover:text-blue-200";

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      {/* The headings are what a reader scans on the way to the one part of the
          invite they opened it for, so each carries its icon on a tile and runs
          its rule to the edge, which reads as a band rather than as a caption
          on the paragraph under it. */}
      <h3 className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/[0.06] text-[13px] text-black/70 dark:bg-white/10 dark:text-white/70"
        >
          {icon}
        </span>
        <span className="text-xs font-bold uppercase tracking-caps-tight text-black dark:text-white">
          {title}
        </span>
        <span aria-hidden className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </h3>
      {children}
    </section>
  );
}

// Description text arrives flattened from HTML, so the links inside it are
// rebuilt as real anchors instead of being handed back to the browser as markup.
function LinkedText({ text }: { text: string }) {
  return (
    <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${quietText}`}>
      {linkedTextParts(text).map((part) =>
        part.url ? (
          <a
            key={part.key}
            href={part.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200"
          >
            {part.text}
          </a>
        ) : (
          <span key={part.key}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function ConferenceRow({ entry }: { entry: GoogleCalendarConferenceEntry }) {
  const details = [
    entry.meetingCode && `Code ${entry.meetingCode}`,
    entry.pin && `PIN ${entry.pin}`,
    entry.regionCode,
  ].filter(Boolean);
  if (entry.kind === "video")
    return (
      <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.07] p-3 dark:border-blue-400/25 dark:bg-blue-400/10">
        <Button.Link href={entry.uri} newTab size="sm" fullWidth leftIcon={<FiVideo />}>
          Join {entry.label}
        </Button.Link>
        <p className={`mt-2 truncate text-center text-[11px] ${quietText}`}>
          {details.length ? details.join(" · ") : entry.uri.replace(/^https?:\/\//, "")}
        </p>
      </div>
    );
  return (
    <a
      href={entry.uri}
      {...(entry.kind === "phone" ? {} : { target: "_blank", rel: "noreferrer" })}
      className="flex items-center gap-3 rounded-xl border border-black/10 bg-black/[0.025] px-3 py-2 text-sm transition hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] dark:focus-visible:ring-white/40"
    >
      <span aria-hidden className="text-black/45 dark:text-white/45">
        {entry.kind === "phone" ? <FiPhone /> : <FiLink />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{entry.label}</span>
        {details.length > 0 && (
          <span className={`block truncate text-[11px] ${quietText}`}>
            {details.join(" · ")}
          </span>
        )}
      </span>
    </a>
  );
}

function AttendeeRow({ attendee }: { attendee: GoogleCalendarAttendee }) {
  const name = googleAttendeeName(attendee);
  const note = [
    attendee.self && "You",
    attendee.organizer && "Organizer",
    attendee.optional && "Optional",
  ].filter(Boolean);
  return (
    <li className={`flex items-center gap-3 py-1.5 ${attendee.self ? "font-medium" : ""}`}>
      <Avatar name={name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {name}
          {note.length > 0 && (
            <span className={`ml-1.5 text-xs font-normal ${quietText}`}>
              {note.join(" · ")}
            </span>
          )}
        </span>
        {attendee.email && attendee.name && (
          <span className={`block truncate text-xs ${quietText}`}>{attendee.email}</span>
        )}
      </span>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-caps-tight ${responseStyles[attendee.response]}`}
      >
        {googleResponseLabel(attendee.response)}
      </span>
    </li>
  );
}

/** Copies the meeting address without leaving the dialog for the calendar. */
function CopyJoinLink({ uri }: { uri: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant="secondary"
      size="sm"
      leftIcon={copied ? <FiCheck /> : <FiCopy />}
      onClick={() => {
        navigator.clipboard
          ?.writeText(uri)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
      }}
    >
      {copied ? "Copied" : "Copy join link"}
    </Button>
  );
}

/**
 * The full invite for one imported Google event. Clicking a tile lands here
 * instead of on Google, so the description, guest list, and joining details are
 * readable in place; Google itself stays one button away for anyone who needs
 * to reply to the invite or change it.
 */
export function GoogleEventModal({
  event,
  onClose,
  presentation = "modal",
}: {
  event: GoogleCalendarEvent | null;
  onClose: () => void;
  /** `page` is `/calendar/google/[id]`, the invite as its own page on a phone. */
  presentation?: "modal" | "page";
}) {
  // A dialog reused for the next event opens on that event's own defaults
  // rather than on how far the last reader had unfolded the one before it, so
  // the unfolding is tracked against the event it was done to.
  const [unfolded, setUnfolded] = useState({
    id: event?.id,
    notes: false,
    guests: false,
  });
  if (unfolded.id !== event?.id)
    setUnfolded({ id: event?.id, notes: false, guests: false });
  const { notes: notesOpen, guests: allGuests } = unfolded;

  const attendees = event?.attendees ?? [];
  const people = attendees.filter((attendee) => !attendee.resource);
  const rooms = attendees.filter((attendee) => attendee.resource);
  const counts = googleResponseCounts(attendees);
  const guestSummary = [
    counts.accepted && `${counts.accepted} going`,
    counts.tentative && `${counts.tentative} maybe`,
    counts.declined && `${counts.declined} not going`,
    counts.needsAction && `${counts.needsAction} awaiting reply`,
  ]
    .filter(Boolean)
    .join(" · ");
  // The list is capped so one all-hands invite cannot dominate the month load.
  const guestCount = event?.guestCount ?? people.length;
  const hiddenGuests = Math.max(0, guestCount - people.length);
  const shownGuests = allGuests ? people : people.slice(0, GUEST_PREVIEW);
  const organizerName = event?.organizer?.name || event?.organizer?.email;
  const place = googleEventPlace(event?.location, rooms);
  const noteBlocks = event?.description ? googleNoteBlocks(event.description) : [];
  const longNote = Boolean(
    event?.description &&
      (event.description.length > LONG_NOTE_CHARACTERS ||
        event.description.split("\n").length > LONG_NOTE_LINES),
  );
  const joinLink = event?.conference?.find((entry) => entry.kind === "video")?.uri;
  // Nothing here can send a reply, so an unanswered invite says as much and
  // points the primary button at the one place that can.
  const awaitingYou = attendees.some(
    (attendee) => attendee.self && attendee.response === "needsAction",
  );
  const relative = event ? googleEventRelativeWhen(event) : null;
  const bare =
    event &&
    !event.description &&
    !event.location &&
    !event.conference?.length &&
    !event.attachments?.length &&
    !attendees.length;

  const title = event?.title ?? "Google Calendar event";
  const description =
    event && (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{googleEventWhen(event)}</span>
        {relative && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              relative.past
                ? "border-black/15 bg-black/[0.04] text-black/60 dark:border-white/15 dark:bg-white/[0.07] dark:text-white/60"
                : "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:border-blue-400/30 dark:text-blue-200"
            }`}
          >
            {relative.label}
          </span>
        )}
      </span>
    );
  const actions = (
    <>
      {joinLink ? (
        <CopyJoinLink uri={joinLink} />
      ) : (
        // A page has nothing to close; its trail leads back to Calendar.
        presentation === "modal" && (
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        )
      )}
      {event?.htmlLink && (
        <Button.Link
          href={event.htmlLink}
          newTab
          size="sm"
          leftIcon={<FiExternalLink />}
        >
          {awaitingYou ? "Reply in Google Calendar" : "Open in Google Calendar"}
        </Button.Link>
      )}
    </>
  );
  const content = (
    <>
      {event && (
        <div className="space-y-6">
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs ${quietText}`}>
            <span className="inline-flex items-center gap-1.5 font-semibold text-blue-800 dark:text-blue-200">
              <FiCalendar aria-hidden />
              Google Calendar
            </span>
            {event.recurringEventId && (
              <span className="inline-flex items-center gap-1.5">
                <FiRepeat aria-hidden />
                Part of a repeating event
              </span>
            )}
            {event.tentative && (
              <span className="inline-flex items-center gap-1.5">
                Marked tentative
              </span>
            )}
            {organizerName && <span className="truncate">Organized by {organizerName}</span>}
          </div>

          {awaitingYou && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/30 dark:text-amber-100">
              You have not replied to this invite. Replies are made in Google
              Calendar.
            </p>
          )}

          {event.conference && event.conference.length > 0 && (
            <Section icon={<FiVideo />} title="Join">
              <div className="space-y-2">
                {event.conference.map((entry) => (
                  <ConferenceRow key={entry.uri} entry={entry} />
                ))}
              </div>
            </Section>
          )}

          {place && (
            <Section icon={<FiMapPin />} title="Where">
              <LinkedText text={place} />
            </Section>
          )}

          {noteBlocks.length > 0 && (
            <Section icon={<FiAlignLeft />} title="Notes">
              <div
                className={`relative space-y-3 ${
                  longNote && !notesOpen ? "max-h-56 overflow-hidden" : ""
                }`}
              >
                {noteBlocks.map((block) =>
                  block.kind === "rule" ? (
                    <hr
                      key={block.key}
                      className="border-black/10 dark:border-white/10"
                    />
                  ) : (
                    <LinkedText key={block.key} text={block.text} />
                  ),
                )}
                {longNote && !notesOpen && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white to-transparent dark:from-[#181818]"
                  />
                )}
              </div>
              {longNote && (
                <button
                  type="button"
                  className={inlineButton}
                  onClick={() => setUnfolded((state) => ({ ...state, notes: !state.notes }))}
                >
                  {notesOpen ? "Show less" : "Show more"}
                </button>
              )}
              {event.descriptionTruncated && (
                <p className={`text-xs ${quietText}`}>
                  Shortened here. Open it in Google Calendar to read the rest.
                </p>
              )}
            </Section>
          )}

          {event.attachments && event.attachments.length > 0 && (
            <Section icon={<FiPaperclip />} title="Attachments">
              <ul className="space-y-1.5">
                {event.attachments.map((attachment) => (
                  <li key={attachment.url}>
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-blue-300"
                    >
                      <FiPaperclip aria-hidden className="shrink-0" />
                      <span className="truncate">{attachment.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {people.length > 0 && (
            <Section icon={<FiUsers />} title={`Guests · ${guestCount}`}>
              {guestSummary && <p className={`text-xs ${quietText}`}>{guestSummary}</p>}
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {shownGuests.map((attendee) => (
                  <AttendeeRow
                    key={attendee.email ?? googleAttendeeName(attendee)}
                    attendee={attendee}
                  />
                ))}
              </ul>
              {people.length > GUEST_PREVIEW && (
                <button
                  type="button"
                  className={inlineButton}
                  onClick={() => setUnfolded((state) => ({ ...state, guests: !state.guests }))}
                >
                  {allGuests ? "Show fewer guests" : `Show all ${people.length} guests`}
                </button>
              )}
              {hiddenGuests > 0 && (
                <p className={`text-xs ${quietText}`}>
                  {hiddenGuests} more {hiddenGuests === 1 ? "guest is" : "guests are"} on
                  this invite. Open it in Google Calendar for the full list.
                </p>
              )}
            </Section>
          )}

          {rooms.length > 0 && (
            <Section icon={<FiMapPin />} title="Rooms and equipment">
              <ul className={`space-y-1 text-sm ${quietText}`}>
                {rooms.map((room) => (
                  <li key={room.email ?? googleAttendeeName(room)} className="truncate">
                    {googleAttendeeName(room)}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {bare && (
            <p className={`rounded-xl border border-black/10 bg-black/[0.025] p-4 text-sm dark:border-white/10 dark:bg-white/[0.04] ${quietText}`}>
              Google shared nothing beyond the title and time for this event. Open it in
              Google Calendar if you expected notes or a guest list.
            </p>
          )}
        </div>
      )}
    </>
  );

  return presentation === "page" ? (
    <EditorPageSurface
      parents={[
        {
          href: "/calendar",
          title: "Calendar",
          icon: <FiCalendar aria-hidden className="shrink-0" />,
        },
      ]}
      crumb={{ title }}
      title={title}
      description={description}
      actions={actions}
    >
      {content}
    </EditorPageSurface>
  ) : (
    <Modal
      open={Boolean(event)}
      setIsOpen={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      title={title}
      description={description}
      actions={actions}
    >
      {content}
    </Modal>
  );
}
