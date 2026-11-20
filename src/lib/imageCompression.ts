import { getApiBaseUrl, resolveApiUrl } from './apiConfig';
import { getSupabaseAccessToken } from './supabaseClient';

export interface CompressedImageResult {
  blob: Blob;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
  savedPercent: number;
}

export interface UploadedCompressedImage extends CompressedImageResult {
  key: string;
  url: string;
}

const MAX_EDGE_PX = 1600;
const PRIMARY_WEBP_QUALITY = 0.8;
const SECONDARY_WEBP_QUALITY = 0.68;

async function decodeImageSource(
  source: Blob,
): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(source);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall back to HTMLImageElement decoding
    }
  }

  const objectUrl = URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      el.src = objectUrl;
    });

    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

export async function renderImageBlobFromUrl(
  imageUrl: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const tryFetchBlob = async (targetUrl: string): Promise<Blob> => {
    const response = await fetch(targetUrl, {
      mode: 'cors',
      signal,
    });
    if (!response.ok) {
      throw new Error(`No se pudo renderizar la imagen (${response.status}).`);
    }
    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      throw new Error('La imagen descargada está vacía.');
    }
    return blob;
  };

  let blob: Blob;
  const isAlreadyProxied = imageUrl.startsWith('/api/image-proxy');
  const isRemoteHttp = /^https?:\/\//i.test(imageUrl);

  if (isAlreadyProxied || !isRemoteHttp) {
    blob = await tryFetchBlob(resolveApiUrl(imageUrl));
  } else {
    try {
      blob = await tryFetchBlob(imageUrl);
    } catch (err) {
      if (signal?.aborted) throw err;
      blob = await tryFetchBlob(
        resolveApiUrl(`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`),
      );
    }
  }

  // Verify the downloaded bytes actually decode/render as a valid image
  const decoded = await decodeImageSource(blob);
  decoded.cleanup();
  return blob;
}

export async function compressImageToWebp(
  source: Blob,
): Promise<CompressedImageResult> {
  const originalBytes = source.size;
  const decoded = await decodeImageSource(source);

  try {
    const srcW = Math.max(1, decoded.width);
    const srcH = Math.max(1, decoded.height);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(srcW, srcH));
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo inicializar el motor gráfico de compresión.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    decoded.draw(ctx, targetW, targetH);

    // Encode to WebP (modern smallest lossless-like perceptual format)
    let bestBlob = await canvasToBlob(canvas, 'image/webp', PRIMARY_WEBP_QUALITY);
    let chosenMime = 'image/webp';
    let chosenExt = 'webp';

    // Fallback to JPEG only if the browser does not support WebP encoding
    if (!bestBlob || bestBlob.type !== 'image/webp') {
      bestBlob = await canvasToBlob(canvas, 'image/jpeg', 0.82);
      chosenMime = 'image/jpeg';
      chosenExt = 'jpg';
    } else if (
      bestBlob.size > Math.max(220 * 1024, originalBytes * 0.35)
    ) {
      // Adaptive second pass if still larger than expected while preserving sharpness
      const smallerBlob = await canvasToBlob(
        canvas,
        'image/webp',
        SECONDARY_WEBP_QUALITY,
      );
      if (smallerBlob && smallerBlob.size < bestBlob.size) {
        bestBlob = smallerBlob;
      }
    }

    if (!bestBlob) {
      throw new Error('No se pudo comprimir la imagen.');
    }

    // If an already tiny WebP became larger after re-encode, keep original bytes
    const shouldKeepOriginal =
      source.type === 'image/webp' &&
      scale === 1 &&
      originalBytes <= bestBlob.size &&
      originalBytes <= 3.5 * 1024 * 1024;

    const finalBlob: Blob = shouldKeepOriginal ? source : bestBlob;
    const finalMime = shouldKeepOriginal ? 'image/webp' : chosenMime;
    const finalExt = shouldKeepOriginal ? 'webp' : chosenExt;
    const compressedBytes = finalBlob.size;

    const savedPercent =
      originalBytes > 0
        ? Math.max(
            0,
            Math.min(
              99,
              Math.round(((originalBytes - compressedBytes) / originalBytes) * 100),
            ),
          )
        : 0;

    return {
      blob: finalBlob,
      mimeType: finalMime,
      extension: finalExt,
      width: targetW,
      height: targetH,
      originalBytes,
      compressedBytes,
      savedPercent,
    };
  } finally {
    decoded.cleanup();
  }
}

