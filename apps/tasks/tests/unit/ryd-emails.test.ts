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
    expect(draft.body).toContain("Ready to start:\n1001 · Ryan Fox");
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
