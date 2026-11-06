import { translate } from "../i18n";
import { Check, LoaderCircle, Lock, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { MessagePollContent } from "../telegram/types";
import { MessageRichText } from "./MessageRichText";
import { telegramStore } from "../store/telegramStore";

export interface PollMessageProps {
  poll: MessagePollContent;
  messageId: string;
  chatId?: string;
  isOutgoing?: boolean;
  highlightQuery?: string;
  onSearchHashtag?: (hashtag: string) => void;
  onAnswer: (messageId: string, optionPositions: number[], chatId?: string) => Promise<boolean>;
  onStopPoll?: (messageId: string, chatId?: string) => Promise<boolean>;
}

const chosenPositions = (poll: MessagePollContent) => poll.options
  .filter((option) => option.chosen)
  .map((option) => option.position);

export function PollMessage({
  poll,
  messageId,
  chatId,
  isOutgoing,
  highlightQuery,
  onSearchHashtag,
  onAnswer,
  onStopPoll,
}: PollMessageProps) {
  const serverSelection = useMemo(() => chosenPositions(poll), [poll]);
  const [selection, setSelection] = useState(serverSelection);
  const [pending, setPending] = useState(false);

  useEffect(() => setSelection(serverSelection), [serverSelection]);

  const alreadyVoted = serverSelection.length > 0;
  const canVote = !poll.isClosed && !poll.restrictionReason && (!alreadyVoted || poll.allowsRevoting);
  const showResults = poll.canSeeResults || alreadyVoted || poll.isClosed;

  const submit = async (positions: number[]) => {
    if (pending || !canVote) return;
    setPending(true);
    const accepted = await onAnswer(messageId, positions, chatId);
    if (!accepted) setSelection(serverSelection);
    setPending(false);
  };

  const handleStopPoll = async () => {
    if (pending || poll.isClosed) return;
    setPending(true);
    if (onStopPoll) {
      await onStopPoll(messageId, chatId);
    } else {
      await telegramStore.getState().stopPoll(messageId, chatId ?? "");
    }
    setPending(false);
  };

  const voterCountText = useMemo(() => {
    const count = poll.totalVoterCount;
    const label = count === 1 ? translate("1 vote") : translate("{{count}} votes", { count: String(count) });
    return poll.isClosed ? `${label} · ${translate("Final Results")}` : label;
  }, [poll.totalVoterCount, poll.isClosed]);

  return (
    <section className="poll-message" aria-label={poll.type === "quiz" ? translate("Quiz") : translate("Poll")}>
      <header>
        <MessageRichText
          text={poll.question}
          entities={poll.questionEntities}
          highlightQuery={highlightQuery}
          onSearchHashtag={onSearchHashtag}
        />
        <small>
          {poll.type === "quiz"
            ? translate("Quiz")
            : poll.isAnonymous
              ? translate("Anonymous Poll")
              : translate("Public Poll")}
        </small>
      </header>
      <div className="poll-options">
        {poll.options.map((option) => {
          const selected = selection.includes(option.position);
          const optionPending = pending || option.beingChosen;
          const choose = () => {
            if (!canVote || optionPending) return;
            if (poll.allowsMultipleAnswers) {
              setSelection((current) => selected
                ? current.filter((position) => position !== option.position)
                : [...current, option.position].sort((left, right) => left - right));
              return;
            }
            void submit(selected && poll.allowsRevoting ? [] : [option.position]);
          };
          return (
            <button
              className={`poll-option ${selected ? "is-selected" : ""} ${option.correct ? "is-correct" : ""}`}
              type="button"
              key={option.id}
              aria-pressed={selected}
              aria-label={`${option.text}${showResults ? `, ${option.votePercentage}%` : ""}`}
              disabled={!canVote || optionPending}
              onClick={choose}
              style={{ "--poll-percentage": `${option.votePercentage}%` } as CSSProperties}
            >
              {showResults && <span className="poll-option-bar" aria-hidden="true" />}
              <span className="poll-option-mark" aria-hidden="true">
                {optionPending
                  ? <LoaderCircle className="spin" size={14} />
                  : poll.type === "quiz" && (selected || option.correct)
                    ? option.correct ? <Check size={14} /> : <X size={14} />
                    : selected ? <Check size={14} /> : null}
              </span>
              <MessageRichText
                text={option.text}
                entities={option.entities}
                highlightQuery={highlightQuery}
                onSearchHashtag={onSearchHashtag}
              />
              {showResults && <span className="poll-option-result">{option.votePercentage}%</span>}
            </button>
          );
        })}
      </div>
      {poll.allowsMultipleAnswers && canVote && (
        <button
          className="poll-submit"
          type="button"
          disabled={pending || selection.length === 0 || (
            alreadyVoted && selection.join(",") === serverSelection.join(",")
          )}
          onClick={() => void submit(selection)}
        >
          {pending && <LoaderCircle className="spin" size={14} />}{translate("Vote")}</button>
      )}
      {poll.explanation && (
        <div className="poll-explanation">
          <MessageRichText
            text={poll.explanation}
            entities={poll.explanationEntities}
            highlightQuery={highlightQuery}
            onSearchHashtag={onSearchHashtag}
          />
        </div>
      )}
      <footer>
        <span>{voterCountText}</span>
        {poll.restrictionReason && <span>{poll.restrictionReason}</span>}
        {alreadyVoted && poll.allowsRevoting && !poll.isClosed && (
          <button type="button" disabled={pending} onClick={() => void submit([])}>
            <RotateCcw size={13} />{translate("Retract Vote")}</button>
        )}
        {isOutgoing && !poll.isClosed && (
          <button
            type="button"
            className="poll-close-btn"
            disabled={pending}
            onClick={() => void handleStopPoll()}
            title="Close poll and stop accepting answers"
            aria-label="Close Poll"
          >
            <Lock size={12} />
            {translate("Close Poll")}
          </button>
        )}
      </footer>
    </section>
  );
}
