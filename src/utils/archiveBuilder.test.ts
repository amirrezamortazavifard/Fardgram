import { describe, expect, it, vi } from "vitest";
import { inflateRaw } from "pako";
import {
  calculateCrc32,
  dateToDos,
  sanitizeRelativePath,
  isHiddenOrSystemFile,
  buildZipArchive,
  type ScannedArchiveFile,
} from "./archiveBuilder";

describe("FG-021 Archive Builder Utilities", () => {
  describe("calculateCrc32", () => {
    it("computes accurate CRC32 for known byte vectors", () => {
      const empty = new Uint8Array(0);
      expect(calculateCrc32(empty)).toBe(0);

      const helloWorld = new TextEncoder().encode("hello world");
      expect(calculateCrc32(helloWorld)).toBe(222957957);

      const numbers = new Uint8Array([1, 2, 3, 4, 5]);
      expect(calculateCrc32(numbers)).toBeGreaterThan(0);
    });
  });

  describe("dateToDos", () => {
    it("converts Date to MS-DOS date and time bitfields", () => {
      const date = new Date(2025, 4, 15, 14, 30, 10);
      const { dosTime, dosDate } = dateToDos(date);
      expect(dosTime).toBeGreaterThan(0);
      expect(dosDate).toBeGreaterThan(0);

      // Fallback for invalid date
      const invalid = dateToDos(new Date(NaN));
      expect(invalid.dosDate).toBeGreaterThan(0);
    });
  });

  describe("sanitizeRelativePath", () => {
    it("normalizes path separators and trims whitespace", () => {
      expect(sanitizeRelativePath("folder\\sub\\file.txt")).toBe("folder/sub/file.txt");
      expect(sanitizeRelativePath(" /leading/slash/test.js ")).toBe("leading/slash/test.js");
      expect(sanitizeRelativePath("simple.png")).toBe("simple.png");
    });

    it("rejects path traversal attempts strictly", () => {
      expect(() => sanitizeRelativePath("../escape.txt")).toThrow("Path traversal");
      expect(() => sanitizeRelativePath("folder/../../escape.txt")).toThrow("Path traversal");
      expect(() => sanitizeRelativePath("folder/..")).toThrow("Path traversal");
    });

    it("sanitizes illegal file characters from components", () => {
      const sanitized = sanitizeRelativePath("folder/my:bad*file?.txt");
      expect(sanitized).toBe("folder/my_bad_file_.txt");
    });
  });

  describe("isHiddenOrSystemFile", () => {
    it("identifies dotfiles, thumbs.db, and desktop.ini", () => {
      expect(isHiddenOrSystemFile(".git/HEAD")).toBe(true);
      expect(isHiddenOrSystemFile("src/.env.local")).toBe(true);
      expect(isHiddenOrSystemFile(".DS_Store")).toBe(true);
      expect(isHiddenOrSystemFile("images/Thumbs.db")).toBe(true);
      expect(isHiddenOrSystemFile("sub/desktop.ini")).toBe(true);
      expect(isHiddenOrSystemFile("__MACOSX/._icon.png")).toBe(true);

      expect(isHiddenOrSystemFile("src/index.ts")).toBe(false);
      expect(isHiddenOrSystemFile("assets/photo.jpg")).toBe(false);
    });
  });

  describe("buildZipArchive", () => {
    function createMockFile(name: string, content: string, relativePath: string): ScannedArchiveFile {
      const blob = new Blob([content], { type: "text/plain" });
      const file = new File([blob], name, { type: "text/plain", lastModified: Date.now() });
      return {
        file,
        relativePath,
        size: blob.size,
        lastModified: file.lastModified,
      };
    }

    it("creates a valid zip archive with multiple files and directories", async () => {
      const files: ScannedArchiveFile[] = [
        createMockFile("hello.txt", "Hello World Content!", "docs/hello.txt"),
        createMockFile("readme.md", "# Readme Markdown", "readme.md"),
      ];

      const progressSteps: any[] = [];
      const zipFile = await buildZipArchive(files, {
        archiveName: "bundle.zip",
        onProgress: (p) => progressSteps.push({ ...p }),
      });

      expect(zipFile).toBeInstanceOf(File);
      expect(zipFile.name).toBe("bundle.zip");
      expect(zipFile.type).toBe("application/zip");
      expect(zipFile.size).toBeGreaterThan(0);
      expect(progressSteps.length).toBeGreaterThan(0);
      expect(progressSteps[progressSteps.length - 1].stage).toBe("done");

      // Verify the generated zip binary structure
      const buffer = await zipFile.arrayBuffer();
      const view = new DataView(buffer);
      // Signature of first local file header should be 0x04034b50
      expect(view.getUint32(0, true)).toBe(0x04034b50);
    });

    it("correctly decompresses data stored in the zip archive", async () => {
      const originalText = "Detailed test message to be compressed with DEFLATE!";
      const files: ScannedArchiveFile[] = [
        createMockFile("test.txt", originalText, "folder/test.txt"),
      ];

      const zipFile = await buildZipArchive(files, { archiveName: "test.zip" });
      const buffer = await zipFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Inspect local file header
      const view = new DataView(buffer);
      expect(view.getUint32(0, true)).toBe(0x04034b50); // Local header signature
      const method = view.getUint16(8, true);
      const compressedSize = view.getUint32(18, true);
      const uncompressedSize = view.getUint32(22, true);
      const nameLength = view.getUint16(26, true);
      const extraLength = view.getUint16(28, true);

      expect(uncompressedSize).toBe(new TextEncoder().encode(originalText).length);

      const dataOffset = 30 + nameLength + extraLength;
      const compressedBytes = bytes.slice(dataOffset, dataOffset + compressedSize);

      if (method === 8) {
        // Deflated
        const decompressed = inflateRaw(compressedBytes);
        const text = new TextDecoder().decode(decompressed);
        expect(text).toBe(originalText);
      } else {
        // Stored
        const text = new TextDecoder().decode(compressedBytes);
        expect(text).toBe(originalText);
      }
    });

    it("filters hidden files by default unless includeHidden is true", async () => {
      const files: ScannedArchiveFile[] = [
        createMockFile("normal.txt", "normal", "normal.txt"),
        createMockFile(".hidden.txt", "hidden", ".hidden.txt"),
      ];

      const zipWithoutHidden = await buildZipArchive(files, {
        archiveName: "without.zip",
        includeHidden: false,
      });

      const zipWithHidden = await buildZipArchive(files, {
        archiveName: "with.zip",
        includeHidden: true,
      });

      expect(zipWithoutHidden.size).toBeLessThan(zipWithHidden.size);
    });

    it("respects AbortSignal to cancel archive creation", async () => {
      const controller = new AbortController();
      controller.abort();

      const files: ScannedArchiveFile[] = [
        createMockFile("a.txt", "content", "a.txt"),
      ];

      await expect(
        buildZipArchive(files, { signal: controller.signal }),
      ).rejects.toThrow("Archive generation aborted");
    });

    it("rejects archives exceeding maximum size limits", async () => {
      const files: ScannedArchiveFile[] = [
        createMockFile("huge.dat", "small content", "huge.dat"),
      ];
      // Mock huge size on file
      Object.defineProperty(files[0], "size", { value: 3 * 1024 * 1024 * 1024 });

      await expect(
        buildZipArchive(files, { maxSizeBytes: 1000 }),
      ).rejects.toThrow("exceeds maximum allowed size");
    });
  });
});
