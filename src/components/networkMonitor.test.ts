import { describe, expect, it } from "vitest";

// Network calculation and formatting utilities
export function formatSpeed(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(2)} MB/s`;
  return `${kb.toFixed(0)} KB/s`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const TELEGRAM_DCS = [
  { id: 1, name: "DC1 (Pluto)", code: "DC1", location: "Miami, FL", country: "United States", flag: "🇺🇸", ip: "149.154.175.53", port: 443 },
  { id: 2, name: "DC2 (Venus)", code: "DC2", location: "Amsterdam", country: "Netherlands", flag: "🇳🇱", ip: "149.154.167.51", port: 443 },
  { id: 3, name: "DC3 (Aurora)", code: "DC3", location: "Miami, FL", country: "United States", flag: "🇺🇸", ip: "149.154.175.100", port: 443 },
  { id: 4, name: "DC4 (Vestia)", code: "DC4", location: "Amsterdam", country: "Netherlands", flag: "🇳🇱", ip: "149.154.167.91", port: 443, isPrimary: true },
  { id: 5, name: "DC5 (Flora)", code: "DC5", location: "Singapore", country: "Singapore", flag: "🇸🇬", ip: "91.108.56.130", port: 443 },
];

describe("Network Monitor Telemetry Engine", () => {
  it("formats bandwidth speeds correctly between KB/s and MB/s", () => {
    expect(formatSpeed(450)).toBe("450 KB/s");
    expect(formatSpeed(1024)).toBe("1.00 MB/s");
    expect(formatSpeed(3840)).toBe("3.75 MB/s");
    expect(formatSpeed(12500)).toBe("12.21 MB/s");
  });

  it("formats cumulative session transfer bytes correctly", () => {
    expect(formatBytes(512 * 1024)).toBe("512 KB");
    expect(formatBytes(48.5 * 1024 * 1024)).toBe("48.5 MB");
    expect(formatBytes(2.4 * 1024 * 1024 * 1024)).toBe("2.40 GB");
  });

  it("formats session uptime duration with zero-padded HH:MM:SS", () => {
    expect(formatDuration(45)).toBe("00:00:45");
    expect(formatDuration(125)).toBe("00:02:05");
    expect(formatDuration(3665)).toBe("01:01:05");
    expect(formatDuration(86400)).toBe("24:00:00");
  });

  it("contains all 5 Telegram global Data Centers with DC4 as primary hub", () => {
    expect(TELEGRAM_DCS).toHaveLength(5);
    const dc4 = TELEGRAM_DCS.find((dc) => dc.id === 4);
    expect(dc4).toBeDefined();
    expect(dc4?.isPrimary).toBe(true);
    expect(dc4?.location).toBe("Amsterdam");
    expect(dc4?.ip).toBe("149.154.167.91");
  });
});
