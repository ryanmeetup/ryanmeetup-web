import { describe, expect, it } from "vitest";
import {
  RYD_FORM_URL,
  rydBuyerEmail,
  rydFulfillmentEmail,
  rydMailtoHref,
  rydUnmatchedEmail,
} from "@/lib/ryd/emails";

describe("RY-D email drafts", () => {
  it("greets a bulk reminder generically and links the form", () => {
    const draft = rydBuyerEmail({ hasSubmission: false });

    expect(draft.subject).toBe("One quick step before we make your RY-D");
    expect(draft.body.startsWith("Hi there,")).toBe(true);
    expect(draft.body).toContain(RYD_FORM_URL);
  });

  it("asks an unmatched submitter which order is theirs", () => {
    const draft = rydUnmatchedEmail();

    expect(draft.body.startsWith("Hi there,")).toBe(true);
    expect(draft.body).toContain("email or order number");
  });

  it("lists the ready orders for fulfillment", () => {
    const draft = rydFulfillmentEmail(
      [{ orderId: "1001", firstName: "Ryan", lastName: "Fox" }],
      3,
    );

    expect(draft.subject).toBe("RY-D orders cleared to start: 1");
    expect(draft.body).toContain("1 of 3 RY-D orders is verified");
    expect(draft.body).toContain(
      "Ready to start:\n1001 · Order placed by Ryan Fox",
    );
  });
  it("describes a ready-only file and asks fulfillment to confirm production", () => {
    const draft = rydFulfillmentEmail(
      [{ orderId: "1001", firstName: "Ryan", lastName: "Fox" }],
      1,
    );
    expect(draft.body).toContain("contains only these orders");
    expect(draft.body).toContain("confirm when production has started");
    expect(draft.body).not.toContain("the rest are still being checked");
  });

  it("identifies a Ryan named on behalf of the buyer", () => {
    const draft = rydFulfillmentEmail(
      [
        {
          orderId: "9421890",
          firstName: "Brooke",
          lastName: "Ericson",
          recipientNames: ["Brooke Ericson on behalf of Ryan Ericson"],
        },
      ],
      1,
    );
    expect(draft.body).toContain(
      "9421890 · Ryan Ericson (ordered by Brooke Ericson)",
    );
    expect(draft.body).not.toContain("9421890 · Brooke Ericson");
  });
  it("preserves full recipient names and removes repeated equivalent answers", () => {
    const draft = rydFulfillmentEmail(
      [
        {
          orderId: "1001",
          firstName: "Ryan",
          lastName: "Fox",
          recipientNames: ["Steven Ryan Fox", "  steven  ryan FOX  "],
        },
      ],
      1,
    );
    expect(draft.body).toContain(
      "1001 · Steven Ryan Fox (ordered by Ryan Fox)",
    );
    expect(draft.body).not.toContain("Linked form names:");
  });
  it("does not present distinct linked names as a single guessed recipient", () => {
    const draft = rydFulfillmentEmail(
      [
        {
          orderId: "1001",
          firstName: "Brooke",
          lastName: "Ericson",
          recipientNames: ["Ryan Ericson", "Ryan Example"],
        },
      ],
      1,
    );
    expect(draft.body).toContain(
      "Linked form names: Ryan Ericson; Ryan Example (ordered by Brooke Ericson)",
    );
  });
  it("preserves distinct names containing non-Latin characters", () => {
    const draft = rydFulfillmentEmail(
      [
        {
          orderId: "1001",
          firstName: "Brooke",
          lastName: "Example",
          recipientNames: ["Ryan 李", "Ryan 王"],
        },
      ],
      1,
    );
    expect(draft.body).toContain("Linked form names: Ryan 李; Ryan 王");
  });
  it("does not repeat a buyer who is also the linked recipient", () => {
    const draft = rydFulfillmentEmail(
      [
        {
          orderId: "1001",
          firstName: "Ryan",
          lastName: "Fox",
          recipientNames: ["Ryan Fox"],
        },
      ],
      1,
    );
    expect(draft.body).toContain("1001 · Ryan Fox");
    expect(draft.body).not.toContain("ordered by");
  });

  it("puts bulk recipients in bcc and encodes the draft", () => {
    const href = rydMailtoHref({
      bcc: ["a@example.com", "b@example.com"],
      subject: "Hi & bye",
      body: "Line one\nLine two",
    });

    expect(href).toBe(
      "mailto:?bcc=a%40example.com%2Cb%40example.com&subject=Hi%20%26%20bye&body=Line%20one%0ALine%20two",
    );
  });

  it("deduplicates addresses and refuses injected recipients or query parameters", () => {
    const href = rydMailtoHref({
      to: ["ryan+one@example.com", "bad@example.com?bcc=other@example.com"],
      bcc: [
        " Ryan@example.com ",
        "ryan@example.com",
        "a@example.com,b@example.com",
        "",
      ],
      subject: "Hello",
      body: "Hi",
    });
    expect(href).toBe(
      "mailto:ryan%2Bone%40example.com?bcc=ryan%40example.com&subject=Hello&body=Hi",
    );
  });
});
