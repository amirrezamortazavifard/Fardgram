import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RichCodeBlock } from "./RichCodeBlock";

describe("RichCodeBlock (FG-014)", () => {
  it("renders code block with specified language and copy affordance", () => {
    const html = renderToStaticMarkup(
      <RichCodeBlock language="typescript" rawText="const x: number = 42;">
        const x: number = 42;
      </RichCodeBlock>
    );

    expect(html).toContain("rich-code-block-container");
    expect(html).toContain("TYPESCRIPT");
    expect(html).toContain("Copy");
    expect(html).toContain("const x: number = 42;");
    expect(html).toContain("rich-code-pre");
  });

  it("renders default CODE label when language is omitted", () => {
    const html = renderToStaticMarkup(
      <RichCodeBlock>
        print("Hello world")
      </RichCodeBlock>
    );

    expect(html).toContain("CODE");
    expect(html).toContain("print(&quot;Hello world&quot;)");
  });
});
