import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";

describe("ScheduleMessageDialog (FG-005)", () => {
  it("renders scheduled message presets and date picker controls", () => {
    const html = renderToStaticMarkup(
      <ScheduleMessageDialog
        onClose={vi.fn()}
        onSchedule={vi.fn()}
        allowSendWhenOnline={true}
      />,
    );

    expect(html).toContain("Schedule Message");
    expect(html).toContain("In 2 hours");
    expect(html).toContain("Tomorrow 09:00");
    expect(html).toContain("Tomorrow 18:00");
    expect(html).toContain("Send When Online");
    expect(html).toContain("Schedule");
  });

  it("omits Send When Online toggle when allowSendWhenOnline is false (e.g. bots/channels)", () => {
    const html = renderToStaticMarkup(
      <ScheduleMessageDialog
        onClose={vi.fn()}
        onSchedule={vi.fn()}
        allowSendWhenOnline={false}
      />,
    );

    expect(html).toContain("Schedule Message");
    expect(html).not.toContain("Send When Online");
  });
});
