import { useEffect, useState } from "react";
import {
  Code2,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Save,
  CheckCircle2,
  XCircle,
  LoaderCircle,
  Activity,
  Terminal,
  Server,
  FileCode,
  Info,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import {
  getApiCredentials,
  saveApiCredentials,
  clearApiCredentials,
  testApiCredentials,
} from "../telegram/apiCredentials";
import type {
  TelegramApiCredentialsInfo,
  ApiCredentialsTestResult,
} from "../telegram/types";
import { useTelegramStore } from "../store/telegramStore";
import { openExternalLink } from "../utils/externalLinks";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { MotionPresence } from "./MotionPresence";

export function ApiCredentialsSettings() {
  const connectionStatus = useTelegramStore((state) => state.connectionStatus);
  const proxyLatencyMs = useTelegramStore((state) => state.proxyLatencyMs);

  const [info, setInfo] = useState<TelegramApiCredentialsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ApiCredentialsTestResult | null>(null);

  const [showHash, setShowHash] = useState(false);
  const [showDraftHash, setShowDraftHash] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [draftApiId, setDraftApiId] = useState("");
  const [draftApiHash, setDraftApiHash] = useState("");
  const [draftAppTitle, setDraftAppTitle] = useState("");
  const [draftShortName, setDraftShortName] = useState("");

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getApiCredentials();
      setInfo(data);
      if (data.apiId) {
        setDraftApiId(String(data.apiId));
      }
      if (data.apiHash) {
        setDraftApiHash(data.apiHash);
      }
      if (data.appTitle) {
        setDraftAppTitle(data.appTitle);
      }
      if (data.shortName) {
        setDraftShortName(data.shortName);
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleTestSyntax = async () => {
    const id = parseInt(draftApiId.trim(), 10);
    const hash = draftApiHash.trim();

    if (isNaN(id) || id <= 0) {
      setTestResult({
        valid: false,
        apiIdValid: false,
        apiHashValid: false,
        errorMessage: "API ID must be a positive number.",
        hints: ["Please enter a valid numeric API ID obtained from my.telegram.org"],
      });
      return;
    }

    try {
      setTesting(true);
      const result = await testApiCredentials(id, hash);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        valid: false,
        apiIdValid: false,
        apiHashValid: false,
        errorMessage: err instanceof Error ? err.message : String(err),
        hints: ["An unexpected error occurred during syntax validation."],
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const id = parseInt(draftApiId.trim(), 10);
    const hash = draftApiHash.trim();

    if (isNaN(id) || id <= 0) {
      setStatusMessage({
        type: "error",
        text: "Please enter a valid numeric App API ID.",
      });
      return;
    }

    if (hash.length !== 32) {
      setStatusMessage({
        type: "error",
        text: "App API Hash must be exactly 32 hexadecimal characters.",
      });
      return;
    }

    try {
      setSaving(true);
      setStatusMessage(null);
      const updated = await saveApiCredentials(
        id,
        hash,
        draftAppTitle.trim() || undefined,
        draftShortName.trim() || undefined,
      );
      setInfo(updated);
      setTestResult(null);
      setStatusMessage({
        type: "success",
        text: "API credentials successfully saved! A restart of Fardgram is recommended to apply parameters to active TDLib instances.",
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      setSaving(true);
      setShowClearConfirm(false);
      setStatusMessage(null);
      const updated = await clearApiCredentials();
      setInfo(updated);
      setDraftApiId(updated.apiId ? String(updated.apiId) : "");
      setDraftApiHash(updated.apiHash || "");
      setDraftAppTitle("");
      setDraftShortName("");
      setTestResult(null);
      setStatusMessage({
        type: "info",
        text: "Custom API credentials cleared. Reverted to system environment variables or default settings.",
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: `Unable to restart automatically: ${err instanceof Error ? err.message : String(err)}. Please close and reopen the app manually.`,
      });
    }
  };

  const openTelegramPortal = () => {
    void openExternalLink("https://my.telegram.org/apps");
  };

  const activeApiId = info?.apiId;
  const activeApiHash = info?.apiHash;
  const maskedHash = activeApiHash
    ? showHash
      ? activeApiHash
      : `${activeApiHash.slice(0, 4)}••••••••••••••••••••••••${activeApiHash.slice(-4)}`
    : "Not Configured";

  return (
    <div className="settings-detail-scroll api-credentials-settings">
      {/* Section 1: Overview & Active Credentials */}
      <section className="settings-section" aria-labelledby="api-overview-heading">
        <div className="settings-section-heading">
          <Code2 size={18} strokeWidth={1.8} />
          <div>
            <h4 id="api-overview-heading">Telegram API & App Credentials</h4>
            <span>Custom Telegram MTProto application keys, TDLib engine configuration, and connection telemetry</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
            {info?.isCustom ? (
              <span className="api-badge api-badge-custom" title="User configured custom credentials">
                <ShieldCheck size={13} /> Custom Active
              </span>
            ) : info?.configured ? (
              <span className="api-badge api-badge-env" title="Supplied via NOTGRAM_API_ID / NOTGRAM_API_HASH">
                <Terminal size={13} /> Environment
              </span>
            ) : (
              <span className="api-badge api-badge-missing" title="No credentials configured">
                <AlertTriangle size={13} /> Unconfigured
              </span>
            )}
          </div>
        </div>

        {/* Status Message Toast */}
        {statusMessage && (
          <div
            className={`api-alert-banner api-alert-${statusMessage.type}`}
            role="status"
          >
            {statusMessage.type === "success" && <CheckCircle2 size={16} />}
            {statusMessage.type === "error" && <XCircle size={16} />}
            {statusMessage.type === "info" && <Info size={16} />}
            <span>{statusMessage.text}</span>
            <button
              type="button"
              className="api-alert-dismiss"
              onClick={() => setStatusMessage(null)}
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        )}

        {/* Current Active Credentials Card */}
        <div className="api-cards-grid">
          {/* Card: Active API ID */}
          <div className="api-credential-card">
            <div className="api-credential-card-header">
              <span className="api-credential-card-title">Active App api_id</span>
              <span className="api-card-pill">
                {activeApiId ? "32-bit Integer" : "Missing"}
              </span>
            </div>
            <div className="api-credential-value-row">
              <code className="api-credential-code">
                {activeApiId ? activeApiId : "—"}
              </code>
              {activeApiId ? (
                <button
                  type="button"
                  className="icon-button api-copy-btn"
                  title="Copy api_id"
                  aria-label="Copy api_id"
                  onClick={() => copyToClipboard(String(activeApiId), "id")}
                >
                  {copiedKey === "id" ? <Check size={15} color="var(--color-status-success, #10b981)" /> : <Copy size={15} />}
                </button>
              ) : null}
            </div>
            <span className="api-credential-hint">
              Unique application identifier assigned by Telegram MTProto servers.
            </span>
          </div>

          {/* Card: Active API HASH */}
          <div className="api-credential-card">
            <div className="api-credential-card-header">
              <span className="api-credential-card-title">Active App api_hash</span>
              <span className="api-card-pill">
                {activeApiHash ? "128-bit MD5 Hex" : "Missing"}
              </span>
            </div>
            <div className="api-credential-value-row">
              <code className="api-credential-code api-credential-hash">
                {maskedHash}
              </code>
              {activeApiHash ? (
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    className="icon-button api-copy-btn"
                    title={showHash ? "Hide hash" : "Show hash"}
                    aria-label={showHash ? "Hide hash" : "Show hash"}
                    onClick={() => setShowHash(!showHash)}
                  >
                    {showHash ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    type="button"
                    className="icon-button api-copy-btn"
                    title="Copy api_hash"
                    aria-label="Copy api_hash"
                    onClick={() => copyToClipboard(activeApiHash, "hash")}
                  >
                    {copiedKey === "hash" ? <Check size={15} color="var(--color-status-success, #10b981)" /> : <Copy size={15} />}
                  </button>
                </div>
              ) : null}
            </div>
            <span className="api-credential-hint">
              Cryptographic client secret required for MTProto authentication handshake.
            </span>
          </div>
        </div>

        {/* Metadata info row */}
        {info?.appTitle || info?.shortName || info?.configFilePath ? (
          <div className="api-meta-details">
            {info.appTitle && (
              <div className="api-meta-item">
                <span className="api-meta-label">App Title:</span>
                <strong className="api-meta-val">{info.appTitle}</strong>
              </div>
            )}
            {info.shortName && (
              <div className="api-meta-item">
                <span className="api-meta-label">Short Name:</span>
                <strong className="api-meta-val">{info.shortName}</strong>
              </div>
            )}
            {info.configFilePath && (
              <div className="api-meta-item api-meta-path">
                <span className="api-meta-label">Config Storage:</span>
                <code className="api-meta-val-path" title={info.configFilePath}>
                  {info.configFilePath}
                </code>
                <button
                  type="button"
                  className="icon-button api-copy-btn"
                  title="Copy config path"
                  onClick={() => copyToClipboard(info.configFilePath, "path")}
                >
                  {copiedKey === "path" ? <Check size={13} color="var(--color-status-success, #10b981)" /> : <Copy size={13} />}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* Section 2: Real-time Telemetry & Diagnostics Monitoring (مانیتورینگ و بررسی) */}
      <section className="settings-section" aria-labelledby="api-monitor-heading">
        <div className="settings-section-heading">
          <Activity size={18} strokeWidth={1.8} />
          <div>
            <h4 id="api-monitor-heading">Engine & Connection Telemetry</h4>
            <span>Live inspection of TDLib runtime link, MTProto protocol handshake, and latency</span>
          </div>
          <button
            type="button"
            className="dialog-secondary"
            style={{ marginLeft: "auto", fontSize: "12px", padding: "6px 12px" }}
            onClick={() => void loadData()}
            disabled={loading}
          >
            {loading ? <LoaderCircle className="spin" size={14} /> : <RotateCcw size={14} />} Refresh Telemetry
          </button>
        </div>

        <div className="api-telemetry-grid">
          {/* Telemetry Metric: TDLib Engine */}
          <div className="api-telemetry-item">
            <div className="api-telemetry-icon">
              <Server size={18} />
            </div>
            <div className="api-telemetry-content">
              <span className="api-telemetry-label">TDLib Dynamic Engine</span>
              <strong className="api-telemetry-value">
                {info?.linked ? (
                  <span style={{ color: "var(--color-status-success, #10b981)" }}>
                    ● Linked (tdjson.dll)
                  </span>
                ) : (
                  <span style={{ color: "var(--color-status-danger, #ef4444)" }}>
                    ○ Disconnected
                  </span>
                )}
              </strong>
              <span className="api-telemetry-sub">Phase: {info?.tdlibState || "standby"}</span>
            </div>
          </div>

          {/* Telemetry Metric: MTProto Connection Status */}
          <div className="api-telemetry-item">
            <div className="api-telemetry-icon">
              <Activity size={18} />
            </div>
            <div className="api-telemetry-content">
              <span className="api-telemetry-label">MTProto Protocol State</span>
              <strong className="api-telemetry-value">
                {connectionStatus === "online" ? (
                  <span style={{ color: "var(--color-status-success, #10b981)" }}>
                    ● Online & Synced
                  </span>
                ) : connectionStatus === "connecting" ? (
                  <span style={{ color: "var(--color-status-warning, #f59e0b)" }}>
                    ◐ Connecting Handshake
                  </span>
                ) : connectionStatus === "syncing" ? (
                  <span style={{ color: "var(--color-accent, #3b82f6)" }}>
                    ↻ Synchronizing Updates
                  </span>
                ) : connectionStatus === "waitingForNetwork" ? (
                  <span style={{ color: "var(--color-status-warning, #f59e0b)" }}>
                    ⚠ Waiting for Network
                  </span>
                ) : (
                  <span style={{ color: "var(--color-muted, #94a3b8)" }}>
                    ○ Offline
                  </span>
                )}
              </strong>
              <span className="api-telemetry-sub">Status: {connectionStatus}</span>
            </div>
          </div>

          {/* Telemetry Metric: Latency / Datacenter Ping */}
          <div className="api-telemetry-item">
            <div className="api-telemetry-icon">
              <Sparkles size={18} />
            </div>
            <div className="api-telemetry-content">
              <span className="api-telemetry-label">Telegram Datacenter Ping</span>
              <strong className="api-telemetry-value">
                {proxyLatencyMs !== undefined && proxyLatencyMs > 0 ? (
                  <span>{proxyLatencyMs} ms</span>
                ) : connectionStatus === "online" ? (
                  <span style={{ color: "var(--color-status-success, #10b981)" }}>Operational</span>
                ) : (
                  <span style={{ color: "var(--color-muted, #94a3b8)" }}>Unmeasured</span>
                )}
              </strong>
              <span className="api-telemetry-sub">End-to-end transport roundtrip</span>
            </div>
          </div>

          {/* Telemetry Metric: Security & Integrity */}
          <div className="api-telemetry-item">
            <div className="api-telemetry-icon">
              <ShieldCheck size={18} />
            </div>
            <div className="api-telemetry-content">
              <span className="api-telemetry-label">Credential Privacy</span>
              <strong className="api-telemetry-value" style={{ color: "var(--color-status-success, #10b981)" }}>
                Local Enclave Storage
              </strong>
              <span className="api-telemetry-sub">Never logged or sent to third parties</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Register or Update API Credentials (ثبت و تغییر اطلاعات) */}
      <section className="settings-section" aria-labelledby="api-register-heading">
        <div className="settings-section-heading">
          <FileCode size={18} strokeWidth={1.8} />
          <div>
            <h4 id="api-register-heading">Register & Modify Credentials</h4>
            <span>Enter your personal Telegram App api_id and api_hash to configure TDLib</span>
          </div>
        </div>

        <div className="api-form-container">
          <div className="api-form-row">
            <div className="api-form-field">
              <label htmlFor="input-api-id" className="api-form-label">
                App api_id <span className="api-field-required">*</span>
              </label>
              <input
                id="input-api-id"
                type="text"
                inputMode="numeric"
                className="api-text-input"
                placeholder="e.g. 2040123"
                value={draftApiId}
                onChange={(e) => setDraftApiId(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <span className="api-field-hint">
                Numeric 32-bit integer assigned to your Telegram Developer Application.
              </span>
            </div>

            <div className="api-form-field">
              <label htmlFor="input-api-hash" className="api-form-label">
                App api_hash <span className="api-field-required">*</span>
              </label>
              <div className="api-input-with-toggle">
                <input
                  id="input-api-hash"
                  type={showDraftHash ? "text" : "password"}
                  className="api-text-input"
                  placeholder="e.g. 0123456789abcdef0123456789abcdef"
                  value={draftApiHash}
                  onChange={(e) => setDraftApiHash(e.target.value.trim().toLowerCase())}
                  maxLength={32}
                />
                <button
                  type="button"
                  className="icon-button api-toggle-vis-btn"
                  title={showDraftHash ? "Hide hash" : "Show hash"}
                  aria-label={showDraftHash ? "Hide hash" : "Show hash"}
                  onClick={() => setShowDraftHash(!showDraftHash)}
                >
                  {showDraftHash ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="api-hash-counter-row">
                <span className="api-field-hint">
                  32-character hexadecimal key (MD5 format).
                </span>
                <span
                  className={`api-char-counter ${draftApiHash.length === 32 ? "is-valid" : ""}`}
                >
                  {draftApiHash.length} / 32
                </span>
              </div>
            </div>
          </div>

          <div className="api-form-row">
            <div className="api-form-field">
              <label htmlFor="input-app-title" className="api-form-label">
                App Title <span className="api-field-optional">(Optional)</span>
              </label>
              <input
                id="input-app-title"
                type="text"
                className="api-text-input"
                placeholder="e.g. Fardgram Desktop"
                value={draftAppTitle}
                onChange={(e) => setDraftAppTitle(e.target.value)}
              />
            </div>

            <div className="api-form-field">
              <label htmlFor="input-short-name" className="api-form-label">
                Short Name <span className="api-field-optional">(Optional)</span>
              </label>
              <input
                id="input-short-name"
                type="text"
                className="api-text-input"
                placeholder="e.g. fardgram"
                value={draftShortName}
                onChange={(e) => setDraftShortName(e.target.value)}
              />
            </div>
          </div>

          {/* Test Result Feedback Box */}
          {testResult && (
            <div
              className={`api-test-result-box ${testResult.valid ? "is-valid" : "is-invalid"}`}
              role="alert"
            >
              <div className="api-test-result-header">
                {testResult.valid ? (
                  <>
                    <CheckCircle2 size={16} color="var(--color-status-success, #10b981)" />
                    <strong>Syntax Validation Passed</strong>
                  </>
                ) : (
                  <>
                    <XCircle size={16} color="var(--color-status-danger, #ef4444)" />
                    <strong>Validation Failed: {testResult.errorMessage}</strong>
                  </>
                )}
              </div>
              <ul className="api-test-hints">
                {testResult.hints.map((hint, idx) => (
                  <li key={idx}>{hint}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions Bar */}
          <div className="settings-inline-actions" style={{ marginTop: "16px" }}>
            <button
              type="button"
              className="dialog-secondary"
              onClick={() => void handleTestSyntax()}
              disabled={testing || saving || !draftApiId || !draftApiHash}
            >
              {testing ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}
              Verify Syntax
            </button>

            <button
              type="button"
              className="dialog-save"
              onClick={() => void handleSave()}
              disabled={saving || !draftApiId || !draftApiHash}
            >
              {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              Save & Register Credentials
            </button>

            {info?.isCustom && (
              <button
                type="button"
                className="dialog-secondary"
                style={{ color: "var(--color-status-danger, #ef4444)" }}
                onClick={() => setShowClearConfirm(true)}
                disabled={saving}
              >
                <RotateCcw size={16} /> Reset to Defaults
              </button>
            )}

            <button
              type="button"
              className="dialog-secondary"
              style={{ marginLeft: "auto" }}
              onClick={() => setShowRestartConfirm(true)}
              title="Restart Fardgram to reinitialize TDLib engine"
            >
              <RotateCcw size={16} /> Restart Fardgram
            </button>
          </div>
        </div>
      </section>

      {/* Section 4: Developer Guidance & My.Telegram.Org Portal */}
      <section className="settings-section api-help-section" aria-labelledby="api-help-heading">
        <div
          className="settings-section-heading"
          style={{ cursor: "pointer" }}
          onClick={() => setShowGuide(!showGuide)}
        >
          <HelpCircle size={18} strokeWidth={1.8} />
          <div>
            <h4 id="api-help-heading">How to Obtain API Credentials from my.telegram.org</h4>
            <span>Official Telegram developer registration procedure and requirements</span>
          </div>
          <button
            type="button"
            className="icon-button"
            style={{ marginLeft: "auto" }}
            aria-label={showGuide ? "Collapse guide" : "Expand guide"}
          >
            {showGuide ? "▲" : "▼"}
          </button>
        </div>

        {showGuide && (
          <div className="api-help-body">
            <div className="api-help-steps">
              <div className="api-help-step">
                <span className="api-step-num">1</span>
                <div>
                  <strong>Log in to Telegram Core Portal</strong>
                  <p>
                    Visit <button type="button" className="api-link-btn" onClick={openTelegramPortal}>my.telegram.org <ExternalLink size={12} /></button> and log in using your phone number and the verification code sent to your Telegram app.
                  </p>
                </div>
              </div>

              <div className="api-help-step">
                <span className="api-step-num">2</span>
                <div>
                  <strong>Navigate to API Development Tools</strong>
                  <p>
                    Click on the <strong>API development tools</strong> link from the navigation menu.
                  </p>
                </div>
              </div>

              <div className="api-help-step">
                <span className="api-step-num">3</span>
                <div>
                  <strong>Create Application</strong>
                  <p>
                    Fill out the form: choose an <strong>App title</strong> (e.g. <code>Fardgram Desktop</code>), a <strong>Short name</strong> (e.g. <code>fardgram</code>), and select <strong>Desktop</strong> as the platform.
                  </p>
                </div>
              </div>

              <div className="api-help-step">
                <span className="api-step-num">4</span>
                <div>
                  <strong>Copy & Paste Credentials</strong>
                  <p>
                    Copy the generated <strong>App api_id</strong> (number) and <strong>App api_hash</strong> (32 hex characters) into the registration fields above, then click <strong>Save & Register Credentials</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="api-portal-cta">
              <button
                type="button"
                className="dialog-save"
                onClick={openTelegramPortal}
              >
                <ExternalLink size={16} /> Open my.telegram.org/apps in Browser
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Confirmation Dialog: Clear Credentials */}
      <MotionPresence present={showClearConfirm}>
        {showClearConfirm ? (
          <ConfirmActionDialog
            title="Reset Custom API Credentials?"
            description="This will delete your custom api-credentials.json file and revert the application to environment variables or default settings."
            confirmLabel="Reset to Default"
            onConfirm={async () => {
              await handleClear();
              return true;
            }}
            onClose={() => setShowClearConfirm(false)}
          />
        ) : null}
      </MotionPresence>

      {/* Confirmation Dialog: Restart Application */}
      <MotionPresence present={showRestartConfirm}>
        {showRestartConfirm ? (
          <ConfirmActionDialog
            title="Restart Fardgram?"
            description="Restarting Fardgram will close active chat sessions and reload TDLib with the newly configured API parameters."
            confirmLabel="Restart Now"
            onConfirm={async () => {
              await handleRestart();
              return true;
            }}
            onClose={() => setShowRestartConfirm(false)}
          />
        ) : null}
      </MotionPresence>
    </div>
  );
}
