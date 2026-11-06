import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PollMessage } from "./PollMessage";
import type { MessagePollContent } from "../telegram/types";

describe("PollMessage (FG-015)", () => {
  const samplePoll: MessagePollContent = {
    kind: "poll",
    pollId: "poll-1",
    question: "Which feature should we build next?",
    type: "regular",
    isAnonymous: true,
    allowsMultipleAnswers: false,
    allowsRevoting: true,
    isClosed: false,
    canSeeResults: true,
    totalVoterCount: 15,
    options: [
      { id: "0", text: "Advanced Polls", voterCount: 10, votePercentage: 67, chosen: true, beingChosen: false, correct: false, position: 0 },
      { id: "1", text: "Search Tabs", voterCount: 5, votePercentage: 33, chosen: false, beingChosen: false, correct: false, position: 1 },
    ],
  };

  it("renders poll question, options, voter count, and retract vote button", () => {
    const handleAnswer = vi.fn().mockResolvedValue(true);

    const html = renderToStaticMarkup(
      <PollMessage
        poll={samplePoll}
        messageId="msg-1"
        chatId="chat-1"
        onAnswer={handleAnswer}
      />
    );

    expect(html).toContain("Which feature should we build next?");
    expect(html).toContain("Anonymous Poll");
    expect(html).toContain("Advanced Polls");
    expect(html).toContain("Search Tabs");
    expect(html).toContain("67%");
    expect(html).toContain("33%");
    expect(html).toContain("15 votes");
    expect(html).toContain("Retract Vote");
  });

  it("renders quiz feedback and explanation when provided", () => {
    const quizPoll: MessagePollContent = {
      kind: "poll",
      pollId: "quiz-1",
      question: "What does TDLib stand for?",
      type: "quiz",
      isAnonymous: false,
      allowsMultipleAnswers: false,
      allowsRevoting: false,
      isClosed: false,
      canSeeResults: true,
      totalVoterCount: 1,
      explanation: "Telegram Database Library is TDLib.",
      options: [
        { id: "0", text: "Telegram Database Library", voterCount: 1, votePercentage: 100, chosen: true, beingChosen: false, correct: true, position: 0 },
        { id: "1", text: "Terminal Data Link", voterCount: 0, votePercentage: 0, chosen: false, beingChosen: false, correct: false, position: 1 },
      ],
    };

    const html = renderToStaticMarkup(
      <PollMessage
        poll={quizPoll}
        messageId="msg-2"
        chatId="chat-1"
        onAnswer={vi.fn()}
      />
    );

    expect(html).toContain("Quiz");
    expect(html).toContain("What does TDLib stand for?");
    expect(html).toContain("Telegram Database Library is TDLib.");
    expect(html).toContain("1 vote");
    expect(html).toContain("is-correct");
  });

  it("renders Close Poll button for author when poll is open", () => {
    const html = renderToStaticMarkup(
      <PollMessage
        poll={samplePoll}
        messageId="msg-1"
        chatId="chat-1"
        isOutgoing={true}
        onAnswer={vi.fn()}
      />
    );

    expect(html).toContain("Close Poll");
  });

  it("renders Final Results indicator when poll is closed", () => {
    const closedPoll: MessagePollContent = {
      ...samplePoll,
      isClosed: true,
    };

    const html = renderToStaticMarkup(
      <PollMessage
        poll={closedPoll}
        messageId="msg-1"
        chatId="chat-1"
        isOutgoing={true}
        onAnswer={vi.fn()}
      />
    );

    expect(html).toContain("Final Results");
    // Close Poll button should NOT be rendered when already closed
    expect(html).not.toContain("Close Poll");
  });
});

