import { translate } from "../i18n";
import { Code2, LoaderCircle, Network, Save, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useTelegramStore } from "../store/telegramStore";
import type { ProxySettings } from "../telegram/types";
import { ProxySettingsEditor } from "./ProxySettingsEditor";
import { ApiCredentialsSettings } from "./ApiCredentialsSettings";
import { mergeProxySettingsDraft } from "../telegram/proxySettings";

const defaultProxySettings: ProxySettings = {
  mode: "system",
  profiles: [{
    id: "proxy-1",
    get name() { return translate("代理 1"); },
    endpoint: {
      type: "http",
      server: "127.0.0.1",
      port: 7890,
      username: "",
      password: "",
      secret: "",
      httpOnly: false,
    },
  }],
  activeProfileId: "proxy-1",
  autoSwitch: false,
};

interface UnauthenticatedSettingsDialogProps {
  onClose: () => void;
}

export function UnauthenticatedSettingsDialog({ onClose }: UnauthenticatedSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<"proxy" | "api">("proxy");
  const settings = useTelegramStore((state) => state.proxySettings);
  const pending = useTelegramStore((state) => state.proxyPending);
  const error = useTelegramStore((state) => state.proxyError);
  const latency = useTelegramStore((state) => state.proxyLatencyMs);
  const load = useTelegramStore((state) => state.loadProxySettings);
  const save = useTelegramStore((state) => state.saveProxySettings);
  const test = useTelegramStore((state) => state.testProxy);
  const [draft, setDraft] = useState<ProxySettings>(defaultProxySettings);
  const loadedProxySettings = useRef<ProxySettings | undefined>(undefined);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useModalFocus<HTMLFormElement>(onClose, pending, titleRef);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!settings) return;
    const previous = loadedProxySettings.current;
    loadedProxySettings.current = settings;
    setDraft((draft) => mergeProxySettingsDraft(draft, previous, settings));
  }, [settings]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (activeTab === "proxy") {
      if (await save(draft)) onClose();
    }
  };

  const testDraft = () => {
    void test(draft);
  };

  return (
    <div
      className="dialog-backdrop auth-settings-backdrop"
      role="presentation"
      onWheel={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <form
        ref={dialogRef}
        className="login-settings-dialog"
        style={activeTab === "api" ? { maxWidth: "780px", width: "92vw" } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-settings-title"
        tabIndex={-1}
        onSubmit={submit}
      >
        <header className="login-settings-header">
          <div>
            {activeTab === "proxy" ? <Network size={20} /> : <Code2 size={20} />}
            <h2 ref={titleRef} id="login-settings-title" tabIndex={-1}>
              {activeTab === "proxy" ? "Connection & Proxy Settings" : "Telegram API Credentials"}
            </h2>
          </div>
          <button className="icon-button" type="button" aria-label={translate("关闭")} title={translate("关闭")} disabled={pending} onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        <div style={{ display: "flex", gap: "8px", padding: "10px 18px", borderBottom: "1px solid var(--line)", background: "color-mix(in srgb, var(--color-bg-surface-secondary, var(--line)) 25%, transparent)" }}>
          <button
            type="button"
            className="dialog-secondary"
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              borderRadius: "6px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: activeTab === "proxy" ? "var(--color-accent, #3b82f6)" : "var(--color-bg-surface)",
              color: activeTab === "proxy" ? "#ffffff" : "var(--ink)",
              borderColor: activeTab === "proxy" ? "var(--color-accent, #3b82f6)" : "var(--line)",
            }}
            onClick={() => setActiveTab("proxy")}
          >
            <Network size={14} /> Proxy Connection
          </button>
          <button
            type="button"
            className="dialog-secondary"
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              borderRadius: "6px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: activeTab === "api" ? "var(--color-accent, #3b82f6)" : "var(--color-bg-surface)",
              color: activeTab === "api" ? "#ffffff" : "var(--ink)",
              borderColor: activeTab === "api" ? "var(--color-accent, #3b82f6)" : "var(--line)",
            }}
            onClick={() => setActiveTab("api")}
          >
            <Code2 size={14} /> API Credentials (api_id / api_hash)
          </button>
        </div>

        {activeTab === "proxy" ? (
          <>
            <div className="login-settings-body">
              <div className="login-settings-intro">
                <strong>{translate("代理连接")}</strong>
                <span>{translate("登录前仅可调整 Telegram 网络连接")}</span>
              </div>
              <ProxySettingsEditor
                settings={draft}
                busy={pending}
                pending={pending}
                latency={latency}
                onChange={setDraft}
                onTest={testDraft}
              />
              {error && <div className="auth-error" role="alert">{error}</div>}
            </div>

            <footer className="login-settings-actions">
              <button className="dialog-secondary" type="button" disabled={pending} onClick={onClose}>{translate("取消")}</button>
              <button className="dialog-save" type="submit" disabled={pending}>
                {pending ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
                <span>{translate("保存代理")}</span>
              </button>
            </footer>
          </>
        ) : (
          <div style={{ maxHeight: "72vh", overflowY: "auto" }}>
            <ApiCredentialsSettings />
          </div>
        )}
      </form>
    </div>
  );
}

