import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreatePollDialog } from "./CreatePollDialog";

describe("CreatePollDialog (FG-015)", () => {
  it("renders poll creation dialog when isOpen is true", () => {
    const handleSend = vi.fn().mockResolvedValue(true);
    const handleClose = vi.fn();

    const html = renderToStaticMarkup(
      <CreatePollDialog
        isOpen={true}
        chatId="chat-123"
        onSend={handleSend}
        onClose={handleClose}
      />
    );

    expect(html).toContain("create-poll-dialog");
    expect(html).toContain("New Poll");
    expect(html).toContain("Question");
    expect(html).toContain("Ask a question...");
    expect(html).toContain("Poll Options");
    expect(html).toContain("Option 1");
    expect(html).toContain("Option 2");
    expect(html).toContain("Add an option");
    expect(html).toContain("Anonymous Voting");
    expect(html).toContain("Multiple Answers");
    expect(html).toContain("Quiz Mode");
    expect(html).toContain("Create Poll");
    expect(html).toContain("Cancel");
  });

  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <CreatePollDialog
        isOpen={false}
        chatId="chat-123"
        onSend={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toBe("");
  });
});

