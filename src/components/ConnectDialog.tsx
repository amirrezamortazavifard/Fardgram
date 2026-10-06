import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode,
  Flame,
  Gauge,
  Globe,
  Laptop,
  Layers,
  Link2,
  LoaderCircle,
  Lock,
  Play,
  Plus,
  Radar,
  Radio,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  Sliders,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { telegramStore, useTelegramStore } from "../store/telegramStore";
import { MHRV_APPS_SCRIPT_CODE } from "./mhrvScriptTemplate";
import { NetworkMonitorDashboard } from "./NetworkMonitorDashboard";
import type {
  DiscoveredProxy,
  MhrvConfig,
  MhrvState,
  MhrvTestResult,
  ProxyEndpoint,
  ProxyMode,
  ProxyProfile,
  ProxySettings,
  ProxyType,
  WarpState,
} from "../telegram/types";

interface ConnectDialogProps {
  onClose: () => void;
}

type ConnectTab = "monitor" | "warp" | "proxy" | "system" | "v2ray" | "mhrv";

const defaultEndpoint = (): ProxyEndpoint => ({
  type: "socks5",
  server: "127.0.0.1",
  port: 1080,
  username: "",
  password: "",
  secret: "",
  httpOnly: false,
});

const defaultProxySettings: ProxySettings = {
  mode: "system",
  profiles: [{
    id: "proxy-1",
    name: "Proxy 1",
    endpoint: defaultEndpoint(),
  }],
  activeProfileId: "proxy-1",
  autoSwitch: false,
};

