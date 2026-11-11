import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Tooltip } from "../src/Tooltip";

// Flight can pass a lazy node itself, rather than an element whose type is lazy.
// Match that transport shape without coupling this test to Next's Flight decoder.
function streamedChild(element: ReactElement): ReactElement {
  return {
    $$typeof: Symbol.for("react.lazy"),
    _payload: element,
    _init: (payload: ReactElement) => payload,
  } as unknown as ReactElement;
}

describe("Tooltip", () => {
  it("preserves an existing description on a regular trigger", () => {
    const markup = renderToStaticMarkup(
      <Tooltip content="Save changes">
        <button aria-describedby="save-help">Save</button>
      </Tooltip>,
    );

    expect(markup).toContain(
      '<button aria-describedby="save-help">Save</button>',
    );
  });

  it("renders a streamed trigger and preserves its existing description", () => {
    const markup = renderToStaticMarkup(
      <Tooltip content="Save changes">
        {streamedChild(<button aria-describedby="save-help">Save</button>)}
      </Tooltip>,
    );

    expect(markup).toContain(
      '<button aria-describedby="save-help">Save</button>',
    );
  });

  it("renders a streamed trigger without an existing description", () => {
    const markup = renderToStaticMarkup(
      <Tooltip content="View details">
        {streamedChild(<a href="/details">Details</a>)}
      </Tooltip>,
    );

    expect(markup).toContain('<a href="/details">Details</a>');
    expect(markup).not.toContain("aria-describedby");
  });
});
