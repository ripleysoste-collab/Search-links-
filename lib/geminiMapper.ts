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

export async function mapStoredImageWithGemini(options: {
  key?: string;
  imageUrl: string;
  dataBase64?: string;
  mimeType?: string;
}): Promise<MappedImageMetadata> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Falta GEMINI_API_KEY en el servidor (agrégalo en Settings > Secrets o en las variables de Vercel).',
    );
  }

  let imageBase64 = '';
  let resolvedMimeType = 'image/webp';

  if (options.key && isValidMediaKey(options.key)) {
    const stored = await readImageFromR2(options.key);
    imageBase64 = stored.buffer.toString('base64');
    resolvedMimeType = stored.contentType || 'image/webp';
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
    throw new Error('Se requiere una imagen guardada válida para mapear.');
  }

  if (!imageBase64) {
    throw new Error('La imagen para mapear está vacía.');
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
    'Realiza una auditoría visual MILIMÉTRICA de esta imagen para un catálogo comercial conectado a un asesor de ventas.\n' +
    'Regla de oro: describe ÚNICAMENTE lo que se observa en los píxeles; nunca inventes precios, tallas impresas ni marcas ilegibles.\n\n' +
    'PASO 1 — "analisis_visual" (inspección física capa por capa antes de nombrar el producto):\n' +
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

  const MAX_GEMINI_ATTEMPTS = 4;

  const isTransientError = (msg: string): boolean => {
    const upper = msg.toUpperCase();
    return (
      upper.includes('503') ||
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
            'Eres un auditor visual y catalogador experto en e-commerce, gastronomía y retail. Primero inspeccionas y cuentas cada componente, capa, color, textura, geometría y proporción visual de forma milimétrica; luego redactas el nombre, categoría y descripción comercial exactamente fieles a esa auditoría. Nunca inventes precios, tallas impresas ni marcas no legibles. Responde exclusivamente JSON válido en español.',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MEDIUM,
          },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            propertyOrdering: [
              'analisis_visual',
              'nombre',
              'categoria',
              'descripcion',
            ],
            properties: {
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
            required: ['analisis_visual', 'nombre', 'categoria', 'descripcion'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as Partial<MappedImageMetadata>;

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
      const message =
        err instanceof Error ? err.message : 'Error al consultar Gemini';

      if (
        message.includes('API_KEY') ||
        message.includes('PERMISSION_DENIED') ||
        message.includes('403')
      ) {
        throw new Error(
          'La clave GEMINI_API_KEY fue rechazada o falta en Settings > Secrets.',
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
        throw new Error(
          'El servidor de Gemini tuvo saturación temporal (503) tras varios reintentos.',
        );
      }
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(
          'Se alcanzó el límite temporal gratuito de Gemini. Intenta en unos segundos.',
        );
      }
      throw new Error(`Error al mapear con Gemini: ${message.slice(0, 120)}`);
    }
  }

  throw new Error('No se pudo completar el mapeo con Gemini.');
}
