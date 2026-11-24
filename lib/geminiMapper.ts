import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { isValidMediaKey, readImageFromR2 } from './r2Storage.ts';

export const GEMINI_MAPPER_MODEL = 'gemini-4-hydrogen';
export const GEMINI_MAPPER_FALLBACK_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
] as const;

const DEPRECATED_GEMINI_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
]);

const GEMINI_REQUEST_TIMEOUT_MS = 45_000;

let cachedAiClient: GoogleGenAI | null = null;
let cachedAiApiKey = '';

function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!cachedAiClient || cachedAiApiKey !== apiKey) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedAiApiKey = apiKey;
  }
  return cachedAiClient;
}

function resolveCandidateModels(): string[] {
  const customModel = (process.env.GEMINI_MODEL || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();

  if (customModel && !DEPRECATED_GEMINI_MODELS.has(customModel.toLowerCase())) {
    return [
      customModel,
      ...GEMINI_MAPPER_FALLBACK_MODELS.filter((m) => m !== customModel),
    ];
  }

  return [...GEMINI_MAPPER_FALLBACK_MODELS];
}

function getThinkingConfigForModel(model: string) {
  if (model === 'gemini-3.1-flash-lite') {
    return { thinkingLevel: ThinkingLevel.MINIMAL };
  }
  if (model.startsWith('gemini-4-') || model.startsWith('gemini-3.')) {
    return { thinkingLevel: ThinkingLevel.LOW };
  }
  return undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`DEADLINE_EXCEEDED: ${label} superó ${Math.round(ms / 1000)}s`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
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

function getGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

function sanitizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const clean = entry.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export type GeminiErrorKind = 'transient' | 'fatal' | 'auth' | 'policy';
export type PolicySeverity = 'moderate' | 'extreme';

interface GeminiModerationResult {
  aprobada?: boolean;
  severidad?: 'none' | 'moderate' | 'extreme';
  categoria?: string;
  motivo_usuario?: string;
}

export class GeminiMapError extends Error {
  readonly kind: GeminiErrorKind;
  readonly policySeverity?: PolicySeverity;
  readonly policyCategory?: string;

  constructor(
    message: string,
    kind: GeminiErrorKind,
    options?: {
      policySeverity?: PolicySeverity;
      policyCategory?: string;
    },
  ) {
    super(message);
    this.name = 'GeminiMapError';
    this.kind = kind;
    this.policySeverity = options?.policySeverity;
    this.policyCategory = options?.policyCategory;
  }
}

const SAFETY_BLOCK_REASONS = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'IMAGE_SAFETY',
  'SEXUALLY_EXPLICIT',
  'DANGEROUS_CONTENT',
  'HATE_SPEECH',
  'HARASSMENT',
  'BLOCKLIST',
  'SPII',
]);

const MAPPER_PROMPT_TEXT =
  'Audita SEGURIDAD y detalle visual milimétrico para catálogo e-commerce sin inventar precios, tallas ni marcas ilegibles.\n\n' +
  'PASO 0 ("moderacion"):\n' +
  '- BLOQUEAR ("aprobada": false):\n' +
  '  • "extreme": CSAM, pornografía/actos sexuales o genitales expuestos, violencia sexual, cadáveres, gore/mutilación, violencia letal activa con armas, suicidio o autolesión.\n' +
  '  • "moderate": desnudez explícita sin contexto comercial válido (senos/glúteos/genitales descubiertos), sangre o amenazas violentas con armas.\n' +
  '- PERMITIR ("aprobada": true): lencería, ropa interior o trajes de baño comerciales sin desnudez explícita ni actos sexuales; cuchillos de cocina o herramientas de catálogo limpio sin sangre ni violencia.\n' +
  '- Si aprobada=false, indica motivo_usuario breve y respetuoso en español.\n\n' +
  'PASO 1 ("analisis_visual", solo si aprobada=true):\n' +
  '- cantidad_productos_visibles: entero exacto de unidades visibles.\n' +
  '- conteo_detallado: inventario numerado de cada capa, pieza o ingrediente visible (arriba-abajo o exterior-interior).\n' +
  '- colores: tonos, matices y acabados exactos.\n' +
  '- forma_y_estructura: silueta, geometría, proporciones, grosor/altura y ensamblaje.\n' +
  '- materiales_y_texturas: materiales, tejidos, superficies o ingredientes.\n' +
  '- tamano_minimo_estimado: tamaño/porción mínima aproximada por proporción visual (aclarando que es estimación visual).\n' +
  '- micro_detalles: costuras, perforaciones, patrón de suela, semillas o texto/logo solo si es 100% legible.\n\n' +
  'PASO 2 (Síntesis comercial basada en PASO 1):\n' +
  '- nombre: nombre comercial específico y claro.\n' +
  '- categoria: "Categoría · Subcategoría" precisa.\n' +
  '- descripcion: 3 a 4 oraciones concisas en español integrando colores, estructura, conteo exacto, materiales y tamaño estimado.';