export function ConnectDialog({ onClose }: ConnectDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Telegram store hooks
  const settings = useTelegramStore((state) => state.proxySettings);
  const proxyPending = useTelegramStore((state) => state.proxyPending);
  const proxyError = useTelegramStore((state) => state.proxyError);
  const proxyLatencyMs = useTelegramStore((state) => state.proxyLatencyMs);
  const loadProxySettings = useTelegramStore((state) => state.loadProxySettings);
  const saveProxySettings = useTelegramStore((state) => state.saveProxySettings);
  const testProxy = useTelegramStore((state) => state.testProxy);

  // Warp hooks
  const warpState = useTelegramStore((state) => state.warpState);
  const getWarpStatus = useTelegramStore((state) => state.getWarpStatus);
  const startWarp = useTelegramStore((state) => state.startWarp);
  const stopWarp = useTelegramStore((state) => state.stopWarp);

  // Smart MTProto hooks
  const discoveredProxies = useTelegramStore((state) => state.discoveredProxies);
  const discoveringProxies = useTelegramStore((state) => state.discoveringProxies);
  const discoveringError = useTelegramStore((state) => state.discoveringError);
  const discoverProxies = useTelegramStore((state) => state.discoverProxies);
  const applyDiscoveredProxies = useTelegramStore((state) => state.applyDiscoveredProxies);
  const quickConnectBestProxy = useTelegramStore((state) => state.quickConnectBestProxy);

  // V2Ray & Sing-box hooks
  const discoveredV2RayProxies = useTelegramStore((state) => state.discoveredV2RayProxies);
  const discoveringV2RayProxies = useTelegramStore((state) => state.discoveringV2RayProxies);
  const discoveringV2RayError = useTelegramStore((state) => state.discoveringV2RayError);
  const discoverV2RayProxies = useTelegramStore((state) => state.discoverV2RayProxies);
  const applyDiscoveredV2RayProxies = useTelegramStore((state) => state.applyDiscoveredV2RayProxies);
  const singboxState = useTelegramStore((state) => state.singboxState);
  const singboxRoutingMode = useTelegramStore((state) => state.singboxRoutingMode);
  const getSingboxStatus = useTelegramStore((state) => state.getSingboxStatus);
  const startSingbox = useTelegramStore((state) => state.startSingbox);
  const stopSingbox = useTelegramStore((state) => state.stopSingbox);
  const testSingboxNode = useTelegramStore((state) => state.testSingboxNode);
  const parseSingboxLink = useTelegramStore((state) => state.parseSingboxLink);
  const fetchSingboxSubscription = useTelegramStore((state) => state.fetchSingboxSubscription);
  const setSingboxRoutingMode = useTelegramStore((state) => state.setSingboxRoutingMode);

  // MHRV (Google Relay) hooks
  const mhrvState = useTelegramStore((state) => state.mhrvState);
  const mhrvConfig = useTelegramStore((state) => state.mhrvConfig);
  const mhrvTestResult = useTelegramStore((state) => state.mhrvTestResult);
  const mhrvTesting = useTelegramStore((state) => state.mhrvTesting);
  const getMhrvStatus = useTelegramStore((state) => state.getMhrvStatus);
  const startMhrv = useTelegramStore((state) => state.startMhrv);
  const stopMhrv = useTelegramStore((state) => state.stopMhrv);
  const testMhrv = useTelegramStore((state) => state.testMhrv);
  const setMhrvConfig = useTelegramStore((state) => state.setMhrvConfig);

  // Local state
  const [draft, setDraft] = useState<ProxySettings>(() => settings ?? defaultProxySettings);
  const [singboxInputOpen, setSingboxInputOpen] = useState(false);
  const [singboxInputText, setSingboxInputText] = useState("");
  const [singboxSubOpen, setSingboxSubOpen] = useState(false);
  const [singboxSubUrl, setSingboxSubUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isPingingAll, setIsPingingAll] = useState(false);
  const [copiedProxyId, setCopiedProxyId] = useState<string | null>(null);
  const [singboxActionError, setSingboxActionError] = useState<string | null>(null);

  // MHRV local state
  const [mhrvLocalConfig, setMhrvLocalConfig] = useState<MhrvConfig>(() => mhrvConfig);
  const [mhrvShowAdvanced, setMhrvShowAdvanced] = useState(false);
  const [mhrvShowKey, setMhrvShowKey] = useState(false);
  const [mhrvScriptCopied, setMhrvScriptCopied] = useState(false);
  const [mhrvConnecting, setMhrvConnecting] = useState(false);
  const [connectSearchQuery, setConnectSearchQuery] = useState("");

  const [activeTab, setActiveTab] = useState<ConnectTab>(() => {
    if (mhrvState.kind === "running") return "mhrv";
    if (warpState.kind === "running") return "warp";
    if (settings?.mode === "custom") return "proxy";
    if (settings?.mode === "system") return "system";
    return "warp";
  });

  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    () => settings?.activeProfileId ?? settings?.profiles[0]?.id ?? "proxy-1",
  );
  const [proxyListView, setProxyListView] = useState<"pool" | "scanned">("pool");
  const [testingLatency, setTestingLatency] = useState(false);
  const [localLatency, setLocalLatency] = useState<number | null>(proxyLatencyMs ?? null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Load initial settings and proxy statuses
  useEffect(() => {
    void loadProxySettings();
    void getWarpStatus();
    void getSingboxStatus();
    void getMhrvStatus();
  }, [loadProxySettings, getWarpStatus, getSingboxStatus, getMhrvStatus]);

  useEffect(() => {
    if (mhrvConfig) {
      setMhrvLocalConfig((prev) => ({ ...prev, ...mhrvConfig }));
    }
  }, [mhrvConfig]);

  // Keep draft in sync with store
  useEffect(() => {
    if (settings) {
      setDraft(settings);
      if (!selectedProfileId && settings.profiles.length > 0) {
        setSelectedProfileId(settings.activeProfileId ?? settings.profiles[0].id);
      }
    }
  }, [settings, selectedProfileId]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Auto clear success message
  useEffect(() => {
    if (!saveSuccessMsg) return;
    const timer = window.setTimeout(() => setSaveSuccessMsg(null), 3000);
    return () => window.clearTimeout(timer);
  }, [saveSuccessMsg]);

  const getProxyLink = (endpoint: ProxyEndpoint): string => {
    if (endpoint.type === "mtproto") {
      return `tg://proxy?server=${encodeURIComponent(endpoint.server)}&port=${endpoint.port}&secret=${encodeURIComponent(endpoint.secret || "")}`;
    }
    if (endpoint.type === "socks5") {
      if (endpoint.username || endpoint.password) {
        return `tg://socks?server=${encodeURIComponent(endpoint.server)}&port=${endpoint.port}&user=${encodeURIComponent(endpoint.username || "")}&pass=${encodeURIComponent(endpoint.password || "")}`;
      }
      return `tg://socks?server=${encodeURIComponent(endpoint.server)}&port=${endpoint.port}`;
    }
    if (endpoint.type === "v2ray") {
      if (typeof endpoint.v2rayConfig === "string" && endpoint.v2rayConfig.trim().length > 0) {
        return endpoint.v2rayConfig;
      }
      if (endpoint.v2rayConfig) {
        return typeof endpoint.v2rayConfig === "object" ? JSON.stringify(endpoint.v2rayConfig) : String(endpoint.v2rayConfig);
      }
      return `socks5://${endpoint.server}:${endpoint.port}`;
    }
    if (endpoint.type === "http") {
      if (endpoint.username || endpoint.password) {
        return `http://${encodeURIComponent(endpoint.username)}:${encodeURIComponent(endpoint.password)}@${endpoint.server}:${endpoint.port}`;
      }
      return `http://${endpoint.server}:${endpoint.port}`;
    }
    return `${endpoint.server}:${endpoint.port}`;
  };

  const copyToClipboard = (text: string, id?: string, label?: string) => {
    void navigator.clipboard.writeText(text);
    if (id) {
      setCopiedProxyId(id);
      setTimeout(() => setCopiedProxyId(null), 2000);
    }
    setSaveSuccessMsg(label ?? "Proxy link copied to clipboard!");
  };

  // Active profile
  const activeProfile = draft.profiles.find((p) => p.id === selectedProfileId) ?? draft.profiles[0];

  // Current live status calculation
  const isWarpRunning = warpState.kind === "running";
  const isMhrvRunning = mhrvState.kind === "running";
  const isCustomActive = draft.mode === "custom" && !isWarpRunning && !isMhrvRunning;
  const isDirectActive = draft.mode === "direct" && !isWarpRunning && !isMhrvRunning;
  const isSystemActive = draft.mode === "system" && !isWarpRunning && !isMhrvRunning;

  const currentActiveProfile = draft.profiles.find((p) => p.id === draft.activeProfileId);

  // MHRV Handlers
  const handleMhrvConfigChange = (field: keyof MhrvConfig, val: any) => {
    const updated = { ...mhrvLocalConfig, [field]: val };
    setMhrvLocalConfig(updated);
    setMhrvConfig(updated);
  };

  const handleStartMhrv = async () => {
    if (!mhrvLocalConfig.scriptId.trim()) return;
    setMhrvConnecting(true);
    setMhrvConfig(mhrvLocalConfig);
    const ok = await startMhrv(mhrvLocalConfig);
    setMhrvConnecting(false);
    if (ok) {
      setSaveSuccessMsg("Google Relay connected! SOCKS5 proxy applied to Telegram.");
    }
  };

  const handleStopMhrv = async () => {
    setMhrvConnecting(true);
    await stopMhrv();
    setMhrvConnecting(false);
    setSaveSuccessMsg("Google Relay disconnected.");
  };

  const handleTestMhrv = async () => {
    setMhrvConfig(mhrvLocalConfig);
    await testMhrv(mhrvLocalConfig);
  };

  const handleCopyMhrvScript = () => {
    void navigator.clipboard.writeText(MHRV_APPS_SCRIPT_CODE);
    setMhrvScriptCopied(true);
    setTimeout(() => setMhrvScriptCopied(false), 3000);
  };

  // Handlers
  const handleTestLatency = async (endpoint?: ProxyEndpoint) => {
    setTestingLatency(true);
    try {
      const targetSettings: ProxySettings = endpoint
        ? {
            mode: "custom",
            profiles: [{ id: "test", name: "Test", endpoint }],
            activeProfileId: "test",
            autoSwitch: false,
          }
        : draft;
      await testProxy(targetSettings);
      setLocalLatency(telegramStore.getState().proxyLatencyMs ?? null);
    } catch {
      setLocalLatency(null);
    } finally {
      setTestingLatency(false);
    }
  };

  const handleApplySingleProxy = async (proxy: DiscoveredProxy) => {
    const profileId = `smart-${proxy.id}`;
    const profile: ProxyProfile = {
      id: profileId,
      name: proxy.sniDomain ? `⚡ ${proxy.sniDomain}` : `⚡ ${proxy.endpoint.server}`,
      endpoint: proxy.endpoint,
    };
    const existingIndex = draft.profiles.findIndex((p) => p.endpoint.server === proxy.endpoint.server);
    let nextProfiles: ProxyProfile[];
    if (existingIndex >= 0) {
      nextProfiles = draft.profiles.map((p, i) => (i === existingIndex ? profile : p));
    } else {
      nextProfiles = [profile, ...draft.profiles].slice(0, 20);
    }
    const nextSettings: ProxySettings = {
      ...draft,
      mode: "custom",
      profiles: nextProfiles,
      activeProfileId: profileId,
    };
    setDraft(nextSettings);
    setSelectedProfileId(profileId);
    if (isWarpRunning) {
      await stopWarp();
    }
    const ok = await saveProxySettings(nextSettings);
    if (ok) {
      setSaveSuccessMsg(`Connected to ${proxy.endpoint.server}`);
      void handleTestLatency(proxy.endpoint);
    }
  };

  const handleApplyAllDiscovered = async () => {
    if (discoveredProxies.length === 0) return;
    const ok = await applyDiscoveredProxies(discoveredProxies);
    if (ok) {
      setSaveSuccessMsg(`Added ${discoveredProxies.length} proxies to rotation pool`);
    }
  };

  const handleAddToPool = async (proxy: DiscoveredProxy) => {
    const profileId = `smart-${proxy.id}`;
    const profile: ProxyProfile = {
      id: profileId,
      name: proxy.sniDomain ? `⚡ ${proxy.sniDomain}` : `⚡ ${proxy.endpoint.server}`,
      endpoint: proxy.endpoint,
    };
    const existingIndex = draft.profiles.findIndex((p) => p.endpoint.server === proxy.endpoint.server);
    let nextProfiles: ProxyProfile[];
    if (existingIndex >= 0) {
      nextProfiles = draft.profiles.map((p, i) => (i === existingIndex ? profile : p));
    } else {
      nextProfiles = [profile, ...draft.profiles].slice(0, 20);
    }
    const nextSettings: ProxySettings = {
      ...draft,
      profiles: nextProfiles,
    };
    setDraft(nextSettings);
    const ok = await saveProxySettings(nextSettings);
    if (ok) {
      setSaveSuccessMsg(`Added ${proxy.endpoint.server} to configured pool`);
    }
  };

  const handleQuickConnect = async () => {
    if (isWarpRunning) {
      await stopWarp();
    }
    const ok = await quickConnectBestProxy();
    if (ok) {
      setSaveSuccessMsg("Connected to fastest verified MTProto proxy!");
      void handleTestLatency();
    }
  };

  const handleAddProfile = () => {
    if (draft.profiles.length >= 20) return;
    const newId = crypto.randomUUID();
    const newProf: ProxyProfile = {
      id: newId,
      name: `Proxy ${draft.profiles.length + 1}`,
      endpoint: defaultEndpoint(),
    };
    const nextSettings: ProxySettings = {
      ...draft,
      profiles: [...draft.profiles, newProf],
      activeProfileId: draft.activeProfileId || newId,
    };
    setDraft(nextSettings);
    setSelectedProfileId(newId);
  };

  const handleRemoveProfile = (profileId: string) => {
    if (draft.profiles.length <= 1) return;
    const remaining = draft.profiles.filter((p) => p.id !== profileId);
    const nextActiveId = draft.activeProfileId === profileId ? remaining[0].id : draft.activeProfileId;
    const nextSettings: ProxySettings = {
      ...draft,
      profiles: remaining,
      activeProfileId: nextActiveId,
      autoSwitch: remaining.length > 1 && draft.autoSwitch,
    };
    setDraft(nextSettings);
    if (selectedProfileId === profileId) {
      setSelectedProfileId(remaining[0].id);
    }
    void saveProxySettings(nextSettings);
  };

  const handleUpdateActiveProfile = (updater: (p: ProxyProfile) => ProxyProfile) => {
    if (!activeProfile) return;
    const updated = draft.profiles.map((p) => (p.id === activeProfile.id ? updater(p) : p));
    setDraft({ ...draft, profiles: updated });
  };

  const handleActivateProfile = async (profileId: string) => {
    if (isWarpRunning) {
      await stopWarp();
    }
    if (isMhrvRunning) {
      await stopMhrv();
    }
    const nextSettings: ProxySettings = {
      ...draft,
      mode: "custom",
      activeProfileId: profileId,
    };
    setDraft(nextSettings);
    setSelectedProfileId(profileId);
    const ok = await saveProxySettings(nextSettings);
    if (ok) {
      setSaveSuccessMsg("Proxy profile activated");
      const prof = draft.profiles.find((p) => p.id === profileId);
      if (prof) void handleTestLatency(prof.endpoint);
    }
  };

  const handleSaveCustomProfile = async () => {
    const ok = await saveProxySettings({
      ...draft,
      mode: "custom",
      activeProfileId: selectedProfileId,
    });
    if (ok) {
      setSaveSuccessMsg("Custom proxy settings saved and activated");
      if (activeProfile) void handleTestLatency(activeProfile.endpoint);
    }
  };

  const handleSetMode = async (mode: ProxyMode) => {
    if (isWarpRunning && mode !== "custom") {
      await stopWarp();
    }
    if (isMhrvRunning && mode !== "custom") {
      await stopMhrv();
    }
    const nextSettings: ProxySettings = { ...draft, mode };
    setDraft(nextSettings);
    const ok = await saveProxySettings(nextSettings);
    if (ok) {
      setSaveSuccessMsg(mode === "direct" ? "Switched to Direct Connection" : "Switched to System Proxy");
    }
  };

  const handleDisconnectProxy = async () => {
    await handleSetMode("direct");
  };

  const connectTabList: Array<{
    id: ConnectTab;
    label: string;
    icon: typeof Shield;
    searchTerms: string;
    badge?: React.ReactNode;
  }> = [
    {
      id: "monitor",
      label: "Network Monitor",
      icon: Radar,
      searchTerms: "network monitor live telemetry bandwidth ping speed ip radar node topology noc",
      badge: <span className="connect-tab-badge emerald">LIVE</span>,
    },
    {
      id: "warp",
      label: "Internal VPN",
      icon: Shield,
      searchTerms: "cloudflare warp vpn internal tunnel gool mode",
      badge: isWarpRunning ? <span className="connect-tab-badge green">RUNNING</span> : undefined,
    },
    {
      id: "proxy",
      label: "Proxy Management",
      icon: Layers,
      searchTerms: "custom proxies manual socks5 http profiles servers smart mtproto proxy ping auto rotate telegram",
      badge: draft.mode === "custom" && !isWarpRunning && !isMhrvRunning ? (
        <span className="connect-tab-badge teal">ACTIVE</span>
      ) : undefined,
    },
    {
      id: "v2ray",
      label: "Daily V2Ray",
      icon: Activity,
      searchTerms: "daily v2ray vless vmess trojan shadowsocks singbox nodes",
      badge: discoveredV2RayProxies.length > 0 ? (
        <span className="connect-tab-badge purple">{discoveredV2RayProxies.length}</span>
      ) : undefined,
    },
    {
      id: "mhrv",
      label: "Google Relay (MHRV)",
      icon: Globe,
      searchTerms: "google relay apps script domain fronting mhrv edge tunnel censorship bypass",
      badge: isMhrvRunning ? (
        <span className="connect-tab-badge emerald">RUNNING</span>
      ) : mhrvLocalConfig.scriptId ? (
        <span className="connect-tab-badge teal">CONFIGURED</span>
      ) : undefined,
    },
    {
      id: "system",
      label: "Direct / System",
      icon: Laptop,
      searchTerms: "direct system proxy default windows no proxy unencrypted",
      badge: isSystemActive ? (
        <span className="connect-tab-badge gray">ACTIVE</span>
      ) : undefined,
    },
  ];

  const visibleConnectTabs = connectTabList.filter((tab) => {
    if (!connectSearchQuery.trim() && tab.id === "monitor") {
      return false; // featured at top
    }
    return `${tab.label} ${tab.searchTerms}`.toLowerCase().includes(connectSearchQuery.trim().toLowerCase());
  });

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !proxyPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="settings-dialog connect-settings-dialog show-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {/* Header */}
        <header className="settings-dialog-header">
          <h2 id={titleId}>Connect & Anti-Censorship</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>

        {/* Tab Navigation (Vertical Sidebar) */}
        <nav className="settings-categories" aria-label="Connection Methods">
          {/* SPECIAL TOP-LEFT FEATURED BUTTON: LIVE NETWORK MONITOR */}
          <button
            type="button"
            className={`connect-monitor-hero-btn ${activeTab === "monitor" ? "is-active" : ""}`}
            onClick={() => setActiveTab("monitor")}
            title="Open Real-Time Network Telemetry, Node Topology & DC Radar"
          >
            <div className="monitor-btn-icon-wrap">
              <Radar className="monitor-radar-icon" size={19} />
              <span className="monitor-live-dot" />
            </div>
            <div className="monitor-btn-info">
              <div className="monitor-btn-title-row">
                <span className="monitor-btn-title">Network Monitor</span>
                <span className="monitor-badge-pill">LIVE</span>
              </div>
              <span className="monitor-btn-subtitle">Telemetry & Topology</span>
            </div>
          </button>

          <div className="connect-sidebar-divider" />

          <label className="settings-search-field">
            <Search size={15} strokeWidth={1.8} />
            <span className="sr-only">Search connections</span>
            <input
              value={connectSearchQuery}
              onChange={(e) => setConnectSearchQuery(e.target.value)}
              placeholder="Search settings"
              type="search"
            />
            {connectSearchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => setConnectSearchQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </label>

          {visibleConnectTabs.length === 0 ? (
            <p className="settings-search-empty">No matching connections</p>
          ) : (
            visibleConnectTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`settings-category ${isActive ? "is-active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={21} strokeWidth={1.8} />
                  <span>{tab.label}</span>
                  {tab.badge}
                </button>
              );
            })
          )}
        </nav>

        <main className="settings-detail">
          {/* Global Active Connection Status Bar */}
          <header className="settings-detail-header" style={{ height: "auto", minHeight: "56px", paddingRight: "14px", flexWrap: "wrap", rowGap: "8px" }}>
            <div className="connect-status-left" style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
              <span
                className={`connect-status-indicator ${
                  isWarpRunning || isMhrvRunning || isCustomActive ? "active" : isSystemActive ? "system" : "direct"
                }`}
              />
              <div className="connect-status-text">
                <strong>
                  {isWarpRunning
                    ? "Cloudflare WARP VPN (Protected)"
                    : isMhrvRunning
                    ? "Google Relay MHRV (Fronted)"
                    : isCustomActive
                    ? `Custom Proxy: ${currentActiveProfile?.name ?? "Active"}`
                    : isSystemActive
                    ? "System Proxy (OS Default)"
                    : "Direct Connection (No Proxy)"}
                </strong>
                <small>
                  {isWarpRunning
                    ? `SOCKS5 127.0.0.1:${(warpState as Extract<WarpState, { kind: "running" }>).port} • Warp-in-Warp (Gool Mode)`
                    : isMhrvRunning
                    ? `SOCKS5 127.0.0.1:${(mhrvState as Extract<MhrvState, { kind: "running" }>).socks5Port} • Google Apps Script Edge Tunnel`
                    : isCustomActive && currentActiveProfile
                    ? `${currentActiveProfile.endpoint.type.toUpperCase()} ${currentActiveProfile.endpoint.server}:${currentActiveProfile.endpoint.port}`
                    : isSystemActive && draft.system
                    ? `${draft.system.type.toUpperCase()} ${draft.system.server}:${draft.system.port}`
                    : "Traffic routes directly to Telegram servers without encryption tunnel"}
                </small>
              </div>
            </div>

            <div className="connect-status-right" style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              {isCustomActive && (
                <button
                  className="connect-btn-mini danger"
                  type="button"
                  disabled={proxyPending}
                  onClick={() => void handleDisconnectProxy()}
                  title="Disconnect Proxy (Switch to Direct Connection)"
                >
                  <Square size={13} />
                  <span>Disconnect Proxy</span>
                </button>
              )}
              <button
                className="connect-ping-btn"
                type="button"
                disabled={testingLatency || proxyPending}
                onClick={() => void handleTestLatency()}
                title="Test Latency"
              >
                {testingLatency ? <LoaderCircle className="spin" size={14} /> : <Gauge size={14} />}
                <span>
                  {localLatency !== null && localLatency !== undefined
                    ? `${localLatency} ms`
                    : "Test Latency"}
                </span>
              </button>
            </div>
          </header>

          <div className="settings-detail-scroll connect-content-body" style={{ padding: "16px 20px" }}>
            {/* Feedback Messages */}
            {saveSuccessMsg && (
              <div className="connect-toast-msg success" style={{ margin: "0 0 16px 0" }}>
                <CheckCircle2 size={15} />
                <span>{saveSuccessMsg}</span>
              </div>
            )}
            {proxyError && (
              <div className="connect-toast-msg error" style={{ margin: "0 0 16px 0" }}>
                <AlertCircle size={15} />
                <span>{proxyError}</span>
              </div>
            )}

            {/* TAB 0: REAL-TIME NETWORK MONITOR DASHBOARD */}
            {activeTab === "monitor" && (
              <NetworkMonitorDashboard />
            )}

            {/* TAB 1: CLOUDFLARE WARP */}
            {activeTab === "warp" && (
            <div className="connect-warp-section">
              <div className="connect-hero-card">
                <div className="connect-hero-visual">
                  <div className={`connect-hero-icon-pulse ${isWarpRunning ? "is-running" : ""}`}>
                    <ShieldCheck size={38} />
                  </div>
                </div>

                <div className="connect-hero-details">
                  <div className="connect-hero-title-row">
                    <h3>Cloudflare WARP-in-WARP VPN</h3>
                    <span
                      className={`connect-warp-status-pill ${
                        isWarpRunning
                          ? "running"
                          : warpState.kind === "starting" || warpState.kind === "downloading"
                          ? "starting"
                          : warpState.kind === "error"
                          ? "error"
                          : "idle"
                      }`}
                    >
                      {isWarpRunning
                        ? "CONNECTED"
                        : warpState.kind === "downloading"
                        ? "DOWNLOADING"
                        : warpState.kind === "starting"
                        ? "STARTING"
                        : warpState.kind === "error"
                        ? "ERROR"
                        : "DISCONNECTED"}
                    </span>
                  </div>

                  <p className="connect-hero-desc">
                    Encrypts and tunnels all Telegram traffic through Cloudflare edge network via a dual
                    Warp-in-Warp (Gool mode) architecture to bypass Deep Packet Inspection (DPI) and
                    restrictive firewalls without any manual server configuration.
                  </p>

                  {/* Progress Bar when downloading */}
                  {warpState.kind === "downloading" && (
                    <div className="connect-warp-download-box">
                      <div className="connect-warp-download-label">
                        <span>Downloading optimized engine binary...</span>
                        <strong>{(warpState as Extract<WarpState, { kind: "downloading" }>).progress}%</strong>
                      </div>
                      <div className="connect-warp-progress-track">
                        <div
                          className="connect-warp-progress-bar"
                          style={{
                            width: `${(warpState as Extract<WarpState, { kind: "downloading" }>).progress}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {warpState.kind === "error" && (
                    <div className="connect-error-banner">
                      <AlertCircle size={16} />
                      <span>{(warpState as Extract<WarpState, { kind: "error" }>).message}</span>
                    </div>
                  )}

                  {isWarpRunning && (
                    <div className="connect-running-info">
                      <div className="connect-info-chip">
                        <Server size={14} />
                        <span>Tunnel: SOCKS5 127.0.0.1:{(warpState as Extract<WarpState, { kind: "running" }>).port}</span>
                        <button
                          type="button"
                          className="connect-btn-icon-action"
                          style={{ marginLeft: 6, padding: 2 }}
                          title="Copy WARP SOCKS5 link"
                          onClick={() => {
                            const port = (warpState as Extract<WarpState, { kind: "running" }>).port;
                            copyToClipboard(`tg://socks?server=127.0.0.1&port=${port}`, "warp-running-link", "WARP SOCKS5 link copied!");
                          }}
                        >
                          {copiedProxyId === "warp-running-link" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <div className="connect-info-chip">
                        <Lock size={14} />
                        <span>Mode: Warp-in-Warp (Gool)</span>
                      </div>
                      <div className="connect-info-chip">
                        <CheckCircle2 size={14} />
                        <span>Telegram TDLib Bound</span>
                      </div>
                    </div>
                  )}

                  <div className="connect-hero-actions">
                    {isWarpRunning ? (
                      <button
                        className="connect-action-btn danger"
                        type="button"
                        onClick={() => void stopWarp()}
                      >
                        <ShieldAlert size={16} />
                        <span>Disconnect WARP</span>
                      </button>
                    ) : (
                      <button
                        className="connect-action-btn primary"
                        type="button"
                        disabled={warpState.kind === "starting" || warpState.kind === "downloading"}
                        onClick={() => void startWarp()}
                      >
                        {warpState.kind === "starting" || warpState.kind === "downloading" ? (
                          <LoaderCircle className="spin" size={16} />
                        ) : (
                          <Zap size={16} />
                        )}
                        <span>
                          {warpState.kind === "downloading"
                            ? `Downloading Engine (${(warpState as Extract<WarpState, { kind: "downloading" }>).progress}%)`
                            : warpState.kind === "starting"
                            ? "Starting Engine..."
                            : "Connect with Cloudflare WARP"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Technical Specifications Grid */}
              <div className="connect-specs-grid">
                <div className="connect-spec-card">
                  <div className="connect-spec-icon">
                    <Shuffle size={18} />
                  </div>
                  <div>
                    <strong>Dual Tunnel Encapsulation</strong>
                    <p>
                      Chains an outer WireGuard tunnel into an inner Cloudflare tunnel, obfuscating handshake
                      signatures from internet service providers.
                    </p>
                  </div>
                </div>

                <div className="connect-spec-card">
                  <div className="connect-spec-icon">
                    <Server size={18} />
                  </div>
                  <div>
                    <strong>Local SOCKS5 Bridge</strong>
                    <p>
                      Runs a secure local SOCKS5 server on port 8086. Automatically routes TDLib without
                      installing intrusive virtual network adapters.
                    </p>
                  </div>
                </div>

                <div className="connect-spec-card">
                  <div className="connect-spec-icon">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <strong>Zero Configuration</strong>
                    <p>
                      No account signup, server credentials, or manual key management. Connects immediately
                      with a single click.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}



          {/* TAB: DAILY V2RAY (SING-BOX) */}
          {activeTab === "v2ray" && (
            <div className="connect-mtproto-section">
              {/* Sing-box Core Control Banner */}
              <div className="connect-singbox-hero-card">
                <div className="connect-singbox-hero-top">
                  <div className="connect-singbox-status-info">
                    <span className={`connect-core-status-badge ${singboxState.kind}`}>
                      {singboxState.kind === "running" ? (
                        <>
                          <span className="connect-pulsing-dot" />
                          <span>Core Running (Port {singboxState.port})</span>
                        </>
                      ) : singboxState.kind === "starting" ? (
                        <>
                          <LoaderCircle className="spin" size={13} />
                          <span>Starting Core...</span>
                        </>
                      ) : singboxState.kind === "downloading" ? (
                        <>
                          <LoaderCircle className="spin" size={13} />
                          <span>Downloading Core ({singboxState.progress}%)...</span>
                        </>
                      ) : singboxState.kind === "error" ? (
                        <>
                          <AlertCircle size={13} />
                          <span>Core Error</span>
                        </>
                      ) : (
                        <>
                          <Square size={12} />
                          <span>Core Standby</span>
                        </>
                      )}
                    </span>

                    <span className="connect-core-mode-badge">
                      <Sliders size={12} />
                      <span>{singboxRoutingMode === "rule" ? "Rule (Smart Bypass LAN)" : "Global (Tunnel All)"}</span>
                    </span>
                  </div>

                  <div className="connect-singbox-hero-actions">
                    <select
                      className="connect-select-mode"
                      value={singboxRoutingMode}
                      onChange={(e) => setSingboxRoutingMode(e.target.value as "rule" | "global")}
                    >
                      <option value="rule">Rule Mode (Smart Bypass)</option>
                      <option value="global">Global Mode (Proxy All)</option>
                    </select>

                    {singboxState.kind === "running" ? (
                      <button
                        className="connect-btn-danger-outline"
                        type="button"
                        onClick={() => void stopSingbox()}
                      >
                        <Square size={13} />
                        <span>Stop Core</span>
                      </button>
                    ) : (
                      <button
                        className="connect-btn-start-core"
                        type="button"
                        onClick={async () => {
                          const active = discoveredV2RayProxies[0];
                          if (active) {
                            await startSingbox(active.config, 10808, singboxRoutingMode, active.name);
                          }
                        }}
                      >
                        <Play size={13} />
                        <span>Start Core</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="connect-singbox-hero-desc">
                  Official high-performance Sing-box sidecar engine with VLESS Reality, VMess, Trojan, and Shadowsocks tunneling. Proxies all TDLib Telegram traffic through local port <code>127.0.0.1:10808</code> with smart bypass capabilities.
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="connect-singbox-toolbar">
                <button
                  className="connect-btn-toolbar primary"
                  type="button"
                  disabled={discoveringV2RayProxies || proxyPending}
                  onClick={() => void discoverV2RayProxies()}
                >
                  {discoveringV2RayProxies ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}
                  <span>{discoveringV2RayProxies ? "Scanning..." : "Scan Daily Configs"}</span>
                </button>

                <button
                  className={`connect-btn-toolbar ${singboxInputOpen ? "is-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setSingboxInputOpen(!singboxInputOpen);
                    setSingboxSubOpen(false);
                  }}
                >
                  <Link2 size={14} />
                  <span>Import Link / JSON</span>
                </button>

                <button
                  className={`connect-btn-toolbar ${singboxSubOpen ? "is-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setSingboxSubOpen(!singboxSubOpen);
                    setSingboxInputOpen(false);
                  }}
                >
                  <Download size={14} />
                  <span>Subscription URL</span>
                </button>

                <button
                  className="connect-btn-toolbar"
                  type="button"
                  disabled={isPingingAll || discoveredV2RayProxies.length === 0}
                  onClick={async () => {
                    setIsPingingAll(true);
                    for (const p of discoveredV2RayProxies) {
                      try {
                        const parsed = await parseSingboxLink(p.config);
                        const latency = await testSingboxNode(parsed.server, parsed.port, 2000);
                        p.latencyMs = latency > 0 ? latency : 999;
                      } catch {
                        p.latencyMs = 999;
                      }
                    }
                    telegramStore.setState((s) => ({
                      discoveredV2RayProxies: [...s.discoveredV2RayProxies],
                    }));
                    setIsPingingAll(false);
                  }}
                >
                  {isPingingAll ? <LoaderCircle className="spin" size={14} /> : <Zap size={14} />}
                  <span>{isPingingAll ? "Testing..." : "Ping All Nodes"}</span>
                </button>
              </div>

              {/* Collapsible: Import Link / JSON Panel */}
              {singboxInputOpen && (
                <div className="connect-expand-panel">
                  <h4>Import Proxy Link or Raw JSON</h4>
                  <p>Paste any <code>vless://</code>, <code>vmess://</code>, <code>trojan://</code>, <code>ss://</code>, or sing-box JSON configuration:</p>
                  <textarea
                    rows={3}
                    className="connect-textarea-input"
                    value={singboxInputText}
                    onChange={(e) => setSingboxInputText(e.target.value)}
                    placeholder="vless://uuid@server:443?security=reality&...#MyNode"
                  />
                  {singboxActionError && (
                    <div className="connect-panel-error">{singboxActionError}</div>
                  )}
                  <div className="connect-expand-panel-actions">
                    <button
                      className="connect-btn-primary"
                      type="button"
                      disabled={isImporting || !singboxInputText.trim()}
                      onClick={async () => {
                        setIsImporting(true);
                        setSingboxActionError(null);
                        try {
                          const parsed = await parseSingboxLink(singboxInputText.trim());
                          const newProxy: import("../telegram/types").DiscoveredV2RayProxy = {
                            id: parsed.id,
                            name: parsed.name,
                            protocol: parsed.protocol,
                            config: parsed.rawLink,
                            latencyMs: undefined,
                          };
                          telegramStore.setState((s) => ({
                            discoveredV2RayProxies: [newProxy, ...s.discoveredV2RayProxies],
                          }));
                          setSingboxInputText("");
                          setSingboxInputOpen(false);
                          setSaveSuccessMsg(`Imported ${parsed.name} (${parsed.protocol.toUpperCase()})`);
                        } catch (err) {
                          setSingboxActionError(err instanceof Error ? err.message : String(err));
                        } finally {
                          setIsImporting(false);
                        }
                      }}
                    >
                      {isImporting ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}
                      <span>Parse & Add Node</span>
                    </button>
                    <button
                      className="connect-btn-text"
                      type="button"
                      onClick={() => {
                        setSingboxInputOpen(false);
                        setSingboxActionError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Collapsible: Subscription Panel */}
              {singboxSubOpen && (
                <div className="connect-expand-panel">
                  <h4>Import Subscription Feed</h4>
                  <p>Enter a V2Ray / Sing-box subscription link (HTTP/HTTPS) returning base64 or plaintext configs:</p>
                  <input
                    type="url"
                    className="connect-url-input"
                    value={singboxSubUrl}
                    onChange={(e) => setSingboxSubUrl(e.target.value)}
                    placeholder="https://example.com/api/v1/client/subscribe?token=..."
                  />
                  {singboxActionError && (
                    <div className="connect-panel-error">{singboxActionError}</div>
                  )}
                  <div className="connect-expand-panel-actions">
                    <button
                      className="connect-btn-primary"
                      type="button"
                      disabled={isImporting || !singboxSubUrl.trim()}
                      onClick={async () => {
                        setIsImporting(true);
                        setSingboxActionError(null);
                        try {
                          const nodes = await fetchSingboxSubscription(singboxSubUrl.trim());
                          const discoveredNodes: import("../telegram/types").DiscoveredV2RayProxy[] = nodes.map((n) => ({
                            id: n.id,
                            name: n.name,
                            protocol: n.protocol,
                            config: n.rawLink,
                            latencyMs: n.latencyMs,
                          }));
                          telegramStore.setState((s) => ({
                            discoveredV2RayProxies: [...discoveredNodes, ...s.discoveredV2RayProxies].slice(0, 50),
                          }));
                          setSingboxSubUrl("");
                          setSingboxSubOpen(false);
                          setSaveSuccessMsg(`Imported ${discoveredNodes.length} nodes from subscription!`);
                        } catch (err) {
                          setSingboxActionError(err instanceof Error ? err.message : String(err));
                        } finally {
                          setIsImporting(false);
                        }
                      }}
                    >
                      {isImporting ? <LoaderCircle className="spin" size={14} /> : <Download size={14} />}
                      <span>Fetch & Import All</span>
                    </button>
                    <button
                      className="connect-btn-text"
                      type="button"
                      onClick={() => {
                        setSingboxSubOpen(false);
                        setSingboxActionError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {discoveringV2RayError && (
                <div className="connect-error-banner">
                  <AlertCircle size={16} />
                  <span>{discoveringV2RayError}</span>
                </div>
              )}

              {/* Proxies List */}
              {discoveredV2RayProxies.length > 0 ? (
                <>
                  <div className="connect-list-header-row">
                    <span>
                      Sing-box Profile Pool (<strong>{discoveredV2RayProxies.length}</strong> available)
                    </span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="connect-btn-text"
                        type="button"
                        onClick={() => {
                          const allLinks = discoveredV2RayProxies.map((p) => p.config).join("\n");
                          copyToClipboard(allLinks, "all-v2ray-proxies", `Copied ${discoveredV2RayProxies.length} proxy configs!`);
                        }}
                      >
                        {copiedProxyId === "all-v2ray-proxies" ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                        <span>Copy All</span>
                      </button>
                      <button
                        className="connect-btn-text"
                        type="button"
                        onClick={async () => {
                          const ok = await applyDiscoveredV2RayProxies(discoveredV2RayProxies);
                          if (ok) {
                            setSaveSuccessMsg(`Added ${discoveredV2RayProxies.length} V2Ray configs to pool`);
                          }
                        }}
                      >
                        <Check size={14} />
                        <span>Add All to Custom</span>
                      </button>
                    </div>
                  </div>

                  <div className="connect-proxy-list">
                    {discoveredV2RayProxies.map((proxy) => {
                      const dotColor =
                        proxy.latencyMs && proxy.latencyMs < 250
                          ? "green"
                          : proxy.latencyMs && proxy.latencyMs < 500
                          ? "yellow"
                          : "red";
                      const isThisActive =
                        draft.mode === "custom" &&
                        draft.activeProfileId === `smart-v2ray-${proxy.id}` &&
                        !isWarpRunning;

                      return (
                        <div key={proxy.id} className={`connect-proxy-item ${isThisActive ? "is-active" : ""}`}>
                          <div className="connect-proxy-meta">
                            <span className={`connect-ping-dot ${dotColor}`} />
                            <div className="connect-proxy-address">
                              <strong>{proxy.name}</strong>
                              <div className="connect-proxy-tags">
                                <span className="connect-tag standard" style={{ textTransform: "uppercase" }}>
                                  {proxy.protocol}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="connect-proxy-item-actions">
                            <span className={`connect-proxy-latency ${dotColor}`}>
                              {proxy.latencyMs ? `${proxy.latencyMs} ms` : "Unknown ms"}
                            </span>

                            {/* Ping Single Node */}
                            <button
                              className="connect-btn-icon-action"
                              type="button"
                              title="Test latency"
                              onClick={async () => {
                                try {
                                  const parsed = await parseSingboxLink(proxy.config);
                                  const latency = await testSingboxNode(parsed.server, parsed.port, 2500);
                                  proxy.latencyMs = latency > 0 ? latency : 999;
                                  telegramStore.setState((s) => ({
                                    discoveredV2RayProxies: [...s.discoveredV2RayProxies],
                                  }));
                                } catch {
                                  proxy.latencyMs = 999;
                                  telegramStore.setState((s) => ({
                                    discoveredV2RayProxies: [...s.discoveredV2RayProxies],
                                  }));
                                }
                              }}
                            >
                              <Zap size={14} />
                            </button>

                            {/* Copy Share Link */}
                            <button
                              className="connect-btn-icon-action"
                              type="button"
                              title="Copy link"
                              onClick={() => {
                                navigator.clipboard.writeText(proxy.config);
                                setCopiedProxyId(proxy.id);
                                setTimeout(() => setCopiedProxyId(null), 2000);
                              }}
                            >
                              {copiedProxyId === proxy.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                            </button>

                            {/* Delete Node */}
                            <button
                              className="connect-btn-icon-action danger"
                              type="button"
                              title="Remove config"
                              onClick={() => {
                                telegramStore.setState((s) => ({
                                  discoveredV2RayProxies: s.discoveredV2RayProxies.filter((p) => p.id !== proxy.id),
                                }));
                              }}
                            >
                              <Trash2 size={14} />
                            </button>

                            {isThisActive ? (
                              <span className="connect-badge-connected">
                                <Check size={13} />
                                <span>Connected</span>
                              </span>
                            ) : (
                              <button
                                className="connect-btn-item"
                                type="button"
                                disabled={proxyPending}
                                onClick={async () => {
                                  const ok = await applyDiscoveredV2RayProxies([proxy], proxy.id);
                                  if (ok) {
                                    setSaveSuccessMsg(`Connected via ${proxy.name}`);
                                    await startSingbox(proxy.config, 10808, singboxRoutingMode, proxy.name);
                                  }
                                }}
                              >
                                Connect
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="connect-empty-state">
                  <div className="connect-empty-icon">
                    <Activity size={32} />
                  </div>
                  <strong>No Sing-box Configs Available</strong>
                  <p>
                    Click "Scan Daily Configs" to automatically fetch fresh VLESS/VMess/Trojan nodes, or use "Import Link / JSON" to paste your own proxy configs.
                  </p>
                  <button
                    className="connect-btn-primary"
                    type="button"
                    disabled={discoveringV2RayProxies || proxyPending}
                    onClick={() => void discoverV2RayProxies()}
                  >
                    {discoveringV2RayProxies ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
                    <span>Start Daily Scan</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: UNIFIED PROXY MANAGEMENT */}
          {activeTab === "proxy" && (
            <div className="connect-custom-section">
              {/* Top Card: Live Proxy Status & Disconnect Action */}
              <div className={`connect-proxy-status-card ${isCustomActive ? "active" : ""}`}>
                <div className="connect-proxy-status-main">
                  <div className={`connect-proxy-status-beacon ${isCustomActive ? "active" : "inactive"}`}>
                    <Radio size={18} />
                  </div>
                  <div className="connect-proxy-status-details">
                    <div className="connect-proxy-status-title-row">
                      <strong>
                        {isCustomActive
                          ? `Active Proxy: ${currentActiveProfile?.name ?? "Custom Proxy"}`
                          : "Proxy Disconnected (Direct Connection)"}
                      </strong>
                      <span className={`connect-status-pill ${isCustomActive ? "connected" : "disconnected"}`}>
                        {isCustomActive ? "CONNECTED" : "DISCONNECTED"}
                      </span>
                      {isCustomActive && localLatency !== null && localLatency !== undefined && (
                        <span className="connect-proxy-latency green">{localLatency} ms</span>
                      )}
                    </div>
                    <p>
                      {isCustomActive && currentActiveProfile
                        ? `${currentActiveProfile.endpoint.type.toUpperCase()} • ${currentActiveProfile.endpoint.server}:${currentActiveProfile.endpoint.port}`
                        : "Telegram routes directly without proxy. Connect to bypass restrictions or select another VPN method."}
                    </p>
                  </div>
                </div>

                <div className="connect-proxy-status-actions">
                  {isCustomActive ? (
                    <button
                      className="connect-btn-disconnect"
                      type="button"
                      disabled={proxyPending}
                      onClick={() => void handleDisconnectProxy()}
                      title="Disconnect proxy and return to direct connection"
                    >
                      <Square size={13} />
                      <span>Disconnect Proxy</span>
                    </button>
                  ) : (
                    <button
                      className="connect-btn-connect-active"
                      type="button"
                      disabled={proxyPending || !activeProfile}
                      onClick={() => {
                        if (activeProfile) void handleActivateProfile(activeProfile.id);
                      }}
                      title="Activate selected proxy profile"
                    >
                      <Play size={13} />
                      <span>Connect Proxy</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Subdeck Grid: Auto-Failover & Smart MTProto Scanner */}
              <div className="connect-proxy-subdeck-grid">
                {/* Card 1: Auto-Failover Rotation */}
                <div className="connect-subdeck-card">
                  <div className="connect-subdeck-left">
                    <div className="connect-deck-icon-wrap">
                      <Shuffle size={17} />
                    </div>
                    <div className="connect-subdeck-text">
                      <div className="connect-subdeck-title">
                        <strong>Auto-Failover</strong>
                        <span className={`connect-pill-status ${draft.autoSwitch ? "active" : ""}`}>
                          {draft.autoSwitch ? "ENABLED" : "OFF"}
                        </span>
                      </div>
                      <small>Auto-switch to next healthy profile on timeout</small>
                    </div>
                  </div>
                  <label className="connect-switch" title="Toggle Auto-Failover">
                    <input
                      type="checkbox"
                      checked={draft.autoSwitch}
                      disabled={draft.profiles.length < 2}
                      onChange={(e) => {
                        const next = { ...draft, autoSwitch: e.target.checked };
                        setDraft(next);
                        void saveProxySettings(next);
                      }}
                    />
                    <span className="connect-slider" />
                  </label>
                </div>

                {/* Card 2: Smart MTProto Scanner */}
                <div className="connect-subdeck-card">
                  <div className="connect-subdeck-left">
                    <div className="connect-deck-icon-wrap zap">
                      <Zap size={17} />
                    </div>
                    <div className="connect-subdeck-text">
                      <div className="connect-subdeck-title">
                        <strong>MTProto Scanner</strong>
                        {discoveredProxies.length > 0 && (
                          <span className="connect-pill-status active">
                            {discoveredProxies.length} ALIVE
                          </span>
                        )}
                      </div>
                      <small>Auto-discover anti-censorship Telegram nodes</small>
                    </div>
                  </div>
                  <div className="connect-subdeck-actions">
                    <button
                      className="connect-btn-scanner"
                      type="button"
                      disabled={discoveringProxies || proxyPending}
                      onClick={() => {
                        setProxyListView("scanned");
                        void discoverProxies();
                      }}
                    >
                      {discoveringProxies ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />}
                      <span>{discoveringProxies ? "Scanning..." : "Scan"}</span>
                    </button>
                    {discoveredProxies.length > 0 && (
                      <button
                        className="connect-btn-scanner-add"
                        type="button"
                        onClick={() => void handleApplyAllDiscovered()}
                        title="Add All Scanned Proxies to Rotation Pool"
                      >
                        <Check size={13} />
                        <span>Add All ({discoveredProxies.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {discoveringError && (
                <div className="connect-error-banner" style={{ marginBottom: "16px" }}>
                  <AlertCircle size={16} />
                  <span>{discoveringError}</span>
                </div>
              )}

              {/* Two Column Layout: Profile List & Active Editor */}
              <div className="connect-custom-layout">
                {/* Left Column: Segmented Switcher & List */}
                <div className="connect-profiles-column">
                  {/* Segmented Switcher */}
                  <div className="connect-segmented-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={proxyListView === "pool"}
                      className={`connect-segmented-btn ${proxyListView === "pool" ? "is-active" : ""}`}
                      onClick={() => setProxyListView("pool")}
                    >
                      <Server size={14} />
                      <span>Configured Pool</span>
                      <span className="connect-tab-count-badge">{draft.profiles.length}/20</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={proxyListView === "scanned"}
                      className={`connect-segmented-btn ${proxyListView === "scanned" ? "is-active" : ""}`}
                      onClick={() => setProxyListView("scanned")}
                    >
                      <Zap size={14} />
                      <span>Scanned Nodes</span>
                      <span className="connect-tab-count-badge">{discoveredProxies.length}</span>
                    </button>
                  </div>

                  {/* Pool Subbar */}
                  {proxyListView === "pool" ? (
                    <>
                      <div className="connect-column-subbar">
                        <span className="connect-column-subbar-title">Custom Profiles</span>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <button
                            className="connect-btn-mini"
                            type="button"
                            onClick={() => {
                              const allLinks = draft.profiles.map((p) => getProxyLink(p.endpoint)).join("\n");
                              copyToClipboard(allLinks, "all-custom-profiles", `Copied ${draft.profiles.length} profiles!`);
                            }}
                            title="Copy All Profiles"
                          >
                            {copiedProxyId === "all-custom-profiles" ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                            <span>Copy All</span>
                          </button>
                          <button
                            className="connect-btn-mini primary"
                            type="button"
                            disabled={draft.profiles.length >= 20}
                            onClick={handleAddProfile}
                            title="Add New Profile"
                          >
                            <Plus size={13} />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>

                      <div className="connect-profiles-scroll">
                        {draft.profiles.map((profile) => {
                          const isCurrentActive = draft.activeProfileId === profile.id && draft.mode === "custom" && !isWarpRunning;
                          const isSelected = profile.id === selectedProfileId;

                          return (
                            <div
                              key={profile.id}
                              className={`connect-profile-card ${isSelected ? "selected" : ""} ${isCurrentActive ? "active" : ""}`}
                              onClick={() => setSelectedProfileId(profile.id)}
                            >
                              <div className="connect-profile-card-left">
                                <span className={`connect-profile-dot ${isCurrentActive ? "active" : ""}`} />
                                <div className="connect-profile-card-info">
                                  <strong title={profile.name}>{profile.name}</strong>
                                  <small title={`${profile.endpoint.type.toUpperCase()} • ${profile.endpoint.server}:${profile.endpoint.port}`}>
                                    {profile.endpoint.type.toUpperCase()} • {profile.endpoint.server}:{profile.endpoint.port}
                                  </small>
                                </div>
                              </div>

                              <div className="connect-profile-card-right">
                                {isCurrentActive && <span className="connect-mini-active-badge">Active</span>}
                                <button
                                  className="connect-btn-trash"
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const link = getProxyLink(profile.endpoint);
                                    copyToClipboard(link, `profile-${profile.id}`, "Profile link copied!");
                                  }}
                                  title="Copy Proxy Link"
                                >
                                  {copiedProxyId === `profile-${profile.id}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                                </button>
                                <button
                                  className="connect-btn-trash"
                                  type="button"
                                  disabled={draft.profiles.length <= 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveProfile(profile.id);
                                  }}
                                  title="Delete Profile"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Scanned Nodes Subbar */}
                      <div className="connect-column-subbar">
                        <span className="connect-column-subbar-title">Discovered MTProto</span>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          {discoveredProxies.length > 0 && (
                            <button
                              className="connect-btn-mini primary"
                              type="button"
                              onClick={() => void handleApplyAllDiscovered()}
                              title="Add all scanned nodes to rotation pool"
                            >
                              <Check size={13} />
                              <span>Add All ({discoveredProxies.length})</span>
                            </button>
                          )}
                          <button
                            className="connect-btn-mini"
                            type="button"
                            disabled={discoveringProxies || proxyPending}
                            onClick={() => void discoverProxies()}
                            title="Rescan MTProto nodes"
                          >
                            {discoveringProxies ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />}
                            <span>Scan</span>
                          </button>
                        </div>
                      </div>

                      <div className="connect-profiles-scroll">
                        {discoveredProxies.length === 0 ? (
                          <div style={{ padding: "32px 16px", textAlign: "center", display: "grid", gap: "10px", placeItems: "center" }}>
                            <Radar size={28} style={{ color: "var(--muted)", opacity: 0.6 }} />
                            <strong style={{ fontSize: "13px", color: "var(--ink)" }}>No Scanned Proxies</strong>
                            <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>
                              Click "Scan MTProto" to discover fresh anti-censorship nodes automatically.
                            </p>
                            <button
                              className="connect-btn-mini primary"
                              type="button"
                              disabled={discoveringProxies || proxyPending}
                              onClick={() => void discoverProxies()}
                              style={{ marginTop: "4px" }}
                            >
                              {discoveringProxies ? <LoaderCircle className="spin" size={13} /> : <Zap size={13} />}
                              <span>Start MTProto Scan</span>
                            </button>
                          </div>
                        ) : (
                          discoveredProxies.map((proxy) => {
                            const dotColor = proxy.latencyMs < 250 ? "green" : proxy.latencyMs < 500 ? "yellow" : "red";
                            const isThisActive = draft.mode === "custom" && draft.activeProfileId === `smart-${proxy.id}` && !isWarpRunning;

                            return (
                              <div key={proxy.id} className={`connect-proxy-item ${isThisActive ? "is-active" : ""}`}>
                                <div className="connect-proxy-meta">
                                  <span className={`connect-ping-dot ${dotColor}`} />
                                  <div className="connect-proxy-address">
                                    <strong title={`${proxy.endpoint.server}:${proxy.endpoint.port}`}>
                                      {proxy.endpoint.server}:{proxy.endpoint.port}
                                    </strong>
                                    <span className="connect-proxy-sub" title={proxy.sniDomain ? `TLS SNI: ${proxy.sniDomain}` : "MTProto Server"}>
                                      {proxy.sniDomain ? `SNI: ${proxy.sniDomain}` : "MTProto Node"}
                                    </span>
                                  </div>
                                </div>

                                <div className="connect-proxy-item-actions">
                                  <span className={`connect-proxy-latency ${dotColor}`}>{proxy.latencyMs} ms</span>
                                  <button
                                    className="connect-btn-add-pool"
                                    type="button"
                                    onClick={() => void handleAddToPool(proxy)}
                                    title="Add to Configured Pool"
                                  >
                                    <Plus size={13} />
                                  </button>
                                  {isThisActive ? (
                                    <span className="connect-badge-connected" title="Currently Active Connection">
                                      <Check size={13} />
                                    </span>
                                  ) : (
                                    <button
                                      className="connect-btn-item"
                                      type="button"
                                      disabled={proxyPending}
                                      onClick={() => void handleApplySingleProxy(proxy)}
                                    >
                                      Connect
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Right Column: Profile Editor */}
                {activeProfile ? (
                  <div className="connect-editor-column">
                    <div className="connect-column-header">
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                        Edit: {activeProfile.name}
                      </span>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          className="connect-btn-mini"
                          type="button"
                          onClick={() => {
                            const link = getProxyLink(activeProfile.endpoint);
                            copyToClipboard(link, `editor-${activeProfile.id}`, "Profile link copied!");
                          }}
                          title="Copy Proxy Link"
                        >
                          {copiedProxyId === `editor-${activeProfile.id}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          <span>Copy Link</span>
                        </button>
                        {draft.mode === "custom" && draft.activeProfileId === activeProfile.id ? (
                          <button
                            className="connect-btn-mini danger"
                            type="button"
                            onClick={() => void handleDisconnectProxy()}
                            title="Disconnect this active proxy profile"
                          >
                            <Square size={13} />
                            <span>Disconnect</span>
                          </button>
                        ) : (
                          <button
                            className="connect-btn-mini primary"
                            type="button"
                            onClick={() => void handleActivateProfile(activeProfile.id)}
                            title="Set this profile as active and connect"
                          >
                            <Check size={13} />
                            <span>Set Active</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="connect-form-fields">
                      <div className="connect-form-field">
                        <label>Profile Name</label>
                        <input
                          type="text"
                          maxLength={40}
                          value={activeProfile.name}
                          onChange={(e) => handleUpdateActiveProfile((p) => ({ ...p, name: e.target.value }))}
                          placeholder="My Proxy Server"
                        />
                      </div>

                      <div className="connect-form-field">
                        <label>Protocol Type</label>
                        <select
                          value={activeProfile.endpoint.type}
                          onChange={(e) => handleUpdateActiveProfile((p) => ({
                            ...p, endpoint: { ...p.endpoint, type: e.target.value as ProxyType }
                          }))}
                        >
                          <option value="socks5">SOCKS5</option>
                          <option value="http">HTTP</option>
                          <option value="mtproto">MTProto</option>
                          <option value="v2ray">Sing-box (VLESS / VMess / Trojan)</option>
                        </select>
                      </div>

                      <div className="connect-form-row">
                        <div className="connect-form-field flex-2">
                          <label>Server Host / IP</label>
                          <input
                            type="text"
                            required
                            value={activeProfile.endpoint.server}
                            onChange={(e) => handleUpdateActiveProfile((p) => ({
                              ...p, endpoint: { ...p.endpoint, server: e.target.value }
                            }))}
                            placeholder="127.0.0.1 or domain.com"
                          />
                        </div>

                        <div className="connect-form-field flex-1">
                          <label>Port</label>
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            required
                            value={activeProfile.endpoint.port}
                            onChange={(e) => handleUpdateActiveProfile((p) => ({
                              ...p, endpoint: { ...p.endpoint, port: Number(e.target.value) || 1080 }
                            }))}
                            placeholder="1080"
                          />
                        </div>
                      </div>

                      {activeProfile.endpoint.type === "v2ray" && (
                        <div className="connect-form-field">
                          <label>Sing-box / V2Ray Link or Config</label>
                          <textarea
                            rows={3}
                            className="connect-textarea-input"
                            value={typeof activeProfile.endpoint.v2rayConfig === "string" ? activeProfile.endpoint.v2rayConfig : JSON.stringify(activeProfile.endpoint.v2rayConfig ?? "")}
                            onChange={(e) => handleUpdateActiveProfile((p) => ({
                              ...p, endpoint: { ...p.endpoint, v2rayConfig: e.target.value }
                            }))}
                            placeholder="vless://... or vmess://... or JSON configuration"
                          />
                        </div>
                      )}

                      {activeProfile.endpoint.type === "mtproto" ? (
                        <div className="connect-form-field">
                          <label>MTProto Secret</label>
                          <input
                            type="password"
                            autoComplete="off"
                            value={activeProfile.endpoint.secret}
                            onChange={(e) => handleUpdateActiveProfile((p) => ({
                              ...p, endpoint: { ...p.endpoint, secret: e.target.value }
                            }))}
                            placeholder="dd... or ee... hex secret"
                          />
                        </div>
                      ) : (
                        <div className="connect-form-row">
                          <div className="connect-form-field flex-1">
                            <label>Username (Optional)</label>
                            <input
                              type="text"
                              autoComplete="off"
                              value={activeProfile.endpoint.username}
                              onChange={(e) => handleUpdateActiveProfile((p) => ({
                                ...p, endpoint: { ...p.endpoint, username: e.target.value }
                              }))}
                              placeholder="Username"
                            />
                          </div>
                          <div className="connect-form-field flex-1">
                            <label>Password (Optional)</label>
                            <input
                              type="password"
                              autoComplete="off"
                              value={activeProfile.endpoint.password}
                              onChange={(e) => handleUpdateActiveProfile((p) => ({
                                ...p, endpoint: { ...p.endpoint, password: e.target.value }
                              }))}
                              placeholder="Password"
                            />
                          </div>
                        </div>
                      )}

                      {activeProfile.endpoint.type === "http" && (
                        <label className="connect-checkbox-label">
                          <input
                            type="checkbox"
                            checked={activeProfile.endpoint.httpOnly}
                            onChange={(e) => handleUpdateActiveProfile((p) => ({
                              ...p, endpoint: { ...p.endpoint, httpOnly: e.target.checked }
                            }))}
                          />
                          <span>HTTP Only (Do not use CONNECT tunneling)</span>
                        </label>
                      )}

                      <div className="connect-editor-actions">
                        <button
                          className="connect-btn-secondary"
                          type="button"
                          disabled={testingLatency || proxyPending}
                          onClick={() => void handleTestLatency(activeProfile.endpoint)}
                        >
                          {testingLatency ? <LoaderCircle className="spin" size={15} /> : <Gauge size={15} />}
                          <span>Test Endpoint</span>
                        </button>

                        <button
                          className="connect-btn-primary"
                          type="button"
                          disabled={proxyPending}
                          onClick={() => void handleSaveCustomProfile()}
                        >
                          <Check size={15} />
                          <span>Save & Activate</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* TAB 4: DIRECT / SYSTEM */}
          {activeTab === "system" && (
            <div className="connect-system-section">
              <div className="connect-mode-cards">
                {/* Direct Connection Card */}
                <div className={`connect-mode-card ${isDirectActive ? "is-selected" : ""}`}>
                  <div className="connect-mode-card-header">
                    <div className="connect-mode-card-icon">
                      <Globe size={24} />
                    </div>
                    <div className="connect-mode-card-title">
                      <strong>Direct Connection (No Proxy)</strong>
                      <span>Direct TCP/TLS route straight to Telegram DC clusters</span>
                    </div>
                  </div>
                  <p className="connect-mode-card-desc">
                    Connects directly without passing traffic through any proxy, tunnel or VPN. Recommended
                    if you are on an uncensored network or if you are already using a full-system VPN client.
                  </p>
                  <div className="connect-mode-card-footer">
                    {isDirectActive ? (
                      <span className="connect-badge-active">Currently Active</span>
                    ) : (
                      <button
                        className="connect-btn-primary"
                        type="button"
                        onClick={() => void handleSetMode("direct")}
                      >
                        Use Direct Connection
                      </button>
                    )}
                  </div>
                </div>

                {/* System Proxy Card */}
                <div className={`connect-mode-card ${isSystemActive ? "is-selected" : ""}`}>
                  <div className="connect-mode-card-header">
                    <div className="connect-mode-card-icon">
                      <Laptop size={24} />
                    </div>
                    <div className="connect-mode-card-title">
                      <strong>System Proxy (OS Settings)</strong>
                      <span>Detects and routes through Windows system proxy settings</span>
                    </div>
                  </div>
                  <p className="connect-mode-card-desc">
                    Automatically inherits system HTTP/SOCKS proxy configurations managed by local tools (such
                    as Clash, v2rayN, or enterprise PAC configurations).
                  </p>

                  <div className="connect-system-detected">
                    {draft.system ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <div>
                          <span className="label">Detected System Proxy:</span>
                          <code>
                            {draft.system.type.toUpperCase()}://{draft.system.server}:{draft.system.port}
                          </code>
                        </div>
                        <button
                          type="button"
                          className="connect-btn-icon-action"
                          title="Copy System Proxy Link"
                          onClick={() => {
                            if (draft.system) {
                              const link = getProxyLink(draft.system);
                              copyToClipboard(link, "system-proxy-link", "System proxy link copied!");
                            }
                          }}
                        >
                          {copiedProxyId === "system-proxy-link" ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <span className="label">Status:</span>
                        <span>No system proxy detected in Windows settings.</span>
                      </div>
                    )}
                  </div>

                  <div className="connect-mode-card-footer">
                    {isSystemActive ? (
                      <span className="connect-badge-active">Currently Active</span>
                    ) : (
                      <button
                        className="connect-btn-primary"
                        type="button"
                        onClick={() => void handleSetMode("system")}
                      >
                        Use System Proxy
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: GOOGLE RELAY (MHRV) */}
          {activeTab === "mhrv" && (
            <div className="connect-warp-section">
              {/* Hero Status Card */}
              <div className="connect-hero-card mhrv">
                <div className="connect-hero-visual">
                  <div className={`connect-hero-icon-pulse mhrv ${isMhrvRunning ? "is-running" : ""}`}>
                    <Globe size={38} />
                  </div>
                </div>

                <div className="connect-hero-details">
                  <div className="connect-hero-title-row">
                    <h3>Google Apps Script Relay (MHRV)</h3>
                    <span
                      className={`connect-warp-status-pill ${
                        isMhrvRunning
                          ? "running"
                          : mhrvState.kind === "starting" || mhrvConnecting
                          ? "starting"
                          : mhrvState.kind === "error"
                          ? "error"
                          : "idle"
                      }`}
                    >
                      {isMhrvRunning
                        ? "CONNECTED"
                        : mhrvState.kind === "starting" || mhrvConnecting
                        ? "CONNECTING"
                        : mhrvState.kind === "error"
                        ? "ERROR"
                        : "DISCONNECTED"}
                    </span>
                  </div>

                  <p className="connect-hero-desc">
                    Tunnels and disguises Telegram traffic through Google's edge network (<code>www.google.com</code>)
                    to a private Google Apps Script edge worker. Completely circumvents Deep Packet Inspection (DPI)
                    and censorship even during national filtering where only Google services are accessible.
                  </p>

                  {/* Error banner */}
                  {mhrvState.kind === "error" && (
                    <div className="connect-error-banner">
                      <AlertCircle size={16} />
                      <span>{mhrvState.message}</span>
                    </div>
                  )}

                  {/* Active running info chips */}
                  {isMhrvRunning && (
                    <div className="connect-running-info">
                      <div className="connect-info-chip">
                        <Server size={14} />
                        <span>SOCKS5 127.0.0.1:{(mhrvState as Extract<MhrvState, { kind: "running" }>).socks5Port}</span>
                        <button
                          type="button"
                          className="connect-btn-icon-action"
                          style={{ marginLeft: 6, padding: 2 }}
                          title="Copy SOCKS5 Proxy Link"
                          onClick={() => {
                            const port = (mhrvState as Extract<MhrvState, { kind: "running" }>).socks5Port;
                            copyToClipboard(`tg://socks?server=127.0.0.1&port=${port}`, "mhrv-socks-link", "MHRV SOCKS5 link copied!");
                          }}
                        >
                          {copiedProxyId === "mhrv-socks-link" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <div className="connect-info-chip">
                        <Globe size={14} />
                        <span>Front: {mhrvLocalConfig.frontDomain || "www.google.com"} ({mhrvLocalConfig.googleIp || "216.239.38.120"})</span>
                      </div>
                      <div className="connect-info-chip">
                        <Lock size={14} />
                        <span>HTTP Port: {(mhrvState as Extract<MhrvState, { kind: "running" }>).httpPort}</span>
                      </div>
                      <div className="connect-info-chip">
                        <CheckCircle2 size={14} />
                        <span>Telegram TDLib Active</span>
                      </div>
                    </div>
                  )}

                  {/* Hero Action Buttons */}
                  <div className="connect-hero-actions">
                    {isMhrvRunning ? (
                      <button
                        className="connect-action-btn danger"
                        type="button"
                        disabled={mhrvConnecting}
                        onClick={() => void handleStopMhrv()}
                      >
                        {mhrvConnecting ? <LoaderCircle className="spin" size={16} /> : <Square size={16} />}
                        <span>Disconnect Relay</span>
                      </button>
                    ) : (
                      <button
                        className="connect-action-btn primary"
                        type="button"
                        disabled={mhrvConnecting || !mhrvLocalConfig.scriptId.trim() || !mhrvLocalConfig.authKey.trim()}
                        onClick={() => void handleStartMhrv()}
                        title={
                          !mhrvLocalConfig.scriptId.trim() || !mhrvLocalConfig.authKey.trim()
                            ? "Please enter your Script ID and Secret Key below"
                            : "Launch MasterHttpRelayVPN and connect Telegram"
                        }
                      >
                        {mhrvConnecting ? <LoaderCircle className="spin" size={16} /> : <Zap size={16} />}
                        <span>Connect Google Relay</span>
                      </button>
                    )}

                    <button
                      className="connect-btn-secondary"
                      type="button"
                      disabled={mhrvTesting || !mhrvLocalConfig.scriptId.trim() || !mhrvLocalConfig.authKey.trim()}
                      onClick={() => void handleTestMhrv()}
                    >
                      {mhrvTesting ? <LoaderCircle className="spin" size={14} /> : <Gauge size={14} />}
                      <span>{mhrvTesting ? "Testing Relay..." : "Test Connection"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Diagnostic Test Result Box */}
              {mhrvTestResult && (
                <div className={`connect-test-result-box ${mhrvTestResult.success ? "success" : "error"}`}>
                  {mhrvTestResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 650 }}>
                      <span>{mhrvTestResult.success ? "Relay Connection Verified" : "Relay Test Failed"}</span>
                      {mhrvTestResult.latencyMs !== undefined && (
                        <span className="connect-warp-status-pill running" style={{ fontSize: "10px" }}>
                          {mhrvTestResult.latencyMs} ms
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: "4px", fontSize: "11.5px", opacity: 0.9 }}>
                      {mhrvTestResult.message}
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Form Card */}
              <div className="connect-mhrv-card">
                <div className="connect-mhrv-card-title">
                  <span>Relay Configuration</span>
                  <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--muted)" }}>
                    Requires Google Apps Script deployment
                  </span>
                </div>

                <div className="connect-mhrv-form-grid">
                  {/* Script ID or URL */}
                  <div className="connect-mhrv-field">
                    <label htmlFor="mhrv-script-id">
                      <Terminal size={14} />
                      <span>Google Apps Script Deployment ID or Web App URL</span>
                      <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div className="connect-mhrv-input-wrapper">
                      <input
                        id="mhrv-script-id"
                        type="text"
                        className="connect-mhrv-input"
                        placeholder="e.g. AKfycbw8... or https://script.google.com/macros/s/.../exec"
                        value={mhrvLocalConfig.scriptId}
                        onChange={(e) => handleMhrvConfigChange("scriptId", e.target.value)}
                      />
                    </div>
                    <p className="connect-mhrv-field-desc">
                      Paste the deployment ID from script.google.com or the complete Web App URL. The relay will automatically extract and clean the ID.
                    </p>
                  </div>

                  {/* Auth Key */}
                  <div className="connect-mhrv-field">
                    <label htmlFor="mhrv-auth-key">
                      <Lock size={14} />
                      <span>Secret Auth Key (AUTH_KEY)</span>
                      <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div className="connect-mhrv-input-wrapper">
                      <input
                        id="mhrv-auth-key"
                        type={mhrvShowKey ? "text" : "password"}
                        className="connect-mhrv-input has-icon-right"
                        placeholder="Enter the secret key configured in Code.gs"
                        value={mhrvLocalConfig.authKey}
                        onChange={(e) => handleMhrvConfigChange("authKey", e.target.value)}
                      />
                      <button
                        type="button"
                        className="connect-mhrv-toggle-pw"
                        onClick={() => setMhrvShowKey(!mhrvShowKey)}
                        title={mhrvShowKey ? "Hide secret" : "Show secret"}
                      >
                        {mhrvShowKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="connect-mhrv-field-desc">
                      Must match the <code>AUTH_KEY</code> constant declared at the top of your <code>Code.gs</code> file.
                    </p>
                  </div>

                  {/* Advanced Settings Toggle */}
                  <div style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      className="connect-mhrv-adv-toggle"
                      onClick={() => setMhrvShowAdvanced(!mhrvShowAdvanced)}
                    >
                      {mhrvShowAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{mhrvShowAdvanced ? "Hide Advanced Network Settings" : "Show Advanced Network Settings (Google Edge IP & Ports)"}</span>
                    </button>
                  </div>

                  {mhrvShowAdvanced && (
                    <div className="connect-mhrv-adv-grid">
                      <div className="connect-mhrv-field">
                        <label htmlFor="mhrv-google-ip">Clean Google Edge IP</label>
                        <input
                          id="mhrv-google-ip"
                          type="text"
                          className="connect-mhrv-input"
                          placeholder="216.239.38.120"
                          value={mhrvLocalConfig.googleIp || "216.239.38.120"}
                          onChange={(e) => handleMhrvConfigChange("googleIp", e.target.value)}
                        />
                        <p className="connect-mhrv-field-desc">
                          Google IP used for domain fronting (default: <code>216.239.38.120</code>).
                        </p>
                      </div>

                      <div className="connect-mhrv-field">
                        <label htmlFor="mhrv-front-domain">Front Domain</label>
                        <input
                          id="mhrv-front-domain"
                          type="text"
                          className="connect-mhrv-input"
                          placeholder="www.google.com"
                          value={mhrvLocalConfig.frontDomain || "www.google.com"}
                          onChange={(e) => handleMhrvConfigChange("frontDomain", e.target.value)}
                        />
                        <p className="connect-mhrv-field-desc">
                          SNI/Host used for handshake (default: <code>www.google.com</code>).
                        </p>
                      </div>

                      <div className="connect-mhrv-field">
                        <label htmlFor="mhrv-socks-port">Local SOCKS5 Port</label>
                        <input
                          id="mhrv-socks-port"
                          type="number"
                          className="connect-mhrv-input"
                          placeholder="8088"
                          value={mhrvLocalConfig.socks5Port ?? 8088}
                          onChange={(e) => handleMhrvConfigChange("socks5Port", Number(e.target.value) || 8088)}
                        />
                      </div>

                      <div className="connect-mhrv-field">
                        <label htmlFor="mhrv-http-port">Local HTTP Port</label>
                        <input
                          id="mhrv-http-port"
                          type="number"
                          className="connect-mhrv-input"
                          placeholder="8087"
                          value={mhrvLocalConfig.httpPort ?? 8087}
                          onChange={(e) => handleMhrvConfigChange("httpPort", Number(e.target.value) || 8087)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Deployment Guide & Code.gs Export */}
              <div className="connect-mhrv-guide-box">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FileCode size={18} color="#10b981" />
                    <strong style={{ fontSize: "13px", color: "var(--ink)" }}>
                      How to Deploy Google Apps Script Relay (3 Steps)
                    </strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="connect-btn-secondary"
                      style={{ padding: "5px 12px", fontSize: "11.5px" }}
                      onClick={handleCopyMhrvScript}
                    >
                      {mhrvScriptCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      <span>{mhrvScriptCopied ? "Code.gs Copied!" : "Copy Code.gs Script"}</span>
                    </button>
                    <a
                      href="https://script.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="connect-btn-secondary"
                      style={{ padding: "5px 12px", fontSize: "11.5px", textDecoration: "none" }}
                    >
                      <ExternalLink size={14} />
                      <span>Open script.google.com</span>
                    </a>
                  </div>
                </div>

                <div className="connect-mhrv-step-list">
                  <div className="connect-mhrv-step-item">
                    <span className="connect-mhrv-step-number">1</span>
                    <div>
                      <strong>Create Project:</strong> Go to <a href="https://script.google.com" target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>script.google.com</a>, log in with your Google account, and click <strong>New project</strong>.
                    </div>
                  </div>
                  <div className="connect-mhrv-step-item">
                    <span className="connect-mhrv-step-number">2</span>
                    <div>
                      <strong>Paste Script:</strong> Click <strong>Copy Code.gs Script</strong> above, replace the default code in the editor, and change <code>AUTH_KEY = "CHANGE_ME_TO_A_STRONG_SECRET"</code> to your own private secret.
                    </div>
                  </div>
                  <div className="connect-mhrv-step-item">
                    <span className="connect-mhrv-step-number">3</span>
                    <div>
                      <strong>Deploy Web App:</strong> Click <strong>Deploy → New deployment</strong>. Select type <strong>Web app</strong>, configure:
                      <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                        <li><strong>Execute as:</strong> Me (your email)</li>
                        <li><strong>Who has access:</strong> Anyone</li>
                      </ul>
                      Click <strong>Deploy</strong>, grant permissions, copy the <strong>Deployment ID</strong>, and paste it into the field above!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
