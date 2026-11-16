import { Editor, Extension, Mark, Node as EditorNode } from "@tiptap/core";
import { history, redo, undo } from "@tiptap/pm/history";
import { keymap } from "@tiptap/pm/keymap";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import type { MessageTextEntity } from "../telegram/types";
import type { ComposerFocus } from "../hooks/useComposerFocus";
import { translate } from "../i18n";
import { composerDocument, composerEntityKinds, composerFormattedText, composerFormatShortcut, isPastingIntoComposerLink, type ComposerFormat } from "../utils/composerFormatting";
import { ComposerContextMenu, type ComposerMenuAction } from "./ComposerContextMenu";
import type { ContextMenuPoint } from "./ContextMenuSurface";
import { ComposerFormattingBar } from "./ComposerFormattingBar";
import { ComposerLinkDialog } from "./ComposerLinkDialog";

export interface ComposerInputElement extends HTMLDivElement {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  setSelectionRange: (start: number, end: number) => void;
  focusEditor: () => void;
}

const tags: Record<string, string> = { bold: "strong", italic: "em", underline: "u", strikethrough: "s", code: "code", pre: "code" };
const extensions = [
  EditorNode.create({ name: "doc", topNode: true, content: "paragraph" }),
  EditorNode.create({
    name: "paragraph", content: "inline*", group: "block", whitespace: "pre",
    parseHTML: () => [{ tag: "p" }], renderHTML: () => ["p", 0]
  }),
  EditorNode.create({ name: "text", group: "inline" }),
  EditorNode.create({
    name: "hardBreak", inline: true, group: "inline", selectable: false,
    parseHTML: () => [{ tag: "br" }], renderHTML: () => ["br"]
  }),
  ...composerEntityKinds.map(kind => Mark.create({
    name: kind, inclusive: false,
    addAttributes: () => ({ entity: { default: {}, rendered: false } }),
    parseHTML: () => [{ tag: `[data-composer-entity="${kind}"]` }],
    renderHTML: () => [tags[kind] ?? "span", { "data-composer-entity": kind }, 0],
  })),
  Extension.create({
    name: "composerMentionPresentation", addProseMirrorPlugins: () => [
      new Plugin({
        props: {
          decorations: state => {
            const doc = state.doc;
            const fastText = doc.childCount === 1 && doc.firstChild?.isTextblock && doc.firstChild.childCount === 1 && doc.firstChild.firstChild?.isText
              ? doc.firstChild.firstChild.text
              : undefined;
            if (fastText ? !fastText.includes("@") : !doc.textContent.includes("@")) return DecorationSet.empty;
            const { text, entities } = composerFormattedText(state.doc.toJSON());
            // Hide only the presentation prefix; keep Telegram and editor offsets intact.
            return DecorationSet.create(state.doc, entities
              .filter(entity => (entity.kind === "mention" || entity.kind === "mentionName") &&
                entity.length > 1 && text[entity.offset] === "@")
              .map(entity => Decoration.inline(entity.offset + 1, entity.offset + 2, { class: "composer-mention-prefix" })));
          },
        }
      }),
    ]
  }),
  Extension.create({
    name: "composerHistory", addProseMirrorPlugins: () => [
      history(), keymap({ "Mod-z": undo, "Mod-y": redo, "Mod-Shift-z": redo }),
    ]
  }),
];

const EMPTY_ENTITIES: MessageTextEntity[] = [];
const editorText = (editor: Editor) => editor.state.doc.textBetween(0, editor.state.doc.content.size, "", "\n");

interface Props {
  inputRef: RefObject<ComposerInputElement | null>;
  value: string;
  entities: readonly MessageTextEntity[];
  placeholder: string;
  busy: boolean;
  colorTheme: "light" | "dark";
  focus: ComposerFocus;
  onChange: (text: string, entities: MessageTextEntity[]) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPasteFiles: (files: File[]) => boolean;
  onCompositionStart: () => void;
  onCompositionEnd: (text: string) => void;
  onFocus: () => void;
  onBlur: (text: string) => void;
}

