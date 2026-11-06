import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BusinessSettingsPanel } from "./BusinessSettingsPanel";

describe("BusinessSettingsPanel (FG-008)", () => {
  it("renders business location, opening hours, quick replies, greeting, away, chat links and start page sections", () => {
    const html = renderToStaticMarkup(<BusinessSettingsPanel />);

    expect(html).toContain("Telegram Business");
    expect(html).toContain("Business Location");
    expect(html).toContain("Opening Hours");
    expect(html).toContain("Quick Replies");
    expect(html).toContain("Greeting Message");
    expect(html).toContain("Away Message");
    expect(html).toContain("Business Chat Links");
    expect(html).toContain("Business Start Page");
    expect(html).toContain("Save Location");
    expect(html).toContain("Save Hours");
    expect(html).toContain("Add Shortcut");
    expect(html).toContain("Create Link");
  });

  it("renders days of the week in opening hours schedule", () => {
    const html = renderToStaticMarkup(<BusinessSettingsPanel />);

    expect(html).toContain("Monday");
    expect(html).toContain("Tuesday");
    expect(html).toContain("Wednesday");
    expect(html).toContain("Thursday");
    expect(html).toContain("Friday");
    expect(html).toContain("Saturday");
    expect(html).toContain("Sunday");
  });
});
