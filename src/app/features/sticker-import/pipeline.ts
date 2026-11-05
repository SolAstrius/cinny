import { MatrixClient } from 'matrix-js-sdk';
import { unzip, unzipSync, Unzipped } from 'fflate';
import { mxcUrlToHttp } from '../../utils/matrix';
import {
  addImagesToRoomPack,
  addImagesToUserPack,
  createRoomPack,
  ImageUsage,
  makePackGlobal,
  newRoomPackStateKey,
  NewPackImage,
  PackAddress,
  PackImage,
  slugifyShortcode,
} from '../../plugins/custom-emoji';

export const MAX_ZIP_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGES = 200;
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_EDGE = 512;
const UPLOAD_CONCURRENCY = 3;

export type ImageKind = 'png' | 'apng' | 'gif' | 'webp' | 'jpeg';

export type DetectedImage = {
  kind: ImageKind;
  mimetype: string;
  ext: string;
  animated: boolean;
};

/* eslint-disable no-bitwise -- magic byte and chunk parsing */
const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));

const u32be = (b: Uint8Array, p: number): number =>
  ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;

/** APNG = a PNG with an acTL chunk before the first IDAT. */
const pngIsAnimated = (b: Uint8Array): boolean => {
  let p = 8;
  while (p + 8 <= b.length) {
    const len = u32be(b, p);
    const type = ascii(b, p + 4, 4);
    if (type === 'acTL') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    p += 12 + len;
  }
  return false;
};

/** Walk GIF blocks and count image descriptors; more than one frame means animated. */
const gifIsAnimated = (b: Uint8Array): boolean => {
  const skipSubBlocks = (start: number): number => {
    let p = start;
    while (p < b.length) {
      const size = b[p];
      p += 1;
      if (size === 0) break;
      p += size;
    }
    return p;
  };
  let p = 13;
  const flags = b[10];
  if (flags & 0x80) p += 3 * (1 << ((flags & 7) + 1));
  let frames = 0;
  while (p < b.length) {
    const block = b[p];
    if (block === 0x2c) {
      frames += 1;
      if (frames > 1) return true;
      const localFlags = b[p + 9];
      p += 10;
      if (localFlags & 0x80) p += 3 * (1 << ((localFlags & 7) + 1));
      p = skipSubBlocks(p + 1);
    } else if (block === 0x21) {
      p = skipSubBlocks(p + 2);
    } else {
      break;
    }
  }
  return false;
};

/** VP8X header flag 0x02 marks an animated WebP. */
const webpIsAnimated = (b: Uint8Array): boolean =>
  ascii(b, 12, 4) === 'VP8X' && (b[20] & 0x02) !== 0;

/* eslint-enable no-bitwise */

/** Identify an image by its magic bytes; file names and extensions are not trusted. */
export const detectImage = (b: Uint8Array): DetectedImage | undefined => {
  if (b.length < 16) return undefined;
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    const animated = pngIsAnimated(b);
    return { kind: animated ? 'apng' : 'png', mimetype: 'image/png', ext: 'png', animated };
  }
  const head6 = ascii(b, 0, 6);
  if (head6 === 'GIF87a' || head6 === 'GIF89a') {
    return { kind: 'gif', mimetype: 'image/gif', ext: 'gif', animated: gifIsAnimated(b) };
  }
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    return { kind: 'webp', mimetype: 'image/webp', ext: 'webp', animated: webpIsAnimated(b) };
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { kind: 'jpeg', mimetype: 'image/jpeg', ext: 'jpg', animated: false };
  }
  return undefined;
};

export type ImportCandidate = {
  id: string;
  sourceName: string;
  defaultShortcode: string;
  body?: string;
  blob: Blob;
  detected: DetectedImage;
  width: number;
  height: number;
};

export type CollectResult = {
  candidates: ImportCandidate[];
  skipped: number;
  truncated: boolean;
  manifestName?: string;
};

type ManifestEntry = { shortcode?: string; body?: string };
type Manifest = { name?: string; entries: Map<string, ManifestEntry> };