export function ComposerInput(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [menu, setMenu] = useState<{ point: ContextMenuPoint; from: number; to: number }>();
  const [hasSelection, setHasSelection] = useState(false);
  const [clipboardError, setClipboardError] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkInitialText, setLinkInitialText] = useState("");
  const [linkSelectionRange, setLinkSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(undefined), []);

  const applyFormat = useCallback((format: ComposerFormat) => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed || editor.state.selection.empty || editor.view.composing) return;
    const from = Math.max(1, editor.state.selection.from);
    const to = Math.min(editor.state.doc.content.size - 1, editor.state.selection.to);
    if (format === "link") {
      const selected = editor.state.doc.textBetween(from, to, "", "\n");
      setLinkInitialText(selected);
      setLinkSelectionRange({ from, to });
      setLinkDialogOpen(true);
    } else {
      editor.commands.toggleMark(format);
    }
  }, []);

  const handleApplyLink = useCallback((displayText: string, url: string) => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const range = linkSelectionRange ?? {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    const textNode = editor.schema.text(displayText, [
      editor.schema.marks.textUrl.create({ entity: { href: url } }),
    ]);
    editor.view.dispatch(editor.state.tr.replaceWith(range.from, range.to, textNode));
    editor.commands.setTextSelection(range.from + displayText.length);
    setLinkDialogOpen(false);
    setLinkSelectionRange(null);
  }, [linkSelectionRange]);

  const pasteText = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const { from, to } = editor.state.selection;
    const completeLink = isPastingIntoComposerLink(editorText(editor), from - 1, to - 1);
    const marks = editor.state.storedMarks ?? editor.state.selection.$from.marks();
    const content = composerDocument(text.replace(/\r\n?/g, "\n"), []).content?.[0].content ?? [];
    editor.commands.insertContentAt({ from, to }, content.map(node => ({ ...node, marks: marks.map(mark => mark.toJSON()) })), { parseOptions: { preserveWhitespace: "full" } });
    if (completeLink) editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  }, []);

  useLayoutEffect(() => {
    const current = propsRef.current;
    const editor = new Editor({
      element: containerRef.current!, extensions, injectCSS: false,
      content: composerDocument(current.value, current.entities),
      editorProps: {
        attributes: { class: "composer-input", role: "textbox", "aria-multiline": "true", spellcheck: "true" },
        handleDOMEvents: {
          keydown: (view, event) => {
            // Let the IME and editor see the key without triggering app shortcuts.
            if (view.composing || event.isComposing || event.keyCode === 229) event.stopPropagation();
            return false;
          },
          beforeinput: (_view, event) => {
            const input = event as InputEvent;
            if (input.isComposing || input.inputType !== "insertText" || !input.data?.includes("\n")) return false;
            event.preventDefault(); pasteText(input.data); return true;
          },
        },
        handlePaste: (_view, event) => {
          const files = Array.from(event.clipboardData?.files ?? []);
          if (files.length && propsRef.current.onPasteFiles(files)) return true;
          pasteText(event.clipboardData?.getData("text/plain") ?? "");
          return true;
        },
        handleKeyDown: (view, event) => {
          if (event.isComposing || view.composing) return false;
          const format = composerFormatShortcut(event);
          if (format) {
            // selectionchange can still be queued, including after IME commit.
            // Read the visible selection through ProseMirror's public DOM mapping.
            const selection = view.dom.ownerDocument.getSelection();
            if (selection?.anchorNode && selection.focusNode &&
              view.dom.contains(selection.anchorNode) && view.dom.contains(selection.focusNode)) {
              const limit = view.state.doc.content.size - 1;
              const anchor = Math.max(1, Math.min(view.posAtDOM(selection.anchorNode, selection.anchorOffset), limit));
              const head = Math.max(1, Math.min(view.posAtDOM(selection.focusNode, selection.focusOffset), limit));
              const range = TextSelection.create(view.state.doc, anchor, head);
              if (!range.eq(view.state.selection)) view.dispatch(view.state.tr.setSelection(range));
              applyFormat(format);
            }
            event.stopPropagation();
            return true;
          }
          if (event.key !== "Enter" || event.keyCode === 229) return false;
          view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.hardBreak.create(), true));
          return true;
        },
      },
      onUpdate: ({ editor: updated }) => {
        let hasMarks = false;
        let plainText: string | undefined;
        const doc = updated.state.doc;
        if (doc.childCount === 1 && doc.firstChild?.isTextblock) {
          const block = doc.firstChild;
          if (block.childCount === 1 && block.firstChild?.isText && block.firstChild.marks.length === 0) {
            hasMarks = false;
            plainText = block.firstChild.text ?? "";
          }
        }
        if (plainText === undefined) {
          doc.descendants((node) => {
            if (node.marks.length > 0) {
              hasMarks = true;
              return false;
            }
            return true;
          });
        }
        const formatted = hasMarks
          ? composerFormattedText(updated.getJSON())
          : { text: plainText ?? editorText(updated), entities: EMPTY_ENTITIES };
        const emptyStr = String(!formatted.text);
        if (updated.view.dom.dataset.empty !== emptyStr) {
          updated.view.dom.dataset.empty = emptyStr;
        }
        propsRef.current.onChange(formatted.text, formatted.entities);
      },
      onSelectionUpdate: ({ editor: updated }) => {
        const empty = updated.state.selection.empty;
        setHasSelection((prev) => (prev === !empty ? prev : !empty));
      },
    });
    editorRef.current = editor;
    const input = editor.view.dom as ComposerInputElement;
    Object.defineProperties(input, {
      value: { get: () => editorText(editor) },
      // Ctrl+A may select the document node; the adapter still exposes text offsets.
      selectionStart: { get: () => Math.max(0, editor.state.selection.from - 1) },
      selectionEnd: { get: () => Math.min(editor.state.doc.content.size - 2, editor.state.selection.to - 1) },
    });
    input.setSelectionRange = (start, end) => {
      const limit = editor.state.doc.content.size - 1;
      editor.commands.setTextSelection({ from: Math.max(1, Math.min(start + 1, limit)), to: Math.max(1, Math.min(end + 1, limit)) });
    };
    input.focusEditor = () => editor.view.focus();
    props.inputRef.current = input;
    input.setSelectionRange(current.value.length, current.value.length);
    return () => {
      if (props.inputRef.current === input) props.inputRef.current = null;
      editorRef.current = null;
      editor.destroy();
    };
  }, [applyFormat, pasteText, props.inputRef]);

  const previousAttributesRef = useRef<{ busy?: boolean; placeholder?: string; empty?: boolean; labelSet?: boolean }>({});
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const input = editor.view.dom;
    const prev = previousAttributesRef.current;
    if (!prev.labelSet) {
      input.setAttribute("aria-label", translate("消息内容"));
      input.setAttribute("dir", "auto");
      prev.labelSet = true;
    }
    if (prev.busy !== props.busy) {
      input.setAttribute("aria-busy", String(props.busy));
      prev.busy = props.busy;
    }
    if (prev.placeholder !== props.placeholder) {
      input.setAttribute("data-placeholder", props.placeholder);
      prev.placeholder = props.placeholder;
    }
    const currentText = editorText(editor);
    const isEmpty = !currentText;
    if (prev.empty !== isEmpty) {
      input.dataset.empty = String(isEmpty);
      prev.empty = isEmpty;
    }
    const isFocused = editor.view.hasFocus();
    const shouldSyncContent = (!isFocused || props.value === "") && !editor.view.composing && currentText !== props.value;
    if (shouldSyncContent) {
      const content = composerDocument(props.value, props.entities);
      if (!editor.schema.nodeFromJSON(content).eq(editor.state.doc)) {
        editor.commands.setContent(content, { emitUpdate: false });
        editor.commands.setTextSelection(props.value.length + 1);
      }
    }
  }, [props.busy, props.placeholder, props.value, props.entities]);

  const restoreFocus = useCallback(() => propsRef.current.focus.capture(true)(), []);
  const runMenuAction = useCallback(async (action: ComposerMenuAction) => {
    const editor = editorRef.current;
    if (!editor || !menu || editor.isDestroyed) return;
    editor.commands.setTextSelection({ from: menu.from, to: menu.to });
    const restore = propsRef.current.focus.capture(true);
    closeMenu();
    setClipboardError(false);
    if (!["cut", "copy", "paste"].includes(action)) {
      applyFormat(action as ComposerFormat); restore(); return;
    }
    // Clipboard access may outlive this conversation. Never mutate a replacement editor.
    const document = editor.state.doc;
    const selection = editor.state.selection;
    try {
      if (action === "paste") {
        const text = await navigator.clipboard.readText();
        if (!editor.isDestroyed && editorRef.current === editor && editor.state.doc === document && editor.state.selection.eq(selection)) pasteText(text);
      } else {
        await navigator.clipboard.writeText(editor.state.doc.textBetween(menu.from, menu.to, "", "\n"));
        if (action === "cut" && !editor.isDestroyed && editorRef.current === editor && editor.state.doc === document && editor.state.selection.eq(selection)) editor.commands.deleteSelection();
      }
    } catch { if (!editor.isDestroyed) setClipboardError(true); }
    restore();
  }, [applyFormat, closeMenu, menu, pasteText]);

  return <div className="composer-input-container"
    onKeyDownCapture={event => {
      const editor = editorRef.current;
      if (!editor?.view.dom.contains(event.target as globalThis.Node)) return;
      if (event.nativeEvent.isComposing || editor.view.composing || event.nativeEvent.keyCode === 229) return;
      props.onKeyDown(event);
    }}
    onCompositionStart={() => {
      // Preedit can be visible before it reaches the editor document or React state.
      if (editorRef.current) editorRef.current.view.dom.dataset.composing = "true";
      props.onCompositionStart();
    }}
    onCompositionEnd={() => {
      const editor = editorRef.current;
      if (editor) {
        editor.view.dom.dataset.composing = "false";
        editor.view.dom.dataset.empty = String(!editorText(editor));
      }
      props.onCompositionEnd(editor ? editorText(editor) : "");
    }}
    onFocus={props.onFocus}
    onBlur={() => {
      setHasSelection(false);
      props.onBlur(editorRef.current ? editorText(editorRef.current) : "");
    }}
    onContextMenu={event => {
      const editor = editorRef.current;
      if (!editor?.view.dom.contains(event.target as globalThis.Node)) return;
      event.preventDefault();
      if (!editor || editor.view.composing) return;
      const from = Math.max(1, editor.state.selection.from);
      const to = Math.min(editor.state.doc.content.size - 1, editor.state.selection.to);
      setMenu({ point: { x: event.clientX, y: event.clientY }, from, to });
    }}>
    {hasSelection && <ComposerFormattingBar onApplyFormat={applyFormat} />}
    <div ref={containerRef} />
    {clipboardError && <span className="composer-clipboard-error" role="alert">{translate("无法访问剪贴板，请使用键盘快捷键")}</span>}
    {menu && <ComposerContextMenu point={menu.point} selected={menu.from !== menu.to} colorTheme={props.colorTheme}
      onAction={action => void runMenuAction(action)} onClose={closeMenu} restoreFocus={restoreFocus} />}
    {linkDialogOpen && (
      <ComposerLinkDialog
        isOpen={linkDialogOpen}
        initialText={linkInitialText}
        onApply={handleApplyLink}
        onClose={() => {
          setLinkDialogOpen(false);
          setLinkSelectionRange(null);
          restoreFocus();
        }}
      />
    )}
  </div>;
}
