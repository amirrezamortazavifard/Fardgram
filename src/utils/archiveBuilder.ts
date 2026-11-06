import { deflateRaw } from "pako";

export interface ScannedArchiveFile {
  file: File;
  relativePath: string;
  size: number;
  lastModified: number;
}

export interface ScanDropResult {
  files: ScannedArchiveFile[];
  hasDirectory: boolean;
  suggestedArchiveName: string;
  totalSize: number;
}

export interface ZipProgress {
  currentFile: string;
  completedCount: number;
  totalCount: number;
  percent: number;
  stage: "scanning" | "compressing" | "assembling" | "done";
}

export interface BuildZipOptions {
  archiveName?: string;
  compression?: "deflate" | "store";
  includeHidden?: boolean;
  maxSizeBytes?: number;
  maxFileCount?: number;
  onProgress?: (progress: ZipProgress) => void;
  signal?: AbortSignal;
}

// 2 GB standard Telegram file limit
export const TELEGRAM_MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
export const ARCHIVE_MAX_FILE_COUNT = 20_000;

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Standard IEEE 802.3 CRC32 table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

export function calculateCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function dateToDos(date?: Date): { dosTime: number; dosDate: number } {
  const d = date && !isNaN(date.getTime()) ? date : new Date();
  const year = Math.max(1980, d.getFullYear());
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { dosTime, dosDate };
}

/**
 * Strictly sanitizes relative paths inside the archive to prevent directory traversal / zip slip.
 * Rejects or strips '..', replaces backslashes with '/', strips leading slashes.
 */
export function sanitizeRelativePath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== "string") {
    return "file";
  }

  // Normalize separators
  let normalized = rawPath.replace(/\\/g, "/").trim();

  // Strip leading slashes
  normalized = normalized.replace(/^\/+/, "");

  // Split and validate components
  const parts = normalized.split("/");
  const safeParts: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === ".") {
      continue;
    }
    if (trimmed === ".." || trimmed.includes("..")) {
      throw new Error(`Path traversal attempted in relative path: ${rawPath}`);
    }
    // Filter illegal Windows characters in segment
    const clean = trimmed.replace(/[:*?"<>|]/g, "_");
    if (clean) {
      safeParts.push(clean);
    }
  }

  if (safeParts.length === 0) {
    return "file";
  }

  return safeParts.join("/");
}

/**
 * Checks whether any component of a relative path represents a hidden or system internal file.
 */
export function isHiddenOrSystemFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/");

  for (const segment of segments) {
    const s = segment.trim();
    if (!s) continue;
    if (s.startsWith(".")) return true;
    const lower = s.toLowerCase();
    if (
      lower === "thumbs.db" ||
      lower === "desktop.ini" ||
      lower === "__macosx" ||
      lower.startsWith("._")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Traverses a FileSystemEntry recursively, handling Chromium's 100-batch readEntries limit.
 */
async function traverseFileSystemEntry(
  entry: any,
  basePath: string,
  out: ScannedArchiveFile[],
  includeHidden: boolean,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return;
  if (!entry) return;

  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file(resolve, reject);
    });

    const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    const safePath = sanitizeRelativePath(fullPath);

    if (!includeHidden && isHiddenOrSystemFile(safePath)) {
      return;
    }

    out.push({
      file,
      relativePath: safePath,
      size: file.size,
      lastModified: file.lastModified || Date.now(),
    });
  } else if (entry.isDirectory) {
    const dirPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    const safeDirPath = sanitizeRelativePath(dirPath);

    if (!includeHidden && isHiddenOrSystemFile(safeDirPath)) {
      return;
    }

    const dirReader = entry.createReader();

    // Read all entries in batches until readEntries returns []
    const readBatch = (): Promise<any[]> =>
      new Promise((resolve, reject) => {
        dirReader.readEntries(resolve, reject);
      });

    let batch = await readBatch();
    while (batch.length > 0) {
      if (signal?.aborted) return;
      for (const child of batch) {
        await traverseFileSystemEntry(child, dirPath, out, includeHidden, signal);
      }
      batch = await readBatch();
    }
  }
}

