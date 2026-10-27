import { describe, expect, it } from "vitest";
import { rydDecisionSchema } from "@/lib/api-schema";
import {
  birthYear,
  normalizeRydCard,
  parseOptionsDetail,
  rydCardDraft,
  rydCardProblems,
  savedRydCard,
} from "@/lib/ryd/card";

const today = new Date("2026-10-27T12:00:00Z");
const billing = { firstName: "Jamie", lastName: "Perez" };

describe("Chipply options", () => {
  it("reads every bracketed option, keeping colons and commas in values", () => {
    const options = parseOptionsDetail(
      "[First Name : Ryan] [Last Name : Le] [Location : Brooklyn, NY] [Full Birthday : 04/07/1999] [Note : a: b]",
    );
    expect(Object.fromEntries(options)).toEqual({
      "first name": "Ryan",
      "last name": "Le",
      location: "Brooklyn, NY",
      "full birthday": "04/07/1999",
      note: "a: b",
    });
  });

  it("ignores blocks without a label", () => {
    expect(parseOptionsDetail("[no colon] text [ : x]").size).toBe(0);
  });
});

describe("Ryan since", () => {
  it.each([
    ["04/07/1999", "1999"],
    ["April 7, 1999", "1999"],
    ["1999-04-07", "1999"],
  ])("takes the four-digit year from %s", (birthday, year) => {
    expect(birthYear(birthday, today)).toEqual({ year, suggestion: null });
  });

  it.each([
    ["07/14/76", "1976"],
    ["3-5-04", "2004"],
    ["Dec 3 '88", "1988"],
  ])("only suggests a year for %s", (birthday, suggestion) => {
    expect(birthYear(birthday, today)).toEqual({ year: null, suggestion });
  });

  it.each(["Dec 3", "", "December 13", "2099"])(
    "leaves %j for a person to fill in",
    (birthday) => {
      expect(birthYear(birthday, today)).toEqual({
        year: null,
        suggestion: null,
      });
    },
  );
});

describe("card drafts", () => {
  it("builds the card from Options Detail, not the buyer", () => {
    const draft = rydCardDraft(
      {
        "Options Detail":
          "[First Name : Ryan] [Last Name : Pérez] [Location : Cleveland Ohio] [Full Birthday : 07/14/76]",
      },
      billing,
      today,
    );
    expect(draft).toEqual({
      card: {
        firstName: "Ryan",
        lastName: "Pérez",
        location: "Cleveland Ohio",
        ryanSince: "",
      },
      hint: {
        birthday: "07/14/76",
        yearSuggestion: "1976",
        nameFrom: "options",
      },
    });
  });

  it("falls back to the billing name without Options Detail", () => {
    expect(rydCardDraft({ OrderId: "1" }, billing, today)).toEqual({
      card: {
        firstName: "Jamie",
        lastName: "Perez",
        location: "",
        ryanSince: "",
      },
      hint: { birthday: "", yearSuggestion: null, nameFrom: "billing" },
    });
  });
});

describe("card completeness", () => {
  const card = {
    firstName: "Ryan",
    lastName: "Le",
    location: "Chicago",
    ryanSince: "1999",
  };

  it("accepts a complete card", () => {
    expect(rydCardProblems(card, today)).toEqual([]);
  });

  it("names every blank or invalid line", () => {
    expect(
      rydCardProblems(
        { firstName: " ", lastName: "Le", location: "", ryanSince: "76" },
        today,
      ),
    ).toEqual(["First name", "Location", "Ryan since"]);
    expect(rydCardProblems({ ...card, ryanSince: "2027" }, today)).toEqual([
      "Ryan since",
    ]);
  });

  it("trims what it stores and reads back a saved card", () => {
    expect(normalizeRydCard({ ...card, location: " Chicago " }).location).toBe(
      "Chicago",
    );
    expect(savedRydCard({})).toBeNull();
    expect(
      savedRydCard({
        card_first_name: "Ryan",
        card_last_name: "Le",
        card_location: "Chicago",
        card_ryan_since: "1999",
      }),
    ).toEqual(card);
  });
});

describe("card decisions", () => {
  const card = {
    firstName: " Ryan ",
    lastName: "Le",
    location: "Chicago",
    ryanSince: "1999",
  };

  it("accepts a card alone or with a decision, trimmed", () => {
    expect(rydDecisionSchema({ card })).toEqual({
      card: { ...card, firstName: "Ryan" },
    });
    expect(rydDecisionSchema({ status: "verified", card })).toMatchObject({
      status: "verified",
      card: { firstName: "Ryan" },
    });
  });

  it("refuses a partial card, a long line, or a year that isn't four digits", () => {
    const partial = {
      firstName: card.firstName,
      lastName: card.lastName,
      location: card.location,
    };
    expect(rydDecisionSchema({ card: partial })).toBeNull();
    expect(
      rydDecisionSchema({ card: { ...card, location: "x".repeat(121) } }),
    ).toBeNull();
    expect(
      rydDecisionSchema({ card: { ...card, ryanSince: "76" } }),
    ).toBeNull();
    expect(rydDecisionSchema({ card: { ...card, extra: "line" } })).toBeNull();
  });

  it("still allows an unfinished card to be saved", () => {
    expect(
      rydDecisionSchema({ card: { ...card, location: "", ryanSince: "" } }),
    ).not.toBeNull();
  });
});