const MANIFEST_NAMES = ['pack.json', 'manifest.json', 'stickers.json', 'meta.json'];

const baseName = (name: string): string => name.split('/').pop() ?? name;
const stem = (name: string): string => baseName(name).replace(/\.[a-z0-9]{1,5}$/i, '');

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/**
 * Best effort manifest reader. Accepts `{name, stickers: [{file, shortcode, emoji}]}`-like
 * arrays and `{images: {key: {...}}}`-like maps; anything else is ignored.
 */
const parseManifest = (data: Uint8Array): Manifest | undefined => {
  let json: any;
  try {
    json = JSON.parse(new TextDecoder().decode(data));
  } catch {
    return undefined;
  }
  if (!json || typeof json !== 'object') return undefined;
  const name =
    str(json.display_name) ?? str(json.name) ?? str(json.title) ?? str(json.pack?.display_name);
  const entries = new Map<string, ManifestEntry>();
  const add = (key: string | undefined, item: any, fallbackShortcode?: string) => {
    if (!key) return;
    const emoji = Array.isArray(item?.emojis) ? item.emojis.join('') : str(item?.emoji);
    entries.set(stem(key).toLowerCase(), {
      shortcode: str(item?.shortcode) ?? str(item?.name) ?? fallbackShortcode,
      body: str(item?.body) ?? str(item?.description) ?? emoji,
    });
  };
  const list = json.stickers ?? json.images ?? json.emojis ?? json.emotes ?? json.items;
  if (Array.isArray(list)) {
    list.forEach((item) => {
      if (typeof item === 'string') return;
      add(str(item?.file) ?? str(item?.filename) ?? str(item?.image) ?? str(item?.path), item);
    });
  } else if (list && typeof list === 'object') {
    Object.entries(list).forEach(([key, item]: [string, any]) => {
      const file = str(item?.file) ?? str(item?.filename) ?? str(item?.path);
      add(file ?? key, item, file ? key : undefined);
    });
  }
  return { name, entries };
};

const isJunkPath = (name: string): boolean =>
  name.endsWith('/') || name.split('/').some((part) => part.startsWith('.') || part === '__MACOSX');

const naturalCompare = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const imageSize = async (blob: Blob): Promise<{ width: number; height: number }> => {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: 0, height: 0 };
  }
};

/** Turn named byte blobs (zip entries or picked files) into import candidates. */
export const collectCandidates = async (
  files: { name: string; data: Uint8Array }[]
): Promise<CollectResult> => {
  const usable = files.filter((f) => !isJunkPath(f.name));
  const manifestFile = usable.find((f) => MANIFEST_NAMES.includes(baseName(f.name).toLowerCase()));
  const manifest = manifestFile ? parseManifest(manifestFile.data) : undefined;

  const images: { name: string; data: Uint8Array; detected: DetectedImage }[] = [];
  let skipped = 0;
  usable
    .filter((f) => f !== manifestFile)
    .sort((a, b) => naturalCompare(a.name, b.name))
    .forEach((f) => {
      const detected = detectImage(f.data);
      if (!detected) skipped += 1;
      else images.push({ ...f, detected });
    });
  skipped += files.length - usable.length;

  const truncated = images.length > MAX_IMAGES;
  const taken = new Set<string>();
  const candidates = await Promise.all(
    images.slice(0, MAX_IMAGES).map(async (img, index) => {
      const entry = manifest?.entries.get(stem(img.name).toLowerCase());
      const fileStem = stem(img.name);
      const meaningless = !fileStem || /^[\d_\-\s]+$/.test(fileStem);
      let shortcode = slugifyShortcode(
        entry?.shortcode ?? (meaningless ? `sticker-${index + 1}` : fileStem),
        `sticker-${index + 1}`
      );
      if (taken.has(shortcode)) shortcode = `${shortcode}-${index + 1}`;
      taken.add(shortcode);
      const blob = new Blob([img.data], { type: img.detected.mimetype });
      const { width, height } = await imageSize(blob);
      const candidate: ImportCandidate = {
        id: `${index}:${img.name}`,
        sourceName: img.name,
        defaultShortcode: shortcode,
        body: entry?.body,
        blob,
        detected: img.detected,
        width,
        height,
      };
      return candidate;
    })
  );

  return { candidates, skipped, truncated, manifestName: manifest?.name };
};

