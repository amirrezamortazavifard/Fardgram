import { CheckCircle2, CloudDownload, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  appUpdater,
  type AppDistribution,
  type AppUpdateInfo,
  type AppUpdateProgress,
} from "../release/appUpdater";
import { openExternalLink } from "../utils/externalLinks";

type UpdateState = "idle" | "checking" | "current" | "available" | "installing" | "error";

const updateChannel = (version: string) =>
  version.includes("-") ? "Release Candidate (Beta)" : "Stable Channel";

export function UpdateSettings() {
  const [distribution, setDistribution] = useState<AppDistribution>();
  const [currentVersion, setCurrentVersion] = useState("-");
  const [state, setState] = useState<UpdateState>("idle");
  const [update, setUpdate] = useState<AppUpdateInfo>();
  const [progress, setProgress] = useState<AppUpdateProgress>();
  const [lastChecked, setLastChecked] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    void appUpdater.distribution().then((value) => {
      if (active) setDistribution(value);
    }).catch(() => {
      if (active) setDistribution("unknown");
    });
    void appUpdater.currentVersion().then((version) => {
      if (active) setCurrentVersion(version);
    }).catch(() => {
      if (active) setCurrentVersion("Unknown");
    });
    return () => { active = false; };
  }, []);

  const supported = distribution === "installed";

  const check = async () => {
    setState("checking");
    setUpdate(undefined);
    setErrorMessage(undefined);
    try {
      const next = await appUpdater.check();
      setUpdate(next);
      setState(next ? "available" : "current");
      setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setState("error");
    }
  };

  const install = async () => {
    setState("installing");
    setProgress(undefined);
    try {
      await appUpdater.install(setProgress);
    } catch {
      setState("error");
    }
  };

  const openReleasesPage = () => {
    void openExternalLink("https://github.com/amirrezamortazavifard/Fardgram/releases");
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "0 MB";
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="settings-detail-scroll update-settings">
      <section className="settings-section" aria-labelledby="update-version-heading">
        <div className="settings-section-heading">
          <CloudDownload size={18} strokeWidth={1.8} />
          <div>
            <h4 id="update-version-heading">Fardgram {currentVersion}</h4>
            <span>{updateChannel(currentVersion)} • {distribution === "installed" ? "Installed Edition (Auto-Updates Enabled)" : distribution === "portable" ? "Portable Edition" : "Development Build"}</span>
          </div>
          {lastChecked && (
            <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--muted)" }}>
              Last checked: {lastChecked}
            </span>
          )}
        </div>

        <div className="update-status" role="status" aria-live="polite">
          {state === "current" ? (
            <>
              <CheckCircle2 size={18} color="var(--color-status-success, #10b981)" />
              <span>You are using the latest version of Fardgram.</span>
            </>
          ) : state === "available" && update ? (
            <>
              <CloudDownload size={18} color="var(--color-accent, #3b82f6)" />
              <span>A new update is available: <strong>v{update.version}</strong></span>
            </>
          ) : state === "installing" ? (
            <>
              <LoaderCircle className="spin" size={18} />
              <span>
                Downloading update {update?.version ? `v${update.version}` : ""}...{" "}
                {progress?.downloadedBytes ? `(${formatBytes(progress.downloadedBytes)}${progress.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ""})` : ""}
              </span>
            </>
          ) : state === "error" ? (
            <>
              <AlertCircle size={18} color="var(--color-status-danger, #ef4444)" />
              <span>{errorMessage ? `Update check failed: ${errorMessage}` : "Update check failed. Check your internet connection or GitHub access."}</span>
            </>
          ) : distribution === "portable" ? (
            <span>Portable editions are updated by downloading the latest archive release.</span>
          ) : distribution === "browser" ? (
            <span>Web preview mode does not support native updates.</span>
          ) : distribution === "unknown" ? (
            <span>Current distribution format does not support automatic in-place updates.</span>
          ) : (
            <span>{supported ? "Automatic update check ready." : "Resolving version metadata..."}</span>
          )}
        </div>

        {state === "installing" && (
          <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <progress
              className="update-progress"
              aria-label="Update download progress"
              max={1}
              value={progress?.fraction ?? 0}
              style={{ width: "100%", height: "8px", borderRadius: "4px" }}
            />
            {progress?.fraction !== undefined && (
              <span style={{ fontSize: "11px", color: "var(--muted)", textAlign: "right" }}>
                {Math.round(progress.fraction * 100)}% completed
              </span>
            )}
          </div>
        )}

        {update?.notes && (
          <div className="update-notes" style={{ marginTop: "14px" }}>
            <strong>Release Notes — v{update.version}</strong>
            <p>{update.notes}</p>
          </div>
        )}

        <div className="settings-inline-actions" style={{ marginTop: "14px" }}>
          <button
            className="dialog-secondary"
            type="button"
            disabled={!supported || state === "checking" || state === "installing"}
            onClick={() => void check()}
          >
            {state === "checking" ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}
            Check for Updates
          </button>

          {(state === "available" || (state === "error" && update)) && (
            <button className="dialog-save" type="button" onClick={() => void install()}>
              <CloudDownload size={16} />
              {state === "error" ? "Retry Installation" : `Install & Relaunch (v${update?.version ?? ""})`}
            </button>
          )}

          <button
            className="dialog-secondary"
            type="button"
            style={{ marginLeft: "auto" }}
            onClick={openReleasesPage}
          >
            <ExternalLink size={14} /> View All Releases on GitHub
          </button>
        </div>
      </section>

      {/* Security & Cryptographic Verification Note */}
      <section className="settings-section" aria-labelledby="updater-security-heading">
        <div className="settings-section-heading">
          <ShieldCheck size={18} strokeWidth={1.8} />
          <div>
            <h4 id="updater-security-heading">Cryptographic Verification & Integrity</h4>
            <span>Signed with Minisign Ed25519 public key verification to protect against tampering</span>
          </div>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
          All official Fardgram release packages are cryptographically signed during the automated GitHub Actions build process. The updater strictly validates each payload against the embedded public key before installation.
        </p>
      </section>
    </div>
  );
}
