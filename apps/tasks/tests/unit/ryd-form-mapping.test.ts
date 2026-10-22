import { describe, expect, it } from "vitest";
import {
  inspectRydForm,
  parseRydFormResponses,
  type GoogleForm,
  type GoogleFormItem,
} from "@/lib/ryd/form-responses";

const question = (id: string, title: string): GoogleFormItem => ({
  title,
  questionItem: { question: { questionId: id, textQuestion: {} } },
});
const form = (...items: GoogleFormItem[]): GoogleForm => ({ items });
const answer = (value: string) => ({ textAnswers: { answers: [{ value }] } });
const response = {
  responseId: "synthetic-response",
  respondentEmail: "signed-in@example.test",
  answers: {
    name: answer("Ryan Example"),
    email: answer("Order.Address@example.test"),
    second: answer("Ryan Different"),
  },
};

describe("RY-D identity question mapping", () => {
  it.each([false, true])("refuses duplicate names in either order (%s)", (reverse) => {
    const items = [question("name", "Legal name"), question("second", "Full name")];
    if (reverse) items.reverse();
    const source = form(...items, question("email", "Your email"));
    const mapping = inspectRydForm(source);
    expect(mapping.warnings.join(" ")).toContain("2 possible legal-name questions");
    const [parsed] = parseRydFormResponses(source, [response]);
    expect(parsed.legalName).toBe("");
    expect(parsed.otherAnswers.map((entry) => entry.answer)).toEqual(
      expect.arrayContaining(["Ryan Example", "Ryan Different"]),
    );
  });

  it("does not replace ambiguous order emails with the sign-in email", () => {
    const source = form(question("name", "Legal name"),
      question("email", "Your email"), question("second", "Another email address"));
    expect(inspectRydForm(source).warnings.join(" ")).toContain("2 possible email questions");
    const [parsed] = parseRydFormResponses(source, [response]);
    expect(parsed.email).toBe("");
    expect(parsed.otherAnswers.map((entry) => entry.answer)).toContain("Order.Address@example.test");
  });

  it.each(["Company full name", "Buyer full name", "Your preferred name", "Your name on Instagram"])(
    "does not let %s claim the legal name", (title) => {
      const source = form(question("second", title), question("name", "Legal name"),
        question("email", "Your email"));
      expect(parseRydFormResponses(source, [response])[0].legalName).toBe("Ryan Example");
    },
  );

  it.each(["Name", "Your name", "What is your name?", "What's your name?", "Your full legal name"])(
    "recognizes an unambiguous personal title: %s", (title) => {
      const source = form(question("name", title), question("email", "E-mail address"));
      expect(inspectRydForm(source).warnings).toEqual([]);
      expect(parseRydFormResponses(source, [response])[0]).toMatchObject({
        legalName: "Ryan Example", email: "order.address@example.test",
      });
    },
  );

  it("keeps choice and grid questions out of identity matching", () => {
    const source: GoogleForm = { items: [{
      title: "Legal name",
      questionItem: { question: { questionId: "name", choiceQuestion: {} } },
    }, {
      title: "Your email",
      questionGroupItem: { questions: [{ questionId: "email" }] },
    }] };
    const [parsed] = parseRydFormResponses(source, [response]);
    expect(parsed.legalName).toBe("");
    expect(parsed.otherAnswers).toHaveLength(2);
    expect(inspectRydForm(source).warnings.join(" ")).toContain("no clear legal-name question");
  });

  it("uses a collected address only when no explicit email question exists", () => {
    const [parsed] = parseRydFormResponses(form(question("name", "Legal name")), [response]);
    expect(parsed.email).toBe("signed-in@example.test");
  });

  it.each(["", "not an address", "a@example.test, b@example.test"])(
    "does not replace a blank or invalid explicit email (%s)", (value) => {
      const [parsed] = parseRydFormResponses(
        form(question("name", "Legal name"), question("email", "Your email")),
        [{ ...response, answers: { ...response.answers, email: answer(value) } }],
      );
      expect(parsed.email).toBe("");
      if (value) expect(parsed.otherAnswers).toContainEqual({ question: "Your email", answer: value });
    },
  );

  it("retains uploads while identity mapping is ambiguous", () => {
    const source = form(question("name", "Legal name"), question("second", "Full name"), {
      title: "Upload your email evidence",
      questionItem: { question: { questionId: "files", fileUploadQuestion: {} } },
    });
    const [parsed] = parseRydFormResponses(source, [{ ...response, answers: {
      ...response.answers,
      files: { fileUploadAnswers: { answers: [{ fileId: "synthetic-upload" }] } },
    } }]);
    expect(parsed.fileIds).toEqual(["synthetic-upload"]);
  });
});
