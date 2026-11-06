import { useState, useRef, useEffect, type FormEvent } from "react";
import { BarChart2, Check, HelpCircle, Plus, Trash2, X } from "lucide-react";
import type { SendPollInput } from "../telegram/types";

export interface CreatePollDialogProps {
  isOpen: boolean;
  chatId: string;
  replyToMessageId?: string;
  onSend: (input: SendPollInput) => Promise<boolean>;
  onClose: () => void;
}

const MAX_QUESTION_LENGTH = 255;
const MAX_OPTION_LENGTH = 100;
const MAX_EXPLANATION_LENGTH = 200;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export function CreatePollDialog({
  isOpen,
  chatId,
  replyToMessageId,
  onSend,
  onClose,
}: CreatePollDialogProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [allowsMultipleAnswers, setAllowsMultipleAnswers] = useState(false);
  const [isQuiz, setIsQuiz] = useState(false);
  const [correctOptionId, setCorrectOptionId] = useState<number | null>(null);
  const [explanation, setExplanation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuestion("");
      setOptions(["", ""]);
      setIsAnonymous(true);
      setAllowsMultipleAnswers(false);
      setIsQuiz(false);
      setCorrectOptionId(null);
      setExplanation("");
      setError(null);
      setTimeout(() => questionInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > MIN_OPTIONS) {
      const next = options.filter((_, i) => i !== index);
      setOptions(next);
      if (correctOptionId === index) {
        setCorrectOptionId(null);
      } else if (correctOptionId !== null && correctOptionId > index) {
        setCorrectOptionId(correctOptionId - 1);
      }
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const filledOptions = options.map((opt) => opt.trim()).filter(Boolean);
  const isValid =
    question.trim().length > 0 &&
    filledOptions.length >= MIN_OPTIONS &&
    (!isQuiz || (correctOptionId !== null && correctOptionId < options.length && options[correctOptionId].trim().length > 0));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      // Map valid options and identify new correctOptionId after removing empty options
      const sanitizedOptions: string[] = [];
      let finalCorrectId = 0;

      options.forEach((opt, idx) => {
        const trimmed = opt.trim();
        if (trimmed) {
          if (isQuiz && correctOptionId === idx) {
            finalCorrectId = sanitizedOptions.length;
          }
          sanitizedOptions.push(trimmed);
        }
      });

      const input: SendPollInput = {
        chatId,
        question: question.trim(),
        options: sanitizedOptions,
        isAnonymous,
        type: isQuiz ? "quiz" : "regular",
        allowsMultipleAnswers: isQuiz ? false : allowsMultipleAnswers,
        correctOptionId: isQuiz ? finalCorrectId : undefined,
        explanation: isQuiz && explanation.trim() ? explanation.trim() : undefined,
        replyToMessageId,
      };

      const success = await onSend(input);
      if (success) {
        onClose();
      } else {
        setError("Unable to create poll. Please check your network and chat permissions.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create poll");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="create-poll-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="create-poll-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={isQuiz ? "Create new quiz" : "Create new poll"}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !submitting) {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="create-poll-header">
          <div className="create-poll-title">
            <BarChart2 size={18} className="text-sky-400" />
            <span>{isQuiz ? "New Quiz" : "New Poll"}</span>
          </div>
          <button
            type="button"
            className="create-poll-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="create-poll-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="create-poll-form">
          <div className="create-poll-section">
            <div className="create-poll-field-header">
              <label htmlFor="poll-question-input">Question</label>
              <span className="create-poll-counter">
                {question.length} / {MAX_QUESTION_LENGTH}
              </span>
            </div>
            <input
              ref={questionInputRef}
              id="poll-question-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
              placeholder="Ask a question..."
              required
              className="create-poll-input"
              disabled={submitting}
            />
          </div>

          <div className="create-poll-section">
            <div className="create-poll-field-header">
              <label>Poll Options</label>
              <span className="create-poll-counter">
                {options.length} / {MAX_OPTIONS} options
              </span>
            </div>

            <div className="create-poll-options-list">
              {options.map((option, index) => {
                const isCorrect = correctOptionId === index;
                return (
                  <div key={index} className="create-poll-option-row">
                    {isQuiz && (
                      <button
                        type="button"
                        className={`create-poll-quiz-select ${isCorrect ? "is-selected" : ""}`}
                        onClick={() => setCorrectOptionId(index)}
                        title={isCorrect ? "Correct answer" : "Mark as correct answer"}
                        aria-label={`Mark option ${index + 1} as correct`}
                        disabled={submitting}
                      >
                        {isCorrect && <Check size={12} strokeWidth={3} />}
                      </button>
                    )}

                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value.slice(0, MAX_OPTION_LENGTH))}
                      placeholder={`Option ${index + 1}`}
                      className="create-poll-input create-poll-option-input"
                      disabled={submitting}
                    />

                    {options.length > MIN_OPTIONS && (
                      <button
                        type="button"
                        className="create-poll-option-remove"
                        onClick={() => handleRemoveOption(index)}
                        title="Remove option"
                        aria-label={`Remove option ${index + 1}`}
                        disabled={submitting}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                className="create-poll-add-option-btn"
                onClick={handleAddOption}
                disabled={submitting}
              >
                <Plus size={15} />
                <span>Add an option</span>
              </button>
            )}
          </div>

          <div className="create-poll-section create-poll-settings">
            <label className="create-poll-toggle-row">
              <div className="create-poll-toggle-info">
                <span className="create-poll-toggle-label">Anonymous Voting</span>
                <span className="create-poll-toggle-desc">Voters' identities remain concealed</span>
              </div>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                disabled={submitting}
                className="create-poll-checkbox"
              />
            </label>

            <label className="create-poll-toggle-row">
              <div className="create-poll-toggle-info">
                <span className="create-poll-toggle-label">Multiple Answers</span>
                <span className="create-poll-toggle-desc">Allow voters to select more than one option</span>
              </div>
              <input
                type="checkbox"
                checked={allowsMultipleAnswers && !isQuiz}
                disabled={isQuiz || submitting}
                onChange={(e) => setAllowsMultipleAnswers(e.target.checked)}
                className="create-poll-checkbox"
              />
            </label>

            <label className="create-poll-toggle-row">
              <div className="create-poll-toggle-info">
                <span className="create-poll-toggle-label">Quiz Mode</span>
                <span className="create-poll-toggle-desc">Poll has one correct answer and provides instant feedback</span>
              </div>
              <input
                type="checkbox"
                checked={isQuiz}
                onChange={(e) => {
                  const active = e.target.checked;
                  setIsQuiz(active);
                  if (active) {
                    setAllowsMultipleAnswers(false);
                    if (correctOptionId === null) setCorrectOptionId(0);
                  }
                }}
                disabled={submitting}
                className="create-poll-checkbox"
              />
            </label>
          </div>

          {isQuiz && (
            <div className="create-poll-section create-poll-explanation-section">
              <div className="create-poll-field-header">
                <label htmlFor="poll-explanation-input">Explanation (Optional)</label>
                <span className="create-poll-counter">
                  {explanation.length} / {MAX_EXPLANATION_LENGTH}
                </span>
              </div>
              <input
                id="poll-explanation-input"
                type="text"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value.slice(0, MAX_EXPLANATION_LENGTH))}
                placeholder="Users see this explanation after answering..."
                className="create-poll-input"
                disabled={submitting}
              />
              <span className="create-poll-field-hint">
                <HelpCircle size={12} />
                <span>Explain why the selected answer is correct.</span>
              </span>
            </div>
          )}

          <div className="create-poll-actions">
            <button
              type="button"
              className="create-poll-btn create-poll-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="create-poll-btn create-poll-btn-submit"
              disabled={!isValid || submitting}
            >
              {submitting ? "Sending..." : "Create Poll"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