/**
 * Scans dropped items from a DragEvent.
 * Supports webkitGetAsEntry (directories and files) with fallback to dataTransfer.files.
 */
export async function scanDataTransfer(
  dataTransfer: DataTransfer,
  includeHidden = false,
  signal?: AbortSignal,
): Promise<ScanDropResult> {
  const items = dataTransfer.items;
  const files: ScannedArchiveFile[] = [];
  let hasDirectory = false;
  let firstDirName: string | undefined;

  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      if (signal?.aborted) break;
      const item = items[i];
      if (item.kind !== "file") continue;

      const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
      if (entry) {
        if (entry.isDirectory) {
          hasDirectory = true;
          if (!firstDirName) firstDirName = entry.name;
        }
        await traverseFileSystemEntry(entry, "", files, includeHidden, signal);
      } else {
        const file = item.getAsFile();
        if (file) {
          const safePath = sanitizeRelativePath(file.name);
          if (includeHidden || !isHiddenOrSystemFile(safePath)) {
            files.push({
              file,
              relativePath: safePath,
              size: file.size,
              lastModified: file.lastModified || Date.now(),
            });
          }
        }
      }
    }
  } else if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      const relPath = (file as any).webkitRelativePath || file.name;
      const safePath = sanitizeRelativePath(relPath);
      if (includeHidden || !isHiddenOrSystemFile(safePath)) {
        files.push({
          file,
          relativePath: safePath,
          size: file.size,
          lastModified: file.lastModified || Date.now(),
        });
      }
    }
  }

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const suggestedArchiveName = firstDirName
    ? `${firstDirName}.zip`
    : files.length === 1
      ? `${files[0].relativePath.replace(/\.[^/.]+$/, "")}.zip`
      : "archive.zip";

  return {
    files,
    hasDirectory,
    suggestedArchiveName,
    totalSize,
  };
}

/**
 * Builds a valid, standard PKZIP archive from the provided scanned files.
 * Employs DEFLATE compression (or Store) and streams progress updates.
 */
