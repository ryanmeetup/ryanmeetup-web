import type {
  ChampionRyan,
  RepeatRyan,
  TravelingRyan,
} from "@/lib/types";
import { createImage } from "@/lib/test-fixtures/images";

const getAwardsFixture = () => {
  const farthest: TravelingRyan[] = [
    {
      fullName: "Ryan Traveler",
      headshot: createImage("ryanroundup.png"),
      traveledTo: "New York, NY",
      traveledFrom: "Los Angeles, CA",
      milesTraveled: 2450,
      event: "Ryan Roundup",
      date: new Date(),
      eventDate: "Jan 1, 2024",
      instagram: "https://www.instagram.com/ryantraveler/",
    },
  ];

  const champs: ChampionRyan[] = [
    {
      fullName: "Ryan Champion",
      headshot: createImage("ryanroundup.png"),
      event: "Ryan Royale",
      date: new Date(),
      eventDate: "Sep 1, 2024",
      title: "Little King",
      location: "New York, NY",
      instagram: "https://www.instagram.com/ryanchampion/",
    },
  ];

  // Mirrors the ordered `eventsAttended` checkbox options on the Contentful
  // `leaderboard` content type, at the length the real list has grown to. The
  // last entry is a scheduled event nobody has attended yet, so it must not
  // end anyone's streak.
  const timeline = [
    "Ryan Roundup",
    "Ryan Rendezvous",
    "Ryan Retreat",
    "Ryan Rave",
    "Rytoberfest",
    "Ryan Claus",
    "Ryan Rodeo",
    "St. Ryan's Day",
    "Ryami Vice",
    "Ryan Red Carpet",
    "Ryan Royale",
    "Ryan's Game Show",
    "St. Ryan's Day II",
    "Ryans @ Rockies",
    "Ryan Summit",
    "Rytoberfest II",
    "Ryans Own Manhattan",
    "St. Ryan's Day III",
    "Ryde the Ryan Coaster",
    "Ryan Baseball Classic",
    "Welcome to Ryan",
    "Ryan Rave II",
  ];

  // Everything except the scheduled meetup on the end.
  const held = timeline.slice(0, -1);

  const createRepeat = (
    id: string,
    fullName: string,
    basedIn: string,
    eventsAttended: string[],
  ): RepeatRyan => ({
    id,
    fullName,
    headshot: createImage("ryanroundup.png"),
    basedIn,
    eventsAttended,
  });

  const repeats: RepeatRyan[] = [
    // The most meetups attended, so rank one, even though the run they strung
    // together is shorter than Ryan Streak's.
    createRepeat(
      "repeat-ryan",
      "Ryan Repeat",
      "Chicago, IL",
      held.filter(
        (event) =>
          !["Ryan Retreat", "Ryami Vice", "Ryans @ Rockies"].includes(event),
      ),
    ),
    // The longest streak on the board: every meetup through Ryan Summit.
    createRepeat("streak-ryan", "Ryan Streak", "Denver, CO", held.slice(0, 15)),
    // Ties Ryan Even on meetups attended with a shorter streak, so the two
    // share a rank while listing in streak order.
    createRepeat("even-ryan", "Ryan Even", "Queens, NY", held.slice(0, 12)),
    createRepeat("odd-ryan", "Ryan Odd", "Kenton, OH", [
      ...held.slice(0, 8),
      held[9],
      held[11],
      held[13],
      held[15],
    ]),
    // Two different Ryans who happen to share a name, which the board can only
    // tell apart by entry id.
    createRepeat(
      "namesake-one",
      "Ryan Namesake",
      "Austin, TX",
      held.slice(0, 10),
    ),
    createRepeat(
      "namesake-two",
      "Ryan Namesake",
      "Boston, MA",
      held.slice(0, 9),
    ),
    // Four meetups, so they do not qualify.
    createRepeat("few-ryan", "Ryan Few", "Detroit, MI", held.slice(0, 4)),
  ];

  return { farthest, champs, repeats, timeline };
};

export { getAwardsFixture };