export const isZipBytes = (b: Uint8Array): boolean =>
  b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05);

/** Unzip without decompressing junk, oversized entries or more files than we could use. */
export const readZip = async (data: Uint8Array): Promise<{ name: string; data: Uint8Array }[]> => {
  let kept = 0;
  const filter = (file: { name: string; originalSize: number }) => {
    if (isJunkPath(file.name) || file.originalSize > MAX_ENTRY_BYTES) return false;
    if (kept >= MAX_IMAGES * 2) return false;
    kept += 1;
    return true;
  };
  const unzipped = await new Promise<Unzipped>((resolve, reject) => {
    try {
      unzip(data, { filter }, (err, result) => (err ? reject(err) : resolve(result)));
    } catch (e) {
      reject(e);
    }
  }).catch(() => {
    kept = 0;
    return unzipSync(data, { filter });
  });
  return Object.entries(unzipped).map(([name, bytes]) => ({ name, data: bytes }));
};

/** Read a mix of picked files: zips are expanded, everything else is taken as is. */
export const readLocalFiles = async (
  files: File[]
): Promise<{ name: string; data: Uint8Array }[]> => {
  const groups = await Promise.all(
    files.map(async (file) => {
      const data = new Uint8Array(await file.arrayBuffer());
      if (isZipBytes(data)) {
        const entries = await readZip(data);
        return files.length > 1
          ? entries.map((e) => ({ ...e, name: `${stem(file.name)}/${e.name}` }))
          : entries;
      }
      return [{ name: file.name, data }];
    })
  );
  return groups.flat();
};

/** Download media with the access token explicitly, so it works without the service worker. */
export const downloadMxc = async (
  mx: MatrixClient,
  mxc: string,
  useAuthentication: boolean,
  onProgress?: (loaded: number, total: number) => void
): Promise<Uint8Array> => {
  const url = mxcUrlToHttp(mx, mxc, useAuthentication);
  if (!url) throw new Error('Invalid media url');
  const token = mx.getAccessToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const total = Number(res.headers.get('content-length') ?? 0);
  if (total > MAX_ZIP_BYTES) throw new Error('File is larger than 50 MB');
  if (!res.body) return new Uint8Array(await res.arrayBuffer());

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (loaded > MAX_ZIP_BYTES) {
      reader.cancel();
      throw new Error('File is larger than 50 MB');
    }
    onProgress?.(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, offset);
    offset += chunk.length;
  });
  return out;
};

export type PreparedImage = {
  blob: Blob;
  mimetype: string;
  ext: string;
  w: number;
  h: number;
  resized: boolean;
};

export const needsResize = (c: ImportCandidate): boolean =>
  !c.detected.animated && Math.max(c.width, c.height) > MAX_EDGE;

