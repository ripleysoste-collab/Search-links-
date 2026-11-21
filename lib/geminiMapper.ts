import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { isValidMediaKey, readImageFromR2 } from './r2Storage.ts';

export const GEMINI_MAPPER_MODEL = 'gemini-3.1-flash-lite';

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

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const promptText =
    'Realiza una auditoría de SEGURIDAD y una auditoría visual MILIMÉTRICA de esta imagen para un catálogo comercial conectado a un asesor de ventas.\n' +
    'Regla de oro: evalúa únicamente lo que muestran los píxeles; nunca inventes precios, tallas impresas ni marcas ilegibles.\n\n' +
    'PASO 0 — "moderacion" (CONTROL DE POLÍTICAS ANTES DE CATALOGAR):\n' +
    '  Evalúa con precisión quirúrgica la intención real de la escena (en inglés y español):\n' +
    '  • BLOQUEO INMEDIATO ("aprobada": false):\n' +
    '    - "extreme" ("severidad": "extreme"): child sexual abuse/exploitation (CSAM), explicit pornography, sexual acts or exposed genitalia (actos sexuales, sexo explícito, acceso carnal), sexual violence, dead bodies/corpses (personas muertas), real gore/mutilation, active lethal violence with firearms or bladed weapons (violencia real con armas de fuego o armas blancas, heridas sangrientas), suicide or self-harm.\n' +
    '    - "moderate" ("severidad": "moderate"): explicit non-commercial nudity (senos, glúteos o genitales descubiertos sin contexto comercial válido), escenas sangrientas o amenazas violentas explícitas con armas.\n' +
    '  • CATÁLOGOS COMERCIALES PERMITIDOS ("aprobada": true, NUNCA confundir ni bloquear por error):\n' +
    '    - Lencería, ropa interior, trajes de baño o bikinis en maniquí o modelo comercial (si NO hay genitales expuestos, NO hay actos sexuales ni pornografía).\n' +
    '    - Cuchillos de cocina, utensilios culinarios, navajas de camping, herramientas o réplicas/artículos comerciales neutros de catálogo (si NO hay sangre, heridas, cadáveres ni violencia contra personas o animales).\n' +
    '  Si "aprobada" es false, redacta "motivo_usuario" en español claro, breve y respetuoso explicando por qué infringe nuestras políticas (sin detalles morbosos).\n\n' +
    'PASO 1 — "analisis_visual" (solo si "aprobada": true; inspección física capa por capa):\n' +
    '  • "cantidad_productos_visibles": Entero exacto de unidades o artículos principales visibles (ej. 2 si hay un par de tenis o hamburguesa + papas; 1 si es una unidad única).\n' +
    '  • "conteo_detallado": Inventario numerado y exacto de CADA parte o capa visible (de arriba a abajo o de exterior a interior):\n' +
    '    - En alimentos/bebidas: tipo de pan o base, semillas, número exacto de carnes/proteínas, láminas de queso, tiras de tocineta, rodajas de tomate, hojas verdes, aros, salsas y acompañamientos.\n' +
    '    - En calzado/moda: si es par o unidad, corte (bajo/medio/alto), cantidad de ojales visibles por lado, cordones/cierres, lengüeta, puntera, talonera, entresuela y suela.\n' +
    '    - En otros productos: cuerpo principal, botones, tapas, asas, conectores y accesorios visibles.\n' +
    '  • "colores": Lista precisa de tonos, matices y acabados (ej. "blanco óptico", "blanco hueso", "gris perla mate", "amarillo cheddar fundido").\n' +
    '  • "forma_y_estructura": Geometría, silueta, horma o ensamblaje: proporciones, grosor de suela o altura de capas, costuras, ángulos y acabado superficial.\n' +
    '  • "materiales_y_texturas": Lista exacta de materiales, tejidos, superficies o ingredientes visibles y su textura.\n' +
    '  • "tamano_minimo_estimado": Deducción visual del tamaño mínimo aproximado comparando proporciones entre elementos visibles (ej. diámetro y altura mínimos estimados en cm o porción en alimentos; altura de suela/plataforma en cm y horma adulto/infantil en calzado). Aclara siempre que es estimación visual.\n' +
    '  • "micro_detalles": Detalles finos reales: patrón de suela, perforaciones, tipo de puntada, semillas, marcas de plancha/parrilla, texto o logotipo solo si es 100% legible.\n\n' +
    'PASO 2 — Síntesis comercial basada exactamente en el PASO 1:\n' +
    '  • "nombre": Nombre comercial específico, completo y atractivo (nunca genérico).\n' +
    '  • "categoria": "Categoría · Subcategoría" precisa (ej. "Calzado · Tenis urbanos", "Alimentos · Hamburguesas").\n' +
    '  • "descripcion": 3 a 4 oraciones densas, claras y sin relleno repetitivo en español que integren colores, estructura, conteo exacto de elementos/ingredientes, materiales y tamaño mínimo estimado para responder dudas de clientes al instante.';

  const MAX_GEMINI_ATTEMPTS =
    typeof options.maxAttempts === 'number' && options.maxAttempts >= 1
      ? Math.min(6, Math.trunc(options.maxAttempts))
      : 4;

  const isTransientError = (msg: string): boolean => {
    const upper = msg.toUpperCase();
    return (
      upper.includes('503') ||
      upper.includes('502') ||
      upper.includes('504') ||
      upper.includes('UNAVAILABLE') ||
      upper.includes('OVERLOADED') ||
      upper.includes('HIGH DEMAND') ||
      upper.includes('429') ||
      upper.includes('RESOURCE_EXHAUSTED') ||
      upper.includes('DEADLINE_EXCEEDED') ||
      upper.includes('ETIMEDOUT') ||
      upper.includes('ECONNRESET') ||
      upper.includes('FETCH FAILED')
    );
  };

  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MAPPER_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: resolvedMimeType,
                data: imageBase64,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          systemInstruction:
            'Eres un auditor de seguridad comercial y catalogador experto en e-commerce, gastronomía y retail. Antes de catalogar, verificas que la imagen no contenga desnudez explícita, actos sexuales, abuso, cadáveres, heridas reales ni violencia con armas o armas blancas, sin confundir nunca lencería comercial, trajes de baño o cuchillos de cocina/catálogo limpio. Luego inspeccionas y cuentas cada componente, capa, color, textura, geometría y proporción visual de forma milimétrica y redactas el nombre, categoría y descripción comercial. Responde exclusivamente JSON válido en español.',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
          responseMimeType: 'application/json',
          responseSchema: {
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
                description:
                  'Verificación previa de seguridad y políticas de contenido antes de catalogar.',
                propertyOrdering: [
                  'aprobada',
                  'severidad',
                  'categoria',
                  'motivo_usuario',
                ],
                properties: {
                  aprobada: {
                    type: Type.BOOLEAN,
                    description:
                      'true si es segura o un producto comercial válido (incluida ropa interior o cuchillos de cocina sin violencia); false si infringe políticas de desnudez explícita, actos sexuales o violencia real.',
                  },
                  severidad: {
                    type: Type.STRING,
                    description:
                      'none si aprobada=true; extreme si hay actos sexuales, CSAM, cadáveres, gore o violencia real con armas; moderate en infracciones menores.',
                  },
                  categoria: {
                    type: Type.STRING,
                    description:
                      'safe, nudity_sexual, violence_gore, self_harm o illegal_harm.',
                  },
                  motivo_usuario: {
                    type: Type.STRING,
                    description:
                      'Explicación clara y respetuosa en español para el usuario cuando aprobada es false; cadena vacía si aprobada es true.',
                  },
                },
                required: ['aprobada', 'severidad', 'categoria', 'motivo_usuario'],
              },
              analisis_visual: {
                type: Type.OBJECT,
                description:
                  'Auditoría visual milimétrica del producto, conteo exacto de piezas/capas y escala proporcional.',
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
                  cantidad_productos_visibles: {
                    type: Type.INTEGER,
                    description:
                      'Cantidad exacta de unidades o productos principales visibles en la imagen.',
                  },
                  conteo_detallado: {
                    type: Type.STRING,
                    description:
                      'Conteo e inventario minucioso de cada elemento, capa, ingrediente, ojal o pieza visible.',
                  },
                  colores: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description:
                      'Lista exacta de colores, matices y acabados visibles.',
                  },
                  forma_y_estructura: {
                    type: Type.STRING,
                    description:
                      'Silueta, figura, geometría, ensamblaje y estructura/construcción física.',
                  },
                  materiales_y_texturas: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description:
                      'Materiales, ingredientes o texturas visibles en superficie y capas.',
                  },
                  tamano_minimo_estimado: {
                    type: Type.STRING,
                    description:
                      'Estimación visual del tamaño mínimo, volumen o porción deducida por proporción.',
                  },
                  micro_detalles: {
                    type: Type.STRING,
                    description:
                      'Microdetalles visibles: costuras, perforaciones, sellado, cierres o marcas legibles.',
                  },
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
              nombre: {
                type: Type.STRING,
                description:
                  'Nombre comercial específico, descriptivo y preciso del producto en español.',
              },
              categoria: {
                type: Type.STRING,
                description:
                  'Categoría y subcategoría comercial precisa en español.',
              },
              descripcion: {
                type: Type.STRING,
                description:
                  'Descripción comercial de 3 a 4 oraciones concisas con colores, estructura, conteo exacto de piezas/ingredientes, materiales y tamaño mínimo estimado.',
              },
            },
            required: [
              'moderacion',
              'analisis_visual',
              'nombre',
              'categoria',
              'descripcion',
            ],
          },
        },
      });

      const candidate = response.candidates?.[0];
      const finishReason = String(candidate?.finishReason || '').toUpperCase();
      const blockReason = String(
        response.promptFeedback?.blockReason || '',
      ).toUpperCase();
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

      if (
        message.includes('API_KEY') ||
        message.includes('PERMISSION_DENIED') ||
        message.includes('403')
      ) {
        throw new GeminiMapError(
          'La clave GEMINI_API_KEY fue rechazada o falta en el servidor.',
          'auth',
        );
      }

      const transient = isTransientError(message);
      if (transient && attempt < MAX_GEMINI_ATTEMPTS) {
        const baseDelay = attempt === 1 ? 950 : attempt === 2 ? 2200 : 4200;
        const jitter = Math.floor(Math.random() * 400);
        await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
        continue;
      }

      if (message.includes('503') || message.toUpperCase().includes('UNAVAILABLE')) {
        throw new GeminiMapError(
          'El servidor de Gemini tuvo saturación temporal (503).',
          'transient',
        );
      }
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        throw new GeminiMapError(
          'Se alcanzó el límite temporal de Gemini (429).',
          'transient',
        );
      }
      if (transient) {
        throw new GeminiMapError(
          `Saturación o corte temporal al consultar Gemini: ${message.slice(0, 100)}`,
          'transient',
        );
      }
      throw new GeminiMapError(`Error al mapear con Gemini: ${message.slice(0, 120)}`, 'fatal');
    }
  }

  throw new GeminiMapError('No se pudo completar el mapeo con Gemini.', 'transient');
}
