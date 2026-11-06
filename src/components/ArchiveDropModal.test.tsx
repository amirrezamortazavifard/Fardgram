import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArchiveDropModal } from "./ArchiveDropModal";
import type { ScannedArchiveFile } from "../utils/archiveBuilder";

describe("FG-021 ArchiveDropModal Component", () => {
  function makeMockFile(name: string, path: string, size = 1024): ScannedArchiveFile {
    const blob = new Blob(["test-data"], { type: "text/plain" });
    const file = new File([blob], name, { type: "text/plain" });
    return {
      file,
      relativePath: path,
      size,
      lastModified: Date.now(),
    };
  }

  it("renders modal with file list, archive name, and actions in English", () => {
    const mockFiles: ScannedArchiveFile[] = [
      makeMockFile("app.ts", "src/app.ts", 2048),
      makeMockFile("logo.png", "assets/logo.png", 4096),
    ];

    const html = renderToStaticMarkup(
      <ArchiveDropModal
        isOpen={true}
        files={mockFiles}
        defaultArchiveName="MyProject.zip"
        hasDirectory={true}
        onClose={vi.fn()}
        onSendArchive={vi.fn()}
        onSendSeparateFiles={vi.fn()}
      />,
    );

    // Verify key English texts
    expect(html).toContain("Send Folder or Archive");
    expect(html).toContain("2 files");
    expect(html).toContain("uncompressed");
    expect(html).toContain("Archive Name");
    expect(html).toContain("src/app.ts");
    expect(html).toContain("assets/logo.png");
    expect(html).toContain("Compress &amp; Send Archive");
    expect(html).toContain("Send Separately");
    expect(html).toContain("Cancel");

    // Dual-theme styles check
    expect(html).toContain("dark:bg-[#0c101a]");
    expect(html).toContain("dark:text-white");
  });

  it("renders single file set title when no directory was dropped", () => {
    const mockFiles: ScannedArchiveFile[] = [
      makeMockFile("document.pdf", "document.pdf", 1024),
    ];

    const html = renderToStaticMarkup(
      <ArchiveDropModal
        isOpen={true}
        files={mockFiles}
        defaultArchiveName="archive.zip"
        hasDirectory={false}
        onClose={vi.fn()}
        onSendArchive={vi.fn()}
        onSendSeparateFiles={vi.fn()}
      />,
    );

    expect(html).toContain("Send Files as Archive");
    expect(html).toContain("1 file");
  });

  it("returns null when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <ArchiveDropModal
        isOpen={false}
        files={[]}
        onClose={vi.fn()}
        onSendArchive={vi.fn()}
        onSendSeparateFiles={vi.fn()}
      />,
    );

    expect(html).toBe("");
  });
});
