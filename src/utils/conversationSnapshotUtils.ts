type SnapshotMedia = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

export const cloneConversationSnapshot = (source: HTMLElement) => {
  const clone = source.cloneNode(true) as HTMLElement;
  // Disarm before insertion: even an inert video can start a second decoder.
  clone.querySelectorAll("video").forEach((video) => {
    video.autoplay = false;
    video.muted = true;
    video.preload = "none";
    video.removeAttribute("autoplay");
    video.removeAttribute("src");
    video.querySelectorAll("source").forEach((element) => element.remove());
  });
  return clone;
};

const freezeSnapshotMedia = (source: HTMLElement, clone: HTMLElement) => {
  const selector = "video";
  const sourceVideos = source.querySelectorAll<HTMLVideoElement>(selector);
  if (sourceVideos.length === 0) return;
  const viewport = source.getBoundingClientRect();
  const clones = clone.querySelectorAll<HTMLVideoElement>(selector);
  const frames = [...sourceVideos].map((media, index) => {
    const bounds = media.getBoundingClientRect();
    const style = getComputedStyle(media);
    return {
      media, cloneMedia: clones[index], bounds, width: style.width, height: style.height,
      objectFit: style.objectFit, opacity: style.opacity, visibility: style.visibility,
      borderRadius: style.borderRadius, display: style.display,
      layout: {
        position: style.position, top: style.top, right: style.right,
        bottom: style.bottom, left: style.left, margin: style.margin,
        maxWidth: style.maxWidth, maxHeight: style.maxHeight, minWidth: style.minWidth,
        minHeight: style.minHeight, verticalAlign: style.verticalAlign,
        alignSelf: style.alignSelf, gridArea: style.gridArea, transform: style.transform
      }
    };
  });
  for (const frame of frames) {
    const { media, cloneMedia, bounds } = frame;
    if (!cloneMedia) continue;
    const visible = bounds.width > 0 && bounds.height > 0 && bounds.bottom > viewport.top &&
      bounds.top < viewport.bottom && bounds.right > viewport.left && bounds.left < viewport.right &&
      frame.opacity !== "0" && frame.visibility !== "hidden";
    const width = media.videoWidth;
    const height = media.videoHeight;
    const loaded = media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    if (visible && loaded && width > 0 && height > 0) {
      const canvas = document.createElement("canvas");
      const scale = Math.min(devicePixelRatio || 1, 2,
        Math.sqrt(viewport.width * viewport.height * 4 / (bounds.width * bounds.height)));
      canvas.width = Math.max(1, Math.ceil(bounds.width * scale));
      canvas.height = Math.max(1, Math.ceil(bounds.height * scale));
      canvas.className = cloneMedia.className;
      canvas.dataset.snapshotMedia = "video";
      canvas.style.cssText = cloneMedia.style.cssText;
      Object.assign(canvas.style, frame.layout, {
        width: frame.width, height: frame.height,
        display: frame.display, opacity: frame.opacity, borderRadius: frame.borderRadius,
        transition: "none", animation: "none"
      });
      try {
        const context = canvas.getContext("2d");
        if (context) {
          const fit = frame.objectFit === "cover" ? Math.max : Math.min;
          const ratio = fit(canvas.width / width, canvas.height / height);
          const drawWidth = frame.objectFit === "fill" ? canvas.width : width * ratio;
          const drawHeight = frame.objectFit === "fill" ? canvas.height : height * ratio;
          context.drawImage(media, (canvas.width - drawWidth) / 2,
            (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
          cloneMedia.replaceWith(canvas);
          continue;
        }
      } catch {
        // Fallback
      }
    }
    cloneMedia.autoplay = false;
    cloneMedia.muted = true;
    cloneMedia.removeAttribute("autoplay");
    cloneMedia.removeAttribute("src");
    cloneMedia.querySelectorAll("source").forEach((element) => element.remove());
    cloneMedia.load();
  }
};
/**
 * Keeps a cloned virtual list aligned even when its images have not decoded yet.
 * Virtuoso's content height is otherwise smaller at capture time and clamps the
 * copied scrollTop, exposing the wrong part of the old conversation.
 */
export const prepareConversationSnapshotClone = (
  source: HTMLElement,
  clone: HTMLElement,
  options?: { scrollTop?: number },
) => {
  const content = clone.querySelector<HTMLElement>(".message-list-content");
  if (content) {
    const sourceContent = source.querySelector<HTMLElement>(".message-list-content");
    // The live list uses an auto top margin at the bottom of short histories.
    // Once the clone is given a reserved height, that auto margin can expand
    // and move a long snapshot before scrollTop is applied. Long lists should
    // start at zero; short histories retain their live computed margin.
    if (sourceContent) {
      const sourceMarginTop = getComputedStyle(sourceContent).marginTop;
      const sourceScrollHeight = source.scrollHeight;
      const sourceIsScrollable = sourceScrollHeight > source.clientHeight + 1;
      content.style.marginTop = sourceIsScrollable
        ? "0px"
        : sourceMarginTop;
      content.style.minHeight = `${Math.max(sourceScrollHeight, content.getBoundingClientRect().height)}px`;
      if (sourceContent && sourceIsScrollable) {
        // Re-apply after reserving the height: auto margins can be resolved
        // again during that layout pass in Chromium.
        content.style.marginTop = "0px";
      }
    } else {
      content.style.minHeight = `${Math.max(source.scrollHeight, content.getBoundingClientRect().height)}px`;
    }
  }
  clone.scrollTop = options?.scrollTop ?? source.scrollTop;
  clone.scrollLeft = source.scrollLeft;

  // Keep a visual fallback for unusual layouts that still clamp the position
  // after the first measurement. Normally the reserved height makes this zero.
  const desiredScrollTop = options?.scrollTop ?? source.scrollTop;
  if (content && Math.abs(clone.scrollTop - desiredScrollTop) > 0.5) {
    const delta = desiredScrollTop - clone.scrollTop;
    const transform = content.style.transform;
    content.style.transform = `${transform && transform !== "none" ? `${transform} ` : ""}translateY(${delta}px)`;
  }

  freezeSnapshotMedia(source, clone);
};
