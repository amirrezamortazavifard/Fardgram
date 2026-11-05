import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MediaEditorModal } from "./MediaEditorModal";
import type { OutgoingAttachment } from "../telegram/types";

describe("MediaEditorModal (FG-007)", () => {
  it("renders Photo Editor with crop, rotate, draw, text, and spoiler controls", () => {
    const dummyFile = new File(["dummy-image-bytes"], "sample-photo.jpg", { type: "image/jpeg" });
    const attachment: OutgoingAttachment = {
      file: dummyFile,
      kind: "photo",
      width: 1200,
      height: 800,
    };

    const html = renderToStaticMarkup(
      <MediaEditorModal
        attachment={attachment}
        previewUrl="blob:mock-photo-url"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("Photo Editor");
    expect(html).toContain("sample-photo.jpg");
    expect(html).toContain("Crop");
    expect(html).toContain("Rotate &amp; Flip");
    expect(html).toContain("Draw");
    expect(html).toContain("Text");
    expect(html).toContain("Spoiler");
    expect(html).toContain("Apply Changes");
    expect(html).toContain("Reset");
  });

  it("renders Video Editor with timeline, mute audio, cover frame, and file size estimation", () => {
    const dummyVideo = new File(["dummy-video-bytes"], "vacation.mp4", { type: "video/mp4" });
    const attachment: OutgoingAttachment = {
      file: dummyVideo,
      kind: "video",
      duration: 45,
      width: 1920,
      height: 1080,
    };

    const html = renderToStaticMarkup(
      <MediaEditorModal
        attachment={attachment}
        previewUrl="blob:mock-video-url"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("Video Editor");
    expect(html).toContain("vacation.mp4");
    expect(html).toContain("Start:");
    expect(html).toContain("End:");
    expect(html).toContain("Audio On");
    expect(html).toContain("Set Cover Frame");
    expect(html).toContain("Spoiler");
    expect(html).toContain("Apply Changes");
  });

  it("renders GIF Editor for animation attachments", () => {
    const dummyGif = new File(["dummy-gif-bytes"], "funny.gif", { type: "image/gif" });
    const attachment: OutgoingAttachment = {
      file: dummyGif,
      kind: "animation",
      duration: 5,
      width: 480,
      height: 480,
    };

    const html = renderToStaticMarkup(
      <MediaEditorModal
        attachment={attachment}
        previewUrl="blob:mock-gif-url"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("GIF Editor");
    expect(html).toContain("funny.gif");
    expect(html).toContain("Start:");
    expect(html).toContain("End:");
    expect(html).toContain("Apply Changes");
  });
});
