import { describe, expect, it } from "vitest";
import {
  formatDuration,
  estimateVideoFileSize,
  formatFileSize,
  calculateCropForAspectRatio,
  DEFAULT_CROP_RECT,
  DEFAULT_PHOTO_EDIT_STATE,
  COLOR_PALETTE,
  ASPECT_RATIO_VALUES,
} from "./mediaEditor";

describe("mediaEditor utilities (FG-007)", () => {
  describe("formatDuration", () => {
    it("formats zero and small durations in MM:SS format", () => {
      expect(formatDuration(0)).toBe("00:00");
      expect(formatDuration(9)).toBe("00:09");
      expect(formatDuration(65)).toBe("01:05");
      expect(formatDuration(599)).toBe("09:59");
    });

    it("formats hour-long durations in HH:MM:SS format", () => {
      expect(formatDuration(3600)).toBe("01:00:00");
      expect(formatDuration(3665)).toBe("01:01:05");
      expect(formatDuration(7325)).toBe("02:02:05");
    });

    it("handles negative or non-finite inputs gracefully", () => {
      expect(formatDuration(-5)).toBe("00:00");
      expect(formatDuration(NaN)).toBe("00:00");
      expect(formatDuration(Infinity)).toBe("00:00");
    });
  });

  describe("estimateVideoFileSize", () => {
    it("proportions file size based on trimmed duration vs original duration", () => {
      const originalSize = 10 * 1024 * 1024; // 10 MB
      const originalDuration = 60; // 60 seconds

      // Half duration -> ~half size
      expect(estimateVideoFileSize(originalSize, originalDuration, 30)).toBe(5 * 1024 * 1024);

      // Quarter duration -> ~quarter size
      expect(estimateVideoFileSize(originalSize, originalDuration, 15)).toBe(2621440);

      // Full duration -> same size
      expect(estimateVideoFileSize(originalSize, originalDuration, 60)).toBe(originalSize);
    });

    it("constrains bounds when duration is zero or negative", () => {
      expect(estimateVideoFileSize(5000, 0, 10)).toBe(5000);
      expect(estimateVideoFileSize(5000, 10, 0)).toBe(5000);
    });
  });

  describe("formatFileSize", () => {
    it("formats bytes, KB, MB, and GB", () => {
      expect(formatFileSize(0)).toBe("0 B");
      expect(formatFileSize(512)).toBe("512 B");
      expect(formatFileSize(2048)).toBe("2.0 KB");
      expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
      expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe("2.50 GB");
    });
  });

  describe("calculateCropForAspectRatio", () => {
    it("returns default crop for original preset", () => {
      const crop = calculateCropForAspectRatio("original", 1920, 1080);
      expect(crop).toEqual(DEFAULT_CROP_RECT);
    });

    it("preserves current crop for free preset", () => {
      const customCrop = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
      const crop = calculateCropForAspectRatio("free", 1920, 1080, customCrop);
      expect(crop).toEqual(customCrop);
    });

    it("calculates centered square crop for 1:1 on widescreen image", () => {
      const crop = calculateCropForAspectRatio("1:1", 1000, 500);
      expect(crop.width).toBeLessThanOrEqual(1);
      expect(crop.height).toBe(1);
      // Normalized width should be 500 / 1000 = 0.5
      expect(crop.width).toBeCloseTo(0.5, 2);
      expect(crop.x).toBeCloseTo(0.25, 2);
    });

    it("calculates centered crop for 16:9 on tall image", () => {
      const crop = calculateCropForAspectRatio("16:9", 500, 1000);
      expect(crop.width).toBe(1);
      expect(crop.height).toBeLessThan(1);
      expect(crop.y).toBeGreaterThan(0);
    });
  });

  describe("constants and defaults", () => {
    it("includes rich palette and valid aspect ratios", () => {
      expect(COLOR_PALETTE.length).toBeGreaterThanOrEqual(8);
      expect(ASPECT_RATIO_VALUES["1:1"]).toBe(1);
      expect(ASPECT_RATIO_VALUES["16:9"]).toBeCloseTo(1.777, 2);
      expect(DEFAULT_PHOTO_EDIT_STATE.rotation).toBe(0);
      expect(DEFAULT_PHOTO_EDIT_STATE.flipH).toBe(false);
      expect(DEFAULT_PHOTO_EDIT_STATE.drawings).toEqual([]);
      expect(DEFAULT_PHOTO_EDIT_STATE.texts).toEqual([]);
    });
  });
});