const MAPPER_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  propertyOrdering: [
    'moderacion',
    'analisis_visual',
    'nombre',
    'categoria',
    'descripcion',
  ],
  properties: {
    moderacion: {
      type: Type.OBJECT,
      propertyOrdering: ['aprobada', 'severidad', 'categoria', 'motivo_usuario'],
      properties: {
        aprobada: { type: Type.BOOLEAN },
        severidad: { type: Type.STRING },
        categoria: { type: Type.STRING },
        motivo_usuario: { type: Type.STRING },
      },
      required: ['aprobada', 'severidad', 'categoria', 'motivo_usuario'],
    },
    analisis_visual: {
      type: Type.OBJECT,
      propertyOrdering: [
        'cantidad_productos_visibles',
        'conteo_detallado',
        'colores',
        'forma_y_estructura',
        'materiales_y_texturas',
        'tamano_minimo_estimado',
        'micro_detalles',
      ],
      properties: {
        cantidad_productos_visibles: { type: Type.INTEGER },
        conteo_detallado: { type: Type.STRING },
        colores: { type: Type.ARRAY, items: { type: Type.STRING } },
        forma_y_estructura: { type: Type.STRING },
        materiales_y_texturas: { type: Type.ARRAY, items: { type: Type.STRING } },
        tamano_minimo_estimado: { type: Type.STRING },
        micro_detalles: { type: Type.STRING },
      },
      required: [
        'cantidad_productos_visibles',
        'conteo_detallado',
        'colores',
        'forma_y_estructura',
        'materiales_y_texturas',
        'tamano_minimo_estimado',
        'micro_detalles',
      ],
    },
    nombre: { type: Type.STRING },
    categoria: { type: Type.STRING },
    descripcion: { type: Type.STRING },
  },
  required: ['moderacion', 'analisis_visual', 'nombre', 'categoria', 'descripcion'],
};

function isAuthErrorMessage(msg: string): boolean {
  const upper = msg.toUpperCase();
  return (
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API_KEY') ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('403')
  );
}

function isModelNotFoundMessage(msg: string): boolean {
  const upper = msg.toUpperCase();
  return upper.includes('NOT_FOUND') || upper.includes('404');
}

function isTransientGeminiError(msg: string): boolean {
  const upper = msg.toUpperCase();
  return (
    upper.includes('503') ||
    upper.includes('502') ||
    upper.includes('504') ||
    upper.includes('500') ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('OVERLOADED') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('CAPACITY') ||
    upper.includes('429') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('DEADLINE_EXCEEDED') ||
    upper.includes('ETIMEDOUT') ||
    upper.includes('ECONNRESET') ||
    upper.includes('FETCH FAILED')
  );
}

