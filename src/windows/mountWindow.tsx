import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { installPerformanceMonitoring } from "../utils/performanceMonitor";
import { installWebviewGuards } from "../utils/webviewGuards";
import emojiFontLicense from "../assets/fonts/noto-color-emoji/OFL.txt?url&no-inline";
import "../styles/themes.css";
import "../styles/global.css";

installWebviewGuards();
installPerformanceMonitoring();

const fontLicense = document.createElement("link");
fontLicense.rel = "license";
fontLicense.href = emojiFontLicense;
fontLicense.title = "Noto Color Emoji — SIL Open Font License 1.1";
document.head.append(fontLicense);

if (isTauri()) {
  void listen("fardgram://reload-application", () => globalThis.location.reload());
}

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: unknown) {
    console.error("Root crash caught by ErrorBoundary:", error, info);
  }
  override render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "100vh", color: "#f87171", background: "#0f172a", fontFamily: "system-ui, sans-serif",
          padding: 24, textAlign: "center", gap: 16
        }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Application Render Error</h2>
          <pre style={{ maxWidth: "80vw", overflow: "auto", background: "rgba(0,0,0,0.5)", padding: 12, borderRadius: 8, fontSize: 12 }}>
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px", borderRadius: 6, border: "none", background: "#3b82f6",
              color: "#fff", cursor: "pointer", fontWeight: 600
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LocalizedWindow({ render }: { render: () => ReactNode }) {
  useTranslation();
  return render();
}

export const mountWindow = (render: () => ReactNode) => {
  const root = document.getElementById("root");
  if (!root) throw new Error("window root element not found");
  // Measure message geometry only after the bundled emoji font is available.
  void document.fonts.load('14px "Noto Color Emoji"', "😀").catch(() => undefined).then(() => {
    createRoot(root).render(
      <StrictMode>
        <RootErrorBoundary>
          <LocalizedWindow render={render} />
        </RootErrorBoundary>
      </StrictMode>
    );
  });
};
