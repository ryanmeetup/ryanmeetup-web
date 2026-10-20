import { describe, expect, it } from "vitest";
import {
  RYD_FORM_URL,
  rydBuyerEmail,
  rydFulfillmentEmail,
  rydMailtoHref,
} from "@/lib/ryd/emails";

describe("RY-D email drafts", () => {
  it("greets a bulk reminder generically and links the form", () => {
    const draft = rydBuyerEmail({ hasSubmission: false });

    expect(draft.subject).toBe("One quick step before we make your RY-D");
    expect(draft.body.startsWith("Hi there,")).toBe(true);
    expect(draft.body).toContain(RYD_FORM_URL);
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
});