export const targetSize = (c: ImportCandidate): { w: number; h: number } => {
  if (!needsResize(c)) return { w: c.width, h: c.height };
  const scale = MAX_EDGE / Math.max(c.width, c.height);
  return {
    w: Math.max(1, Math.round(c.width * scale)),
    h: Math.max(1, Math.round(c.height * scale)),
  };
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

/** Downscale stills to 512 px on the long edge (alpha kept); animated images stay untouched. */
export const prepareImage = async (c: ImportCandidate): Promise<PreparedImage> => {
  const { detected } = c;
  if (!needsResize(c)) {
    return {
      blob: c.blob,
      mimetype: detected.mimetype,
      ext: detected.ext,
      w: c.width,
      h: c.height,
      resized: false,
    };
  }
  const { w, h } = targetSize(c);
  const bitmap = await createImageBitmap(c.blob);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // PNG stays PNG; WebP and JPEG become WebP where the browser can encode it.
  const wantWebp = detected.kind === 'webp' || detected.kind === 'jpeg';
  let blob = wantWebp ? await canvasToBlob(canvas, 'image/webp', 0.9) : null;
  if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/png');
  if (!blob) throw new Error('Could not encode the resized image');
  const webp = blob.type === 'image/webp';
  return {
    blob,
    mimetype: blob.type,
    ext: webp ? 'webp' : 'png',
    w,
    h,
    resized: true,
  };
};

export type ImportDestination =
  | { kind: 'user' }
  | { kind: 'new-room-pack'; roomId: string }
  | { kind: 'room-pack'; address: PackAddress };

export type ImportPlan = {
  destination: ImportDestination;
  packName: string;
  usage: ImageUsage[];
  useEverywhere: boolean;
};

export type ImportItem = {
  candidate: ImportCandidate;
  shortcode: string;
};

export type ItemStatus =
  | { state: 'waiting' }
  | { state: 'uploading'; progress: number }
  | { state: 'done'; url: string }
  | { state: 'error'; message: string };

export type ImportResult = {
  written: number;
  failed: number;
  address?: PackAddress;
};

const errorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Unknown error';
};

const runPool = async <T>(items: T[], limit: number, task: (item: T) => Promise<void>) => {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      // eslint-disable-next-line no-await-in-loop
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

/** detect → resize → upload → write. Nothing is written if every upload fails. */
export const importPack = async (
  mx: MatrixClient,
  plan: ImportPlan,
  items: ImportItem[],
  onStatus: (id: string, status: ItemStatus) => void
): Promise<ImportResult> => {
  const uploaded: (NewPackImage | undefined)[] = new Array(items.length);
  const indexed = items.map((item, index) => ({ item, index }));
  let failed = 0;

  await runPool(indexed, UPLOAD_CONCURRENCY, async ({ item, index }) => {
    const { candidate, shortcode } = item;
    onStatus(candidate.id, { state: 'uploading', progress: 0 });
    try {
      const prepared = await prepareImage(candidate);
      const res = await mx.uploadContent(prepared.blob, {
        name: `${shortcode}.${prepared.ext}`,
        type: prepared.mimetype,
        includeFilename: true,
        progressHandler: ({ loaded, total }) =>
          onStatus(candidate.id, { state: 'uploading', progress: total ? loaded / total : 0 }),
      });
      const image: PackImage = {
        url: res.content_uri,
        body: candidate.body ?? shortcode,
        info: {
          w: prepared.w,
          h: prepared.h,
          mimetype: prepared.mimetype,
          size: prepared.blob.size,
        },
      };
      uploaded[index] = { shortcode, image };
      onStatus(candidate.id, { state: 'done', url: res.content_uri });
    } catch (e) {
      failed += 1;
      onStatus(candidate.id, { state: 'error', message: errorMessage(e) });
    }
  });

  const additions = uploaded.filter((a): a is NewPackImage => !!a);
  if (additions.length === 0) {
    throw new Error('Every upload failed, nothing was saved.');
  }
  const withUsage = additions.map((a) => ({ ...a, image: { ...a.image, usage: plan.usage } }));

  const { destination } = plan;
  if (destination.kind === 'user') {
    await addImagesToUserPack(mx, withUsage);
    return { written: additions.length, failed };
  }

  let address: PackAddress;
  if (destination.kind === 'new-room-pack') {
    const stateKey = newRoomPackStateKey(mx, destination.roomId, plan.packName);
    address = new PackAddress(destination.roomId, stateKey);
    await createRoomPack(mx, destination.roomId, stateKey, plan.packName, plan.usage, additions);
  } else {
    address = destination.address;
    await addImagesToRoomPack(mx, address, withUsage);
  }
  if (plan.useEverywhere) await makePackGlobal(mx, address);
  return { written: additions.length, failed, address };
};