const MAX_JSON_RAW_BYTES = 2.9 * 1024 * 1024;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer la imagen comprimida.'));
      }
    };
    reader.onerror = () => reject(new Error('No se pudo preparar la imagen para subir.'));
    reader.readAsDataURL(blob);
  });
}

export type UploadFolderPrefix = 'catalog' | 'org-logos';

export async function uploadCompressedImage(
  compressed: CompressedImageResult,
  signal?: AbortSignal,
  folder: UploadFolderPrefix = 'catalog',
): Promise<UploadedCompressedImage> {
  const accessToken = await getSupabaseAccessToken();
  const authHeaders: Record<string, string> = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};
  const useJsonPayload = compressed.blob.size <= MAX_JSON_RAW_BYTES;
  const uploadEndpoint = resolveApiUrl('/api/upload');
  const response = useJsonPayload
    ? await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
          'X-Upload-Folder': folder,
        },
        body: JSON.stringify({
          folder,
          mimeType: compressed.mimeType,
          dataBase64: await blobToDataUrl(compressed.blob),
        }),
        signal,
      })
    : await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': compressed.mimeType,
          'X-Upload-Folder': folder,
        },
        body: compressed.blob,
        signal,
      });

  const rawBody = await response.text();
  let payload: {
    key?: string;
    url?: string;
    sizeBytes?: number;
    error?: string;
  } = {};

  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    payload = {};
  }

  if (!response.ok || !payload.key || !payload.url) {
    throw new Error(
      payload.error ||
        `Error HTTP ${response.status} al guardar la imagen en la nube.`,
    );
  }

  const mediaOrigin = getApiBaseUrl() || window.location.origin;
  const absoluteUrl = payload.url.startsWith('/')
    ? `${mediaOrigin}${payload.url}`
    : payload.url;

  return {
    ...compressed,
    key: payload.key,
    url: absoluteUrl,
    compressedBytes: payload.sizeBytes ?? compressed.compressedBytes,
  };
}

export async function compressAndUploadOrgLogo(
  file: File,
  signal?: AbortSignal,
): Promise<UploadedCompressedImage> {
  const compressed = await compressImageToWebp(file);
  return uploadCompressedImage(compressed, signal, 'org-logos');
}

export interface VisualInspectionDetails {
  cantidad_productos_visibles: number;
  conteo_detallado: string;
  colores: string[];
  forma_y_estructura: string;
  materiales_y_texturas: string[];
  tamano_minimo_estimado: string;
  micro_detalles: string;
}

export interface MappedImageMetadata {
  nombre: string;
  categoria: string;
  descripcion: string;
  analisis_visual?: VisualInspectionDetails;
  url: string;
}

export async function mapUploadedImageWithAi(
  input: { key?: string; imageUrl: string },
  signal?: AbortSignal,
): Promise<MappedImageMetadata> {
  const accessToken = await getSupabaseAccessToken();
  const response = await fetch(resolveApiUrl('/api/map-image'), {
    method: 'POST',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: input.key,
      imageUrl: input.imageUrl,
    }),
    signal,
  });

  const rawBody = await response.text();
  let payload: Partial<MappedImageMetadata> & { error?: string } = {};

  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    payload = {};
  }

  if (
    !response.ok ||
    !payload.nombre ||
    !payload.categoria ||
    !payload.descripcion
  ) {
    throw new Error(
      payload.error ||
        `Error HTTP ${response.status} al renderizar y mapear con IA.`,
    );
  }

  return {
    nombre: payload.nombre,
    categoria: payload.categoria,
    descripcion: payload.descripcion,
    ...(payload.analisis_visual
      ? { analisis_visual: payload.analisis_visual }
      : {}),
    url: payload.url || input.imageUrl,
  };
}