export async function buildZipArchive(
  files: ScannedArchiveFile[],
  options: BuildZipOptions = {},
): Promise<File> {
  const {
    archiveName = "archive.zip",
    compression = "deflate",
    includeHidden = false,
    maxSizeBytes = TELEGRAM_MAX_FILE_SIZE,
    maxFileCount = ARCHIVE_MAX_FILE_COUNT,
    onProgress,
    signal,
  } = options;

  if (signal?.aborted) {
    throw new DOMException("Archive generation aborted", "AbortError");
  }

  const eligibleFiles = includeHidden
    ? files
    : files.filter((f) => !isHiddenOrSystemFile(f.relativePath));

  if (eligibleFiles.length === 0) {
    throw new Error("No files selected to archive");
  }

  if (eligibleFiles.length > maxFileCount) {
    throw new Error(`File count exceeds maximum limit of ${maxFileCount}`);
  }

  const totalUncompressedSize = eligibleFiles.reduce((acc, f) => acc + f.size, 0);
  if (totalUncompressedSize > maxSizeBytes) {
    throw new Error(
      `Total uncompressed size (${Math.round(totalUncompressedSize / (1024 * 1024))} MB) exceeds maximum allowed size of ${Math.round(maxSizeBytes / (1024 * 1024))} MB`,
    );
  }

  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const cdChunks: Uint8Array[] = [];
  let localOffset = 0;

  const totalCount = eligibleFiles.length;

  for (let i = 0; i < totalCount; i++) {
    if (signal?.aborted) {
      throw new DOMException("Archive generation aborted", "AbortError");
    }

    const item = eligibleFiles[i];
    const safeName = sanitizeRelativePath(item.relativePath);
    const nameBytes = encoder.encode(safeName);

    onProgress?.({
      currentFile: safeName,
      completedCount: i,
      totalCount,
      percent: Math.round((i / totalCount) * 100),
      stage: "compressing",
    });

    // Read file bytes
    const arrayBuffer = await item.file.arrayBuffer();
    const rawData = new Uint8Array(arrayBuffer);
    const uncompressedSize = rawData.length;
    const crc = calculateCrc32(rawData);

    // Deflate or store
    let compressedData: Uint8Array;
    let method = 8; // Deflate
    if (compression === "store" || uncompressedSize === 0) {
      compressedData = rawData;
      method = 0;
    } else {
      compressedData = deflateRaw(rawData, { level: 6 });
      // If compressed size is larger than raw, fall back to stored
      if (compressedData.length >= uncompressedSize) {
        compressedData = rawData;
        method = 0;
      }
    }
    const compressedSize = compressedData.length;

    const { dosTime, dosDate } = dateToDos(new Date(item.lastModified));

    // Local Header (30 bytes + name length)
    const lh = new Uint8Array(30);
    const lhView = new DataView(lh.buffer);
    lhView.setUint32(0, 0x04034b50, true); // Local file header signature
    lhView.setUint16(4, 20, true); // Version needed to extract (2.0)
    lhView.setUint16(6, 0x0800, true); // Bit 11: UTF-8 filename encoding
    lhView.setUint16(8, method, true); // Compression method (8 = deflate, 0 = store)
    lhView.setUint16(10, dosTime, true);
    lhView.setUint16(12, dosDate, true);
    lhView.setUint32(14, crc, true);
    lhView.setUint32(18, compressedSize, true);
    lhView.setUint32(22, uncompressedSize, true);
    lhView.setUint16(26, nameBytes.length, true);
    lhView.setUint16(28, 0, true); // Extra field length

    localChunks.push(lh, nameBytes, compressedData);

    // Central Directory Header (46 bytes + name length)
    const cd = new Uint8Array(46);
    const cdView = new DataView(cd.buffer);
    cdView.setUint32(0, 0x02014b50, true); // Central directory header signature
    cdView.setUint16(4, 0x0314, true); // Version made by (UNIX 2.0)
    cdView.setUint16(6, 20, true); // Version needed to extract (2.0)
    cdView.setUint16(8, 0x0800, true); // UTF-8
    cdView.setUint16(10, method, true);
    cdView.setUint16(12, dosTime, true);
    cdView.setUint16(14, dosDate, true);
    cdView.setUint32(16, crc, true);
    cdView.setUint32(20, compressedSize, true);
    cdView.setUint32(24, uncompressedSize, true);
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint16(30, 0, true); // Extra field length
    cdView.setUint16(32, 0, true); // Comment length
    cdView.setUint16(34, 0, true); // Disk number start
    cdView.setUint16(36, 0, true); // Internal file attributes
    cdView.setUint32(38, 0x81a40000, true); // External file attributes (regular file 0644)
    cdView.setUint32(42, localOffset, true); // Relative offset of local header

    cdChunks.push(cd, nameBytes);

    localOffset += 30 + nameBytes.length + compressedSize;

    // Yield to the event loop every 5 items so the UI stays reactive
    if (i % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  onProgress?.({
    currentFile: "",
    completedCount: totalCount,
    totalCount,
    percent: 100,
    stage: "assembling",
  });

  const cdOffset = localOffset;
  let cdSize = 0;
  for (const chunk of cdChunks) {
    cdSize += chunk.length;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true); // Number of this disk
  eocdView.setUint16(6, 0, true); // Disk with central directory
  eocdView.setUint16(8, totalCount, true); // Number of entries on this disk
  eocdView.setUint16(10, totalCount, true); // Total entries
  eocdView.setUint32(12, cdSize, true); // Central directory size
  eocdView.setUint32(16, cdOffset, true); // Offset of start of central directory
  eocdView.setUint16(20, 0, true); // Comment length

  const allChunks: Uint8Array[] = [...localChunks, ...cdChunks, eocd];
  const zipBlob = new Blob(allChunks as BlobPart[], { type: "application/zip" });

  const finalName = archiveName.toLowerCase().endsWith(".zip")
    ? archiveName
    : `${archiveName}.zip`;

  onProgress?.({
    currentFile: "",
    completedCount: totalCount,
    totalCount,
    percent: 100,
    stage: "done",
  });

  return new File([zipBlob], finalName, {
    type: "application/zip",
    lastModified: Date.now(),
  });
}
