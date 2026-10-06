import { useState } from "react";
import { translate } from "../i18n";
import {
  Check,
  Copy,
  Gauge,
  LoaderCircle,
  Network,
  Plus,
  RefreshCw,
  Shuffle,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import type { DiscoveredProxy, ProxyEndpoint, ProxyMode, ProxyProfile, ProxySettings, ProxyType, WarpState } from "../telegram/types";
import { useTelegramStore } from "../store/telegramStore";

interface ProxySettingsEditorProps {
  settings: ProxySettings;
  busy: boolean;
  pending: boolean;
  latency?: number;
  onChange: (settings: ProxySettings) => void;
  onTest: () => void;
}

const modeOptions: Array<{ value: ProxyMode; label: string }> = [
  { value: "system", get label() { return translate("系统代理"); } },
  { value: "direct", get label() { return translate("直连"); } },
  { value: "custom", get label() { return translate("自定义"); } },
];

const proxyTypeLabels: Record<ProxyType, string> = {
  http: "HTTP",
  socks5: "SOCKS5",
  mtproto: "MTProto",
  v2ray: "V2Ray",
};

const defaultEndpoint = (): ProxyEndpoint => ({
  type: "http",
  server: "127.0.0.1",
  port: 7890,
  username: "",
  password: "",
  secret: "",
  httpOnly: false,
});

const newProfile = (position: number): ProxyProfile => ({
  id: crypto.randomUUID(),
  name: translate("代理 {{value0}}", { value0: position }),
  endpoint: defaultEndpoint(),
});

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
  if (endpoint.type === "http") {
    if (endpoint.username || endpoint.password) {
      return `http://${encodeURIComponent(endpoint.username)}:${encodeURIComponent(endpoint.password)}@${endpoint.server}:${endpoint.port}`;
    }
    return `http://${endpoint.server}:${endpoint.port}`;
  }
  return `${endpoint.server}:${endpoint.port}`;
};

