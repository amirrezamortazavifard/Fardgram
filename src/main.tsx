import { App } from "./app/App";
import { WindowChrome } from "./components/WindowChrome";
import { prepareNativeContextMenuWindow } from "./contextMenu/nativeContextMenuBridge";
import { mountWindow } from "./windows/mountWindow";

if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        e.stopPropagation();
        const current = window.localStorage.getItem("fardgram_demo_mode") === "true";
        window.localStorage.setItem("fardgram_demo_mode", current ? "false" : "true");
        window.location.reload();
      }
    },
    true,
  );
}

void prepareNativeContextMenuWindow().catch(() => undefined);

mountWindow(() => (
  <div className="main-window-frame">
    <WindowChrome />
    <div className="main-window-content"><App /></div>
  </div>
));