export async function mapStoredImageWithGemini(options: {
  key?: string;
  imageUrl: string;
  dataBase64?: string;
  mimeType?: string;
  maxAttempts?: number;
}): Promise<MappedImageMetadata> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiMapError(
      'Falta GEMINI_API_KEY en el servidor (agrégalo en las variables de entorno de Render).',
      'auth',
    );
  }

  let imageBase64 = '';
  let resolvedMimeType = 'image/webp';

  if (options.key && isValidMediaKey(options.key)) {
    try {
      const stored = await readImageFromR2(options.key);
      imageBase64 = stored.buffer.toString('base64');
      resolvedMimeType = stored.contentType || 'image/webp';
    } catch (err) {
      throw new GeminiMapError(
        err instanceof Error ? err.message : 'No se pudo leer la imagen desde R2.',
        'fatal',
      );
    }
  } else if (options.dataBase64) {
    const trimmed = options.dataBase64.trim();
    const commaIdx = trimmed.indexOf(',');
    imageBase64 =
      trimmed.startsWith('data:') && commaIdx !== -1
        ? trimmed.slice(commaIdx + 1)
        : trimmed;
    if (options.mimeType && options.mimeType.startsWith('image/')) {
      resolvedMimeType = options.mimeType;
    }
  } else {
    throw new GeminiMapError('Se requiere una imagen guardada válida para mapear.', 'fatal');
  }

  if (!imageBase64) {
    throw new GeminiMapError('La imagen para mapear está vacía.', 'fatal');
  }

  const ai = getGeminiClient(apiKey);
  const candidateModels = resolveCandidateModels();
  const maxAttempts =
    typeof options.maxAttempts === 'number' && options.maxAttempts >= 1
      ? Math.min(6, Math.max(candidateModels.length, Math.trunc(options.maxAttempts)))
      : 4;

  const attemptedModels: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const model = candidateModels[(attempt - 1) % candidateModels.length];
    if (!attemptedModels.includes(model)) {
      attemptedModels.push(model);
    }

    const thinkingConfig = getThinkingConfigForModel(model);

    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: resolvedMimeType,
                  data: imageBase64,
                },
              },
              { text: MAPPER_PROMPT_TEXT },
            ],
          },
          config: {
            systemInstruction:
              'Eres un auditor de seguridad comercial y catalogador experto en e-commerce. Verificas que no exista desnudez explícita, abuso, gore o violencia real (sin bloquear lencería o utensilios comerciales limpios), cuentas cada capa/pieza/color/textura visible y respondes exclusivamente JSON válido en español.',
            ...(thinkingConfig ? { thinkingConfig } : {}),
            responseMimeType: 'application/json',
            responseSchema: MAPPER_RESPONSE_SCHEMA,
          },
        }),
        GEMINI_REQUEST_TIMEOUT_MS,
        model,
      );

      const candidate = response.candidates?.[0];
      const finishReason = String(candidate?.finishReason || '').toUpperCase();
      const blockReason = String(
        response.promptFeedback?.blockReason || '',
      ).toUpperCase();
      if (
        SAFETY_BLOCK_REASONS.has(finishReason) ||
        SAFETY_BLOCK_REASONS.has(blockReason)
      ) {
        throw new GeminiMapError(
          'Esta imagen contiene desnudez explícita, contenido sexual o violencia grave e infringe nuestras políticas de seguridad.',
          'policy',
          {
            policySeverity: 'extreme',
            policyCategory: 'native_safety_block',
          },
        );
      }

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as Partial<MappedImageMetadata> & {
        moderacion?: GeminiModerationResult;
      };

      if (parsed.moderacion && parsed.moderacion.aprobada === false) {
        const policySeverity: PolicySeverity =
          parsed.moderacion.severidad === 'extreme' ? 'extreme' : 'moderate';
        const policyCategory = sanitizeString(
          parsed.moderacion.categoria,
          'policy_violation',
        );
        const motivoUsuario = sanitizeString(
          parsed.moderacion.motivo_usuario,
          'Esta imagen infringe nuestras políticas de seguridad (desnudez explícita, actos sexuales o violencia) y fue rechazada.',
        );
        throw new GeminiMapError(motivoUsuario, 'policy', {
          policySeverity,
          policyCategory,
        });
      }

      const nombre = sanitizeString(parsed.nombre, 'Producto catalogado');
      const categoria = sanitizeString(parsed.categoria, 'General');

      const rawVisual = parsed.analisis_visual;
      let analisisVisual: VisualInspectionDetails | undefined;

      if (rawVisual && typeof rawVisual === 'object') {
        const count =
          typeof rawVisual.cantidad_productos_visibles === 'number' &&
          Number.isFinite(rawVisual.cantidad_productos_visibles)
            ? Math.max(1, Math.trunc(rawVisual.cantidad_productos_visibles))
            : 1;
        const conteoDetallado = sanitizeString(
          rawVisual.conteo_detallado,
          '1 unidad principal visible.',
        );
        const colores = sanitizeStringArray(rawVisual.colores);
        const formaYEstructura = sanitizeString(
          rawVisual.forma_y_estructura,
          'Estructura estándar acorde a la categoría.',
        );
        const materialesYTexturas = sanitizeStringArray(
          rawVisual.materiales_y_texturas,
        );
        const tamanoMinimoEstimado = sanitizeString(
          rawVisual.tamano_minimo_estimado,
          'Estimación visual estándar según proporción del encuadre.',
        );
        const microDetalles = sanitizeString(
          rawVisual.micro_detalles,
          'Sin microdetalles adicionales legibles.',
        );

        analisisVisual = {
          cantidad_productos_visibles: count,
          conteo_detallado: conteoDetallado,
          colores,
          forma_y_estructura: formaYEstructura,
          materiales_y_texturas: materialesYTexturas,
          tamano_minimo_estimado: tamanoMinimoEstimado,
          micro_detalles: microDetalles,
        };
      }

      const fallbackDescription = analisisVisual
        ? `${nombre}. ${analisisVisual.forma_y_estructura} ${analisisVisual.conteo_detallado} ${analisisVisual.tamano_minimo_estimado}`
        : 'Imagen procesada con inspección visual y lista para responder consultas de clientes.';
      const descripcion = sanitizeString(parsed.descripcion, fallbackDescription);

      return {
        nombre,
        categoria,
        descripcion,
        ...(analisisVisual ? { analisis_visual: analisisVisual } : {}),
        url: options.imageUrl,
      };
    } catch (err) {
      if (err instanceof GeminiMapError) {
        throw err;
      }

      const message =
        err instanceof Error ? err.message : 'Error al consultar Gemini';

      if (isAuthErrorMessage(message)) {
        throw new GeminiMapError(
          'La clave GEMINI_API_KEY fue rechazada o no tiene permisos en el servidor.',
          'auth',
        );
      }

      const nextModel = candidateModels[attempt % candidateModels.length];
      const switchingModel = nextModel !== model;
      const modelMissing = isModelNotFoundMessage(message);
      const transient = isTransientGeminiError(message);

      if ((transient || modelMissing) && attempt < maxAttempts) {
        // Immediate failover when switching to a different model capacity pool; brief backoff on same model
        const baseDelay = switchingModel
          ? 350
          : attempt === 1
            ? 900
            : attempt === 2
              ? 2000
              : 3600;
        const jitter = Math.floor(Math.random() * 250);
        await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
        continue;
      }

      const modelsNote =
        attemptedModels.length > 0 ? ` (${attemptedModels.join(' -> ')})` : '';

      if (message.includes('503') || message.toUpperCase().includes('UNAVAILABLE')) {
        throw new GeminiMapError(
          `Saturación temporal 503 en Gemini tras probar${modelsNote}.`,
          'transient',
        );
      }
      if (message.includes('429') || message.toUpperCase().includes('RESOURCE_EXHAUSTED')) {
        throw new GeminiMapError(
          `Se alcanzó el límite temporal de Gemini (429)${modelsNote}.`,
          'transient',
        );
      }
      if (transient) {
        throw new GeminiMapError(
          `Corte o saturación temporal en Gemini${modelsNote}: ${message.slice(0, 100)}`,
          'transient',
        );
      }
      throw new GeminiMapError(`Error al mapear con Gemini: ${message.slice(0, 120)}`, 'fatal');
    }
  }

  throw new GeminiMapError('No se pudo completar el mapeo con Gemini.', 'transient');
}