export function ProxySettingsEditor({
  settings,
  busy,
  pending,
  latency,
  onChange,
  onTest,
}: ProxySettingsEditorProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyText = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const discoveredProxies = useTelegramStore((state) => state.discoveredProxies);
  const discoveringProxies = useTelegramStore((state) => state.discoveringProxies);
  const discoveringError = useTelegramStore((state) => state.discoveringError);
  const discoverProxies = useTelegramStore((state) => state.discoverProxies);
  const applyDiscoveredProxies = useTelegramStore((state) => state.applyDiscoveredProxies);
  const quickConnectBestProxy = useTelegramStore((state) => state.quickConnectBestProxy);
  const warpState = useTelegramStore((state) => state.warpState);
  const startWarp = useTelegramStore((state) => state.startWarp);
  const stopWarp = useTelegramStore((state) => state.stopWarp);

  const activeProfile = settings.profiles.find(
    (profile) => profile.id === settings.activeProfileId,
  ) ?? settings.profiles[0];
  const activeEndpoint = settings.mode === "system"
    ? settings.system
    : activeProfile?.endpoint;

  const updateProfile = (profileId: string, update: (profile: ProxyProfile) => ProxyProfile) => {
    onChange({
      ...settings,
      profiles: settings.profiles.map((profile) =>
        profile.id === profileId ? update(profile) : profile),
    });
  };

  const updateEndpoint = <Key extends keyof ProxyEndpoint>(
    key: Key,
    value: ProxyEndpoint[Key],
  ) => {
    if (!activeProfile) return;
    updateProfile(activeProfile.id, (profile) => ({
      ...profile,
      endpoint: { ...profile.endpoint, [key]: value },
    }));
  };

  const addProfile = () => {
    if (settings.profiles.length >= 20) return;
    const profile = newProfile(settings.profiles.length + 1);
    onChange({
      ...settings,
      profiles: [...settings.profiles, profile],
      activeProfileId: profile.id,
    });
  };

  const removeProfile = (profileId: string) => {
    if (settings.profiles.length <= 1) return;
    const profiles = settings.profiles.filter((profile) => profile.id !== profileId);
    onChange({
      ...settings,
      profiles,
      activeProfileId: settings.activeProfileId === profileId
        ? profiles[0].id
        : settings.activeProfileId,
      autoSwitch: profiles.length > 1 && settings.autoSwitch,
    });
  };

  const handleConnectSingle = (proxy: DiscoveredProxy) => {
    const profileId = `smart-${proxy.id}`;
    const profile: ProxyProfile = {
      id: profileId,
      name: proxy.sniDomain ? `⚡ ${proxy.sniDomain}` : `⚡ ${proxy.endpoint.server}`,
      endpoint: proxy.endpoint,
    };
    const existingIndex = settings.profiles.findIndex((p) => p.endpoint.server === proxy.endpoint.server);
    let nextProfiles: ProxyProfile[];
    if (existingIndex >= 0) {
      nextProfiles = settings.profiles.map((p, i) => (i === existingIndex ? profile : p));
    } else {
      nextProfiles = [profile, ...settings.profiles].slice(0, 20);
    }
    onChange({
      ...settings,
      mode: "custom",
      profiles: nextProfiles,
      activeProfileId: profileId,
    });
  };

  const handleApplyAll = async () => {
    if (discoveredProxies.length > 0) {
      await applyDiscoveredProxies(discoveredProxies);
    }
  };

  return (
    <>
      <div className="proxy-mode" role="radiogroup" aria-label={translate("代理模式")}>
        {modeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={settings.mode === option.value}
            className={settings.mode === option.value ? "is-active" : ""}
            onClick={() => onChange({ ...settings, mode: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="smart-proxy-box">
        <div className="smart-proxy-header">
          <div className="smart-proxy-title">
            <Sparkles size={16} />
            <span>{translate("智能抗封锁代理")} (MTProto Anti-Filter)</span>
          </div>
          <div className="smart-proxy-actions">
            <button
              className="smart-proxy-btn"
              type="button"
              disabled={discoveringProxies || busy}
              onClick={() => void discoverProxies()}
            >
              {discoveringProxies ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />}
              <span>{translate("搜索并测速代理")}</span>
            </button>
            <button
              className="smart-proxy-btn primary"
              type="button"
              disabled={discoveringProxies || busy}
              onClick={() => void quickConnectBestProxy()}
              title={translate("自动寻找最快代理并连接")}
            >
              <Zap size={13} />
              <span>{translate("一键快连")}</span>
            </button>
          </div>
        </div>

        {discoveringError ? (
          <div className="smart-proxy-error" role="alert">{discoveringError}</div>
        ) : null}

        {discoveredProxies.length > 0 ? (
          <>
            <div className="smart-proxy-list">
              {discoveredProxies.map((proxy) => {
                const dotColor = proxy.latencyMs < 250 ? "green" : proxy.latencyMs < 500 ? "yellow" : "red";
                return (
                  <div key={proxy.id} className="smart-proxy-item">
                    <div className="smart-proxy-info">
                      <span className={`smart-proxy-ping-dot ${dotColor}`} />
                      <span className="smart-proxy-server">{proxy.endpoint.server}:{proxy.endpoint.port}</span>
                      {proxy.isFakeTls ? (
                        <span className="smart-proxy-tag" title="Fake-TLS Domain">
                          {proxy.sniDomain ? `TLS: ${proxy.sniDomain}` : "Fake-TLS"}
                        </span>
                      ) : (
                        <span className="smart-proxy-tag">MTProto</span>
                      )}
                    </div>
                    <div className="smart-proxy-actions">
                      <span
                        className="smart-proxy-latency"
                        style={{ color: dotColor === "green" ? "var(--color-status-success)" : undefined }}
                      >
                        {proxy.latencyMs} ms
                      </span>
                      <button
                        className="smart-proxy-btn"
                        type="button"
                        title="Copy MTProto link (tg://proxy?...)"
                        onClick={() => copyText(getProxyLink(proxy.endpoint), `smart-${proxy.id}`)}
                      >
                        {copiedId === `smart-${proxy.id}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      </button>
                      <button
                        className="smart-proxy-btn"
                        type="button"
                        onClick={() => handleConnectSingle(proxy)}
                      >
                        {translate("立即连接")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: 4, flexWrap: "wrap" }}>
              <button
                className="smart-proxy-btn"
                type="button"
                onClick={() => {
                  const allLinks = discoveredProxies.map((p) => getProxyLink(p.endpoint)).join("\n");
                  copyText(allLinks, "all-smart-proxies");
                }}
              >
                {copiedId === "all-smart-proxies" ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>Copy All Links</span>
              </button>
              <button
                className="smart-proxy-btn"
                type="button"
                onClick={() => void handleApplyAll()}
              >
                <Check size={14} />
                <span>{translate("将全部应用至自动切换列表")}</span>
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="warp-box">
        <div className="smart-proxy-header">
          <div className="smart-proxy-title">
            <span style={{ fontSize: 15 }}>☁️</span>
            <span>Cloudflare WARP (Internal VPN)</span>
          </div>
          <div className="smart-proxy-actions">
            {warpState.kind === "running" ? (
              <button
                className="smart-proxy-btn"
                type="button"
                onClick={() => void stopWarp()}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-status-success)", display: "inline-block" }} />
                <span>Stop WARP</span>
              </button>
            ) : (
              <button
                className="smart-proxy-btn primary"
                type="button"
                disabled={warpState.kind === "starting" || warpState.kind === "downloading"}
                onClick={() => void startWarp()}
              >
                {(warpState.kind === "starting" || warpState.kind === "downloading") ? (
                  <LoaderCircle className="spin" size={13} />
                ) : (
                  <Zap size={13} />
                )}
                <span>
                  {warpState.kind === "downloading"
                    ? `Downloading ${(warpState as Extract<WarpState, { kind: "downloading" }>).progress}%`
                    : warpState.kind === "starting"
                    ? "Starting..."
                    : "Start WARP"}
                </span>
              </button>
            )}
          </div>
        </div>
        {warpState.kind === "error" ? (
          <div className="smart-proxy-error" role="alert">
            {(warpState as Extract<WarpState, { kind: "error" }>).message}
          </div>
        ) : null}
        {warpState.kind === "running" ? (
          <div className="smart-proxy-item" style={{ fontSize: 12, opacity: 0.8 }}>
            <span className="smart-proxy-ping-dot green" />
            <span>SOCKS5 → 127.0.0.1:{(warpState as Extract<WarpState, { kind: "running" }>).port} (Gool mode)</span>
          </div>
        ) : null}
        <p style={{ fontSize: 11, opacity: 0.55, margin: "4px 0 0", lineHeight: 1.5 }}>
          Routes traffic through Cloudflare WARP using Warp-in-Warp tunneling to bypass censorship without manual configuration.
        </p>
      </div>

      {settings.mode === "system" ? (
        <div className="proxy-system-status">
          <Network size={18} strokeWidth={1.8} />
          {settings.systemStatus?.kind === "unavailable" || settings.systemStatus?.kind === "unsupported" ? (
            <div>
              <strong>{settings.systemStatus.kind === "unsupported"
                ? translate("暂不支持此系统代理配置") : translate("暂时无法读取系统代理")}</strong>
              <span>{settings.system ? translate("保留最近有效的代理，正在自动重试")
                : translate("请设置静态系统代理或选择自定义代理")}</span>
            </div>
          ) : settings.system ? (
            <div>
              <strong>{proxyTypeLabels[settings.system.type]}</strong>
              <span>{settings.system.server}:{settings.system.port}</span>
            </div>
          ) : (
            <div><strong>{translate("未检测到系统代理")}</strong><span>{translate("当前将使用直连")}</span></div>
          )}
        </div>
      ) : null}

      {settings.mode === "direct" ? (
        <div className="proxy-system-status">
          <Network size={18} strokeWidth={1.8} />
          <div><strong>{translate("直连")}</strong><span>{translate("TDLib 代理已停用")}</span></div>
        </div>
      ) : null}

      {settings.mode === "custom" && activeProfile ? (
        <div className="proxy-custom-settings">
          <div className="proxy-profile-list" role="list" aria-label={translate("自定义代理")}>
            {settings.profiles.map((profile) => {
              const selected = profile.id === activeProfile.id;
              return (
                <div
                  key={profile.id}
                  className={`proxy-profile-row ${selected ? "is-active" : ""}`}
                  role="listitem"
                >
                  <button
                    className="proxy-profile-select"
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange({ ...settings, activeProfileId: profile.id })}
                  >
                    {selected ? <Check size={16} /> : <Network size={16} />}
                    <span>
                      <strong>{profile.name}</strong>
                      <small>{profile.endpoint.server}:{profile.endpoint.port}</small>
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title="Copy proxy link"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyText(getProxyLink(profile.endpoint), `profile-${profile.id}`);
                    }}
                  >
                    {copiedId === `profile-${profile.id}` ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                  </button>
                  <button
                    className="icon-button proxy-profile-remove"
                    type="button"
                    aria-label={translate("删除 {{value0}}", { value0: profile.name })}
                    title={translate("删除代理")}
                    disabled={settings.profiles.length <= 1}
                    onClick={() => removeProfile(profile.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
            <button
              className="proxy-profile-add"
              type="button"
              disabled={settings.profiles.length >= 20}
              onClick={addProfile}
            >
              <Plus size={16} />
              <span>{translate("添加代理")}</span>
            </button>
          </div>

          <label className="proxy-auto-switch">
            <span>
              <Shuffle size={16} />
              <span><strong>{translate("自动切换")}</strong><small>{translate("连续连接失败后轮换到下一项")}</small></span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={settings.autoSwitch}
              disabled={settings.profiles.length < 2}
              onChange={(event) => onChange({ ...settings, autoSwitch: event.target.checked })}
            />
          </label>

          <div className="proxy-fields">
            <label className="auth-field">
              <span>{translate("名称")}</span>
              <input
                required
                maxLength={40}
                value={activeProfile.name}
                onChange={(event) => updateProfile(activeProfile.id, (profile) => ({
                  ...profile,
                  name: event.target.value,
                }))}
              />
            </label>
            <label className="auth-field">
              <span>{translate("代理类型")}</span>
              <select
                value={activeProfile.endpoint.type}
                onChange={(event) => updateEndpoint("type", event.target.value as ProxyType)}
              >
                <option value="http">HTTP</option>
                <option value="socks5">SOCKS5</option>
                <option value="mtproto">MTProto</option>
              </select>
            </label>
            <div className="proxy-address-row">
              <label className="auth-field">
                <span>{translate("服务器")}</span>
                <input
                  required
                  value={activeProfile.endpoint.server}
                  onChange={(event) => updateEndpoint("server", event.target.value)}
                />
              </label>
              <label className="auth-field proxy-port">
                <span>{translate("端口")}</span>
                <input
                  required
                  type="number"
                  min={1}
                  max={65535}
                  value={activeProfile.endpoint.port}
                  onChange={(event) => updateEndpoint("port", Number(event.target.value))}
                />
              </label>
            </div>

            {activeProfile.endpoint.type === "mtproto" ? (
              <label className="auth-field">
                <span>Secret</span>
                <input
                  required
                  type="password"
                  autoComplete="off"
                  value={activeProfile.endpoint.secret}
                  onChange={(event) => updateEndpoint("secret", event.target.value)}
                />
              </label>
            ) : (
              <div className="proxy-address-row">
                <label className="auth-field">
                  <span>{translate("用户名")}</span>
                  <input
                    autoComplete="username"
                    value={activeProfile.endpoint.username}
                    onChange={(event) => updateEndpoint("username", event.target.value)}
                  />
                </label>
                <label className="auth-field">
                  <span>{translate("密码")}</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={activeProfile.endpoint.password}
                    onChange={(event) => updateEndpoint("password", event.target.value)}
                  />
                </label>
              </div>
            )}

            {activeProfile.endpoint.type === "http" ? (
              <label className="proxy-checkbox">
                <input
                  type="checkbox"
                  checked={activeProfile.endpoint.httpOnly}
                  onChange={(event) => updateEndpoint("httpOnly", event.target.checked)}
                />
                <span>{translate("仅 HTTP，不使用 CONNECT")}</span>
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="settings-inline-actions">
        <button
          className="dialog-secondary"
          type="button"
          disabled={busy || (settings.mode === "system" && !activeEndpoint)}
          onClick={onTest}
        >
          {pending ? <LoaderCircle className="spin" size={17} /> : <Gauge size={17} />}
          <span>{translate("测速")}</span>
        </button>
        {latency !== undefined ? (
          <span className="proxy-latency" role="status">{translate("延迟 {{value0}} ms", { value0: latency })}</span>
        ) : null}
      </div>
    </>
  );
}
