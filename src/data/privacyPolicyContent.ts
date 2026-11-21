import type { SupportedLocale } from '../lib/i18n';

export interface PrivacyPolicyInventoryRow {
  category: string;
  collectedData: string;
  processor: string;
  retention: string;
}

export interface PrivacyPolicySection {
  id: string;
  number: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  table?: {
    headers: [string, string, string, string];
    rows: PrivacyPolicyInventoryRow[];
  };
}

export interface PrivacyPolicyDocument {
  documentTitle: string;
  documentCategory: string;
  effectiveLabel: string;
  effectiveDate: string;
  versionLabel: string;
  version: string;
  appliesToLabel: string;
  appliesTo: string;
  backLabel: string;
  tocHeading: string;
  mobileTocToggleLabel: string;
  leadSummary: string;
  sections: PrivacyPolicySection[];
  footerNote: string;
}

export const PRIVACY_POLICY_CONTENT: Record<SupportedLocale, PrivacyPolicyDocument> = {
  es: {
    documentTitle: 'Políticas de privacidad y uso',
    documentCategory: 'Documentación legal y de ingeniería de privacidad',
    effectiveLabel: 'Última actualización',
    effectiveDate: '21 de noviembre de 2026',
    versionLabel: 'Versión',
    version: '1.0',
    appliesToLabel: 'Ámbito',
    appliesTo: 'Search Link Web, Search Link Core API y Search Link IA',
    backLabel: 'Cerrar',
    tocHeading: 'Contenido del documento',
    mobileTocToggleLabel: 'Índice de secciones',
    leadSummary:
      'Este documento describe de forma técnica y jurídica cómo Search Link recopila, procesa, almacena, protege y elimina la información personal, operativa y multimedia de los usuarios que acceden a nuestra aplicación web, a las herramientas de extracción y catalogación automatizada, a los endpoints Search Link Core y al asistente conversacional Search Link IA.',
    sections: [
      {
        id: 'identidad-y-alcance',
        number: '01',
        title: 'Identidad del responsable y alcance operativo',
        paragraphs: [
          'Search Link opera una plataforma de infraestructura para la ingesta, normalización multimedia, clasificación semántica y consulta conversacional de catálogos de productos y servicios. Las presentes Políticas de privacidad y uso rigen el tratamiento de datos personales y activos digitales dentro de la interfaz web pública, los paneles autenticados de Organización y Mi tienda, la cola de procesamiento en segundo plano y las interfaces de programación Search Link Core.',
          'El uso de la plataforma implica la lectura y aceptación de estas disposiciones. Cuando un usuario actúa en nombre de una empresa, comercio u organización, declara contar con la representación necesaria para incorporar URLs, fotografías, nombres comerciales, descripciones e inventario dentro del entorno de Search Link y autoriza su tratamiento conforme a los flujos técnicos aquí detallados.',
        ],
      },
      {
        id: 'datos-que-recopilamos',
        number: '02',
        title: 'Información que solicitamos y datos que recopilamos',
        paragraphs: [
          'Search Link aplica el principio de minimización de datos: únicamente solicita o deriva la información estrictamente indispensable para autenticar sesiones, aislar entornos por organización, procesar activos visuales, emitir credenciales criptográficas y prevenir el abuso automatizado de la infraestructura.',
          'Dependiendo de si interactúas como visitante no autenticado o como titular de una cuenta registrada, recopilamos las siguientes categorías de datos:',
        ],
        bullets: [
          'Datos de identidad y autenticación (Google OAuth vía Supabase Auth): identificador único de usuario (UUID), dirección de correo electrónico verificada, nombre completo visible en tu perfil de Google, URL de fotografía de avatar y marcas temporales de creación e inicio de sesión. Search Link no solicita ni almacena contraseñas bancarias, documentos nacionales de identidad ni contraseñas directas de Google.',
          'Datos de Organización y Mi tienda: nombre comercial de la organización, logotipo institucional (almacenado en formato optimizado dentro de nuestro almacenamiento de objetos cuando decides subirlo), nombres asignados a tus servicios o catálogos, identificadores públicos únicos (slugs), estado de activación del servicio y metadatos estructurados del catálogo (nombre de producto, categoría, descripción, atributos detectados y enlaces de referencia).',
          'Credenciales de acceso a Search Link Core: al generar o rotar una clave API con prefijo slk_, la clave completa se muestra una única vez al titular en la sesión del navegador. En la base de datos persistimos únicamente un hash criptográfico unidireccional SHA-256 junto con un prefijo abreviado de identificación visual; nunca conservamos la clave secreta en texto plano.',
          'Entradas de URLs y archivos multimedia aportados por el usuario: direcciones web pegadas en el extractor público o autenticado, archivos de imagen cargados desde el dispositivo local, dimensiones, peso en bytes y proporción de compresión WebP resultante.',
          'Datos técnicos de red, cuota y localización lingüística: dirección IP de origen (tratada de forma transitoria para limitación de frecuencia, prevención de fraude y selección inicial de idioma por país), encabezados técnicos HTTP estándar (User-Agent, idioma del navegador) y cookies firmadas de estado de cuota.',
        ],
      },
      {
        id: 'inventario-de-datos',
        number: '03',
        title: 'Inventario técnico de almacenamiento y retención',
        paragraphs: [
          'La siguiente tabla resume cada categoría de información tratada por Search Link, la infraestructura donde reside y los plazos operativos de conservación:',
        ],
        table: {
          headers: ['Categoría de dato', 'Elementos específicos', 'Infraestructura / Encargado', 'Retención operativa'],
          rows: [
            {
              category: 'Cuenta de usuario',
              collectedData: 'UUID, correo electrónico, nombre, avatar OAuth',
              processor: 'Supabase Auth (PostgreSQL)',
              retention: 'Mientras la cuenta permanezca activa o hasta solicitud de baja',
            },
            {
              category: 'Organización y servicios',
              collectedData: 'Nombre, logotipo, slug, hash SHA-256 de API Key y catálogo',
              processor: 'Supabase PostgreSQL y Cloudflare R2 (logotipo)',
              retention: 'Hasta eliminación del servicio o supresión de la cuenta',
            },
            {
              category: 'Imágenes del catálogo',
              collectedData: 'Archivos WebP optimizados y URLs públicas asociadas',
              processor: 'Cloudflare R2',
              retention: 'Mientras el catálogo exista o borrado inmediato en reversión / cancelación',
            },
            {
              category: 'Trabajos en segundo plano',
              collectedData: 'Estado de cola, contadores de progreso e incidencias de moderación',
              processor: 'Base de datos PostgreSQL (Supabase) y RAM efímera en Render',
              retention: 'Purga automática de registros finalizados tras 12 horas',
            },
            {
              category: 'Control antiabuso y chat',
              collectedData: 'Cookie firmada sl_guest_ext y cuota diaria de consultas',
              processor: 'Servidor Node.js (Render) vía cookie HTTP-only HMAC',
              retention: 'Ventanas cortas (24 horas para chat; estado de cuota invitado)',
            },
            {
              category: 'Caché de rendimiento',
              collectedData: 'Validación JWT, conteo de cuota y manifest Core',
              processor: 'Memoria RAM volátil en Render',
              retention: 'TTL estricto de 45 a 120 segundos sin escritura en disco',
            },
          ],
        },
      },
      {
        id: 'ciclo-de-procesamiento',
        number: '04',
        title: 'Ciclo de vida del procesamiento, compresión e IA',
        paragraphs: [
          'Cuando un usuario pega una URL externa, nuestro backend valida primero que el dominio no corresponda a redes internas privadas (prevención de SSRF y resolución DNS restringida) ni a dominios incluidos en nuestras listas de bloqueo por contenido ilícito o pornográfico. Superada la validación, el servidor extrae únicamente etiquetas y URLs de imágenes compatibles con el tamaño mínimo operativo.',
          'Al confirmar el procesamiento en segundo plano (ya sea desde archivos locales o desde imágenes extraídas), las imágenes se optimizan al formato WebP, se almacenan en Cloudflare R2 y se someten de manera automatizada a evaluación multimodal mediante la API de visión de Google Gemini. Este análisis cumple una doble finalidad simultánea: verificar el cumplimiento estricto de seguridad de contenido y generar la ficha semántica del producto para su indexación.',
          'Las búsquedas en Search Link IA (simulador interno o integraciones externas mediante Search Link Core) utilizan el modelo lingüístico servido a través de Groq exclusivamente sobre el catálogo estructurado del servicio consultado. No mezclamos inventarios entre organizaciones distintas ni utilizamos tus catálogos privados para entrenar modelos fundacionales públicos.',
        ],
      },
      {
        id: 'moderacion-y-borrado-automatico',
        number: '05',
        title: 'Moderación automatizada de seguridad y reversión inmediata',
        paragraphs: [
          'Search Link implementa controles preventivos en tiempo real sobre dominios e imágenes para impedir el alojamiento de pornografía explícita, desnudez sexualizada, actos sexuales, violencia letal, mutilaciones, restos humanos o contenido sangriento. Las imágenes comerciales lícitas (como prendas de lencería o herramientas de cocina exhibidas en contexto comercial no violento ni explícito) son diferenciadas contextualmente por nuestro motor de evaluación.',
          'Si durante un lote en segundo plano nuestro sistema detecta una primera infracción moderada, la imagen infractora es rechazada y eliminada inmediatamente de Cloudflare R2. Si el sistema detecta una segunda infracción dentro del mismo lote o una primera infracción de gravedad extrema, ejecuta un protocolo automático de reversión integral: detiene de inmediato la cola, elimina de R2 la totalidad de las imágenes vinculadas al lote, revierte cualquier registro provisional creado en Supabase y comunica el motivo del bloqueo en el indicador de ciclo de vida.',
          'Asimismo, cualquier intento de introducir en el campo de búsqueda o en las APIs un dominio catalogado como portal pornográfico, de cámaras para adultos o de violencia extrema es bloqueado de manera inmediata antes de ejecutar peticiones de red hacia dicho origen.',
        ],
      },
      {
        id: 'cookies-y-almacenamiento-local',
        number: '06',
        title: 'Cookies, sesiones y almacenamiento local del navegador',
        paragraphs: [
          'Search Link no utiliza cookies publicitarias de terceros, redes de seguimiento conductual entre sitios ni perfiles de segmentación comercial. Empleamos únicamente mecanismos técnicos esenciales para el funcionamiento y la seguridad del servicio:',
        ],
        bullets: [
          'Sesión de autenticación (Supabase Auth): almacena en el navegador los tokens de sesión necesarios para mantener tu acceso autenticado de forma segura y renovar credenciales OAuth.',
          'Preferencia manual de idioma (localStorage sl_locale): recuerda si seleccionaste explícitamente Español, English o Português para que toda la interfaz conserve tu elección.',
          'Continuidad operativa (localStorage): conserva temporalmente el identificador de trabajos en curso y los metadatos locales de Organización para evitar pérdidas visuales ante recargas de página.',
          'Cookies HTTP-only firmadas con HMAC-SHA256: protegen las cuotas gratuitas de extracción para visitantes no autenticados y los límites diarios del simulador conversacional frente a manipulaciones del lado del cliente.',
        ],
      },
      {
        id: 'subencargados-y-transferencias',
        number: '07',
        title: 'Proveedores de infraestructura y transferencias internacionales',
        paragraphs: [
          'Para ofrecer disponibilidad global y baja latencia, Search Link delega componentes específicos de cómputo, almacenamiento e inferencia en proveedores tecnológicos especializados que operan bajo acuerdos contractuales de protección de datos y estándares de seguridad verificados:',
        ],
        bullets: [
          'Supabase Inc.: autenticación OAuth con Google, base de datos PostgreSQL relacional y políticas de aislamiento por filas (Row-Level Security).',
          'Cloudflare Inc.: alojamiento de la interfaz estática (Cloudflare Pages) y almacenamiento distribuido de objetos multimedia optimizados (Cloudflare R2).',
          'Render Services Inc.: ejecución del servidor API Node.js, trabajador de colas en segundo plano y cachés volátiles en memoria RAM.',
          'Google LLC (Google Gemini API): inspección multimodal de seguridad y extracción semántica de atributos de producto a partir de las imágenes enviadas al flujo de mapeo.',
          'Groq Inc.: inferencia lingüística de baja latencia para responder consultas sobre el catálogo del servicio activo en Search Link IA.',
        ],
      },
      {
        id: 'seguridad-de-la-informacion',
        number: '08',
        title: 'Medidas técnicas y organizativas de seguridad',
        paragraphs: [
          'Aplicamos salvaguardas de defensa en profundidad tanto en la capa de transporte como en la lógica de aplicación y persistencia. Todo el tráfico entre navegadores, clientes API y servidores transita exclusivamente bajo cifrado TLS. Las solicitudes autenticadas requieren verificación de firma JWT emitida por Supabase antes de ejecutar operaciones de subida, consulta de cola o modificación de catálogo.',
          'En la base de datos PostgreSQL aplicamos políticas de seguridad a nivel de fila (RLS) que restringen la lectura y escritura de organizaciones y servicios al propietario autenticado correspondiente. Las claves API de Search Link Core se derivan con entropía criptográfica y se verifican mediante comparación de hash SHA-256; además, el usuario puede desactivar un servicio o rotar su clave en cualquier instante desde su panel de Organización, invalidando de forma inmediata la credencial anterior.',
          'Para mitigar ataques de falsificación de solicitudes del lado del servidor (SSRF), toda URL externa aportada por un usuario atraviesa validación de protocolo HTTP/HTTPS, verificación previa de direcciones IP privadas, reservadas o de metadatos en la nube y revalidación en cada salto de redirección HTTP.',
        ],
      },
      {
        id: 'uso-aceptable-y-menores',
        number: '09',
        title: 'Condiciones esenciales de uso aceptable y elegibilidad',
        paragraphs: [
          'El acceso y registro en Search Link están dirigidos exclusivamente a personas mayores de 18 años o con plena capacidad legal para operar servicios digitales y comerciales en su jurisdicción. No recopilamos deliberadamente información personal de menores de edad; si detectamos una cuenta perteneciente a un menor sin autorización legal aplicable, procederemos a su bloqueo y supresión.',
          'Queda estrictamente prohibido utilizar Search Link para extraer, almacenar, indexar o distribuir material ilícito, contenido sexual explícito, violencia gráfica extrema, software malicioso, material sujeto a derechos de autor sin autorización del titular, ni emplear automatizaciones orientadas a eludir límites de cuota, realizar ingeniería inversa no autorizada o saturar deliberadamente nuestros servidores.',
        ],
      },
      {
        id: 'derechos-del-usuario-y-control',
        number: '10',
        title: 'Derechos de privacidad y control directo en la cuenta',
        paragraphs: [
          'De conformidad con la normativa aplicable en materia de protección de datos —incluyendo el Reglamento General de Protección de Datos (RGPD/GDPR), la Lei Geral de Proteção de Dados (LGPD), la California Consumer Privacy Act (CCPA/CPRA) y las leyes latinoamericanas de hábeas data—, tienes derecho a conocer qué datos conservamos sobre ti, solicitar la rectificación de información inexacta, oponerte a determinados tratamientos, exportar tus catálogos y solicitar la supresión definitiva de tu cuenta y activos almacenados.',
          'Estos controles se ejercen directamente dentro de tu sesión autenticada en Search Link: desde los paneles de Cuenta, Organización y Mi tienda puedes editar el nombre y logotipo de tu organización, renombrar o desactivar servicios, rotar tus claves API de Search Link Core en cualquier instante y modificar tu preferencia manual de idioma.',
          'Search Link podrá actualizar estas Políticas de privacidad y uso cuando incorporemos nuevas funcionalidades técnicas, cambiemos proveedores de infraestructura o se produzcan modificaciones normativas. Toda actualización sustancial se reflejará en la fecha y número de versión publicados al pie de este documento.',
        ],
      },
    ],
    footerNote:
      'Search Link · Documento oficial de Políticas de privacidad y uso. La disponibilidad de otros documentos complementarios (Términos y condiciones, Políticas de contenido y Políticas de cookies) se incorporará en esta misma sección de Documentaciones.',
  },

  en: {
    documentTitle: 'Privacy and Usage Policies',
    documentCategory: 'Legal and Privacy Engineering Documentation',
    effectiveLabel: 'Last updated',
    effectiveDate: 'November 21, 2026',
    versionLabel: 'Version',
    version: '1.0',
    appliesToLabel: 'Scope',
    appliesTo: 'Search Link Web, Search Link Core API, and Search Link AI',
    backLabel: 'Close',
    tocHeading: 'Document contents',
    mobileTocToggleLabel: 'Section index',
    leadSummary:
      'This document sets out the legal and engineering framework governing how Search Link collects, processes, stores, secures, and deletes personal, operational, and media data when you use our web application, automated URL extraction and catalog indexing tools, Search Link Core endpoints, and Search Link AI.',
    sections: [
      {
        id: 'identity-and-scope',
        number: '01',
        title: 'Data controller identity and operational scope',
        paragraphs: [
          'Search Link operates a technical infrastructure platform for media ingestion, image optimization, semantic catalog indexing, and conversational product search. These Privacy and Usage Policies govern all personal data and digital assets processed through our public web interface, authenticated Organization and My Store dashboards, background processing workers, and Search Link Core programmatic endpoints.',
          'Accessing or using the platform constitutes acknowledgment of these policies. Where a user operates on behalf of a merchant, company, or organization, that user warrants that they hold the authority to submit website URLs, product images, brand identifiers, descriptions, and catalog items for processing under the workflows described herein.',
        ],
      },
      {
        id: 'data-collected',
        number: '02',
        title: 'Information we request and data we collect',
        paragraphs: [
          'Search Link adheres to strict data minimization: we collect and derive only the information strictly required to authenticate accounts, isolate tenant workspaces, process visual media, issue cryptographic credentials, and protect platform availability against automated abuse.',
          'Depending on whether you browse as an unauthenticated visitor or operate a registered account, we process the following data categories:',
        ],
        bullets: [
          'Identity and authentication records (Google OAuth via Supabase Auth): unique user identifier (UUID), verified email address, full display name returned by your Google profile, avatar image URL, and account creation/sign-in timestamps. Search Link never collects payment card numbers, government IDs, or raw Google account passwords.',
          'Organization and My Store workspace data: organization display name, optional custom logo (stored as an optimized asset in object storage when uploaded), service names, public URL slugs, active/inactive service flags, and structured catalog metadata (product titles, categories, descriptions, extracted attributes, and reference URLs).',
          'Search Link Core API credentials: when you issue or rotate an API key with the slk_ prefix, the plaintext secret is displayed once in your browser session. Our database stores only a one-way SHA-256 cryptographic digest together with a short 12-character display prefix; raw secret keys cannot be recovered after issuance.',
          'User-submitted URLs and media files: public webpage addresses pasted into the extraction bar, image files uploaded from your device, pixel dimensions, file sizes, and resulting WebP compression ratios.',
          'Network, quota, and locale telemetry: origin IP address (processed transiently for rate limiting, abuse mitigation, and initial country-level interface language selection), standard HTTP request headers (User-Agent, Accept-Language), and HMAC-signed quota cookies.',
        ],
      },
      {
        id: 'data-inventory',
        number: '03',
        title: 'Technical storage and retention inventory',
        paragraphs: [
          'The table below documents each data category handled by Search Link, the underlying processor or storage layer, and our operational retention periods:',
        ],
        table: {
          headers: ['Data category', 'Specific fields', 'Infrastructure / Processor', 'Operational retention'],
          rows: [
            {
              category: 'User account',
              collectedData: 'UUID, email address, display name, OAuth avatar',
              processor: 'Supabase Auth (PostgreSQL)',
              retention: 'While account remains active or until deletion request',
            },
            {
              category: 'Organization & services',
              collectedData: 'Org name, logo, slug, SHA-256 API key hash, catalog index',
              processor: 'Supabase PostgreSQL + Cloudflare R2 (logo)',
              retention: 'Until service deletion or account erasure',
            },
            {
              category: 'Catalog media assets',
              collectedData: 'Optimized WebP images and associated public URLs',
              processor: 'Cloudflare R2',
              retention: 'While catalog exists or immediate purge on rollback / cancellation',
            },
            {
              category: 'Background queue jobs',
              collectedData: 'Queue state, progress counters, safety moderation status',
              processor: 'PostgreSQL database (Supabase) and ephemeral Render RAM',
              retention: 'Finished job logs auto-purged after 12 hours',
            },
            {
              category: 'Anti-abuse & chat limits',
              collectedData: 'Signed sl_guest_ext cookie and daily chat counter',
              processor: 'Node.js server (Render) via HMAC HTTP-only cookie',
              retention: 'Short rolling windows (24h chat window; guest quota state)',
            },
            {
              category: 'Performance caches',
              collectedData: 'JWT verification, image quota count, Core manifest',
              processor: 'Volatile RAM cache on Render',
              retention: 'Strict 45s to 120s TTL with zero disk persistence',
            },
          ],
        },
      },
      {
        id: 'processing-lifecycle',
        number: '04',
        title: 'Processing lifecycle, optimization, and AI workflows',
        paragraphs: [
          'When you submit a webpage URL, our server first validates that the target hostname does not resolve to private internal networks (mitigating SSRF and DNS rebinding attacks) and does not appear on our prohibited adult or extreme-shock domain blocklists. Upon passing validation, the extractor reads public metadata and image references meeting minimum resolution thresholds.',
          'Once background processing begins (whether from local uploads or extracted webpage assets), images are transcoded to WebP, persisted to Cloudflare R2, and evaluated automatically via Google Gemini multimodal vision APIs. This step performs safety compliance screening and structured product cataloging in a single pass.',
          'Conversational retrieval in Search Link AI (via the built-in tester or external integrations calling Search Link Core) executes through Groq inference strictly scoped to the active service catalog. Tenant inventories are strictly isolated and are never shared across organizations or used to train public foundation models.',
        ],
      },
      {
        id: 'automated-moderation',
        number: '05',
        title: 'Automated safety moderation and immediate rollback',
        paragraphs: [
          'Search Link enforces automated, real-time safeguards against explicit pornography, sexualized nudity, sexual acts, lethal violence, gore, corpses, and weapon-related bloodshed. Legitimate commercial photography (such as retail lingerie or clean kitchen/utility cutlery displayed in non-explicit, non-violent contexts) is contextually distinguished by our visual screening pipeline.',
          'If a single moderate safety violation is detected during background mapping, that image is immediately rejected and deleted from Cloudflare R2. If a second violation occurs in the same batch—or upon any severe violation—our rollback mechanism halts the entire job immediately, purges every R2 object associated with that batch, removes draft database records from Supabase, and surfaces the policy reason inside the lifecycle indicator.',
          'Additionally, any attempt to paste or submit a URL belonging to a known pornographic, adult webcam, or shock-gore domain is blocked instantaneously prior to initiating outbound network requests.',
        ],
      },
      {
        id: 'cookies-and-local-storage',
        number: '06',
        title: 'Cookies and browser local storage',
        paragraphs: [
          'Search Link does not deploy third-party advertising cookies, cross-site behavioral trackers, or programmatic ad-tech pixels. We rely solely on strictly necessary technical storage mechanisms:',
        ],
        bullets: [
          'Authentication session tokens (Supabase Auth): maintains your authenticated state and OAuth session refresh.',
          'Manual language preference (localStorage sl_locale): persists your explicit choice between Español, English, and Português.',
          'Operational continuity (localStorage): temporarily caches active job identifiers and local Organization state so reloads do not interrupt ongoing status tracking.',
          'HMAC-SHA256 signed HTTP-only cookies: enforce guest extraction quotas and daily AI chat simulator limits against client-side tampering.',
        ],
      },
      {
        id: 'subprocessors-and-transfers',
        number: '07',
        title: 'Infrastructure sub-processors and international transfers',
        paragraphs: [
          'To deliver low-latency processing and reliable storage, Search Link relies on specialized infrastructure providers bound by enterprise security and data-processing commitments:',
        ],
        bullets: [
          'Supabase Inc.: Google OAuth identity brokerage, managed PostgreSQL storage, and Row-Level Security enforcement.',
          'Cloudflare Inc.: static frontend edge delivery (Cloudflare Pages) and distributed object storage (Cloudflare R2).',
          'Render Services Inc.: Node.js API hosting, background mapping workers, and volatile in-memory caches.',
          'Google LLC (Google Gemini API): multimodal safety screening and structured product attribute generation.',
          'Groq Inc.: low-latency language model inference scoped strictly to the queried service catalog.',
        ],
      },
      {
        id: 'security-controls',
        number: '08',
        title: 'Technical and organizational security controls',
        paragraphs: [
          'We enforce defense-in-depth protections across transport, application logic, and database boundaries. All browser, API client, and server-to-server traffic runs exclusively over TLS encryption. Authenticated endpoints verify Supabase JWT signatures prior to accepting uploads, job submissions, or catalog mutations.',
          'PostgreSQL Row-Level Security policies isolate organizations and services per authenticated owner. Search Link Core API keys are generated with cryptographic randomness and validated via one-way SHA-256 hash comparison; owners may deactivate any service or rotate API keys instantly from the Organization panel.',
          'To prevent Server-Side Request Forgery (SSRF), every outbound HTTP extraction request enforces protocol restrictions, blocks loopback/link-local/cloud-metadata/private IPv4 and IPv6 ranges after DNS resolution, and re-validates every HTTP redirect target.',
        ],
      },
      {
        id: 'acceptable-use-and-eligibility',
        number: '09',
        title: 'Acceptable use and age eligibility',
        paragraphs: [
          'Search Link is intended solely for individuals aged 18 or older, or who possess full legal capacity to operate commercial software services in their jurisdiction. We do not knowingly collect personal information from minors and will promptly terminate and erase accounts identified as belonging to underage individuals.',
          'Users are strictly prohibited from using Search Link to extract, host, index, or distribute unlawful material, explicit adult content, extreme graphic violence, malware, or unauthorized copyrighted media, as well as from attempting to bypass quota enforcement or disrupt platform stability.',
        ],
      },
      {
        id: 'user-rights-and-controls',
        number: '10',
        title: 'Privacy rights and direct account controls',
        paragraphs: [
          'Depending on your jurisdiction—including under the EU/UK GDPR, Brazil LGPD, California CCPA/CPRA, and Latin American data-protection statutes—you have the right to request access to your personal data, rectify inaccurate details, object to specific processing activities, export structured catalog records, and request permanent erasure of your account and media assets.',
          'These controls are available directly within your authenticated Search Link session: from your Account, Organization, and My Store panels you can edit your organization name and logo, rename or deactivate services, rotate Search Link Core API keys at any moment, and adjust your language settings.',
          'We may revise these Privacy and Usage Policies as our technical architecture, sub-processors, or regulatory obligations evolve. Material updates will be reflected in the effective date and version summary published at the bottom of this document.',
        ],
      },
    ],
    footerNote:
      'Search Link · Official Privacy and Usage Policies.',
  },

  pt: {
    documentTitle: 'Políticas de privacidade e uso',
    documentCategory: 'Documentação jurídica e de engenharia de privacidade',
    effectiveLabel: 'Última atualização',
    effectiveDate: '21 de novembro de 2026',
    versionLabel: 'Versão',
    version: '1.0',
    appliesToLabel: 'Escopo',
    appliesTo: 'Search Link Web, Search Link Core API e Search Link IA',
    backLabel: 'Fechar',
    tocHeading: 'Conteúdo do documento',
    mobileTocToggleLabel: 'Índice de seções',
    leadSummary:
      'Este documento estabelece de forma técnica e jurídica como o Search Link coleta, processa, armazena, protege e exclui dados pessoais, operacionais e arquivos de mídia dos usuários que utilizam nossa aplicação web, ferramentas de extração e catalogação automatizada, endpoints Search Link Core e o assistente Search Link IA.',
    sections: [
      {
        id: 'identidade-e-escopo',
        number: '01',
        title: 'Identidade do controlador e escopo operacional',
        paragraphs: [
          'O Search Link opera uma plataforma de infraestrutura voltada à ingestão, otimização de imagens, indexação semântica de catálogos e busca conversacional de produtos e serviços. Estas Políticas de privacidade e uso regem todo o tratamento de dados pessoais e ativos digitais realizado na interface web pública, nos painéis autenticados de Organização e Minha loja, na fila em segundo plano e nas interfaces Search Link Core.',
          'A utilização da plataforma implica ciência e concordância com estas diretrizes. Ao atuar em nome de uma empresa, loja ou organização, o usuário declara possuir poderes para submeter URLs, fotografias, nomes comerciais, descrições e catálogos para processamento conforme os fluxos aqui descritos.',
        ],
      },
      {
        id: 'dados-coletados',
        number: '02',
        title: 'Informações solicitadas e dados coletados',
        paragraphs: [
          'O Search Link adota o princípio de minimização de dados: coletamos ou derivamos exclusivamente as informações indispensáveis para autenticar sessões, isolar ambientes por organização, processar mídias, emitir credenciais criptográficas e prevenir abuso automatizado.',
          'Conforme sua interação ocorra como visitante não autenticado ou como titular de conta registrada, tratamos as seguintes categorias:',
        ],
        bullets: [
          'Dados de identidade e autenticação (Google OAuth via Supabase Auth): identificador único de usuário (UUID), endereço de e-mail verificado, nome completo exibido no perfil Google, URL da foto de avatar e registros temporais de criação e login. O Search Link nunca solicita dados bancários, documentos civis ou senhas diretas do Google.',
          'Dados de Organização e Minha loja: nome comercial da organização, logotipo institucional (armazenado de forma otimizada em nosso armazenamento de objetos quando enviado), nomes atribuídos aos serviços, slugs públicos, estado de ativação e metadados estruturados do catálogo (nome do produto, categoria, descrição, atributos detectados e referências).',
          'Credenciais de acesso Search Link Core: ao gerar ou rotacionar uma API Key com prefixo slk_, a chave completa é exibida uma única vez na sessão do navegador. No banco de dados armazenamos exclusivamente um hash criptográfico unidirecional SHA-256 acompanhado de um prefixo curto de identificação; nunca guardamos a chave secreta em texto simples.',
          'URLs e arquivos de mídia fornecidos pelo usuário: endereços web inseridos no extrator, arquivos de imagem carregados do dispositivo local, dimensões, tamanho em bytes e taxa de compressão WebP.',
          'Dados técnicos de rede, cota e idioma: endereço IP de origem (tratado de maneira transitória para limitação de taxa, prevenção a fraudes e detecção inicial de idioma por país), cabeçalhos HTTP padrão e cookies assinados de controle de cota.',
        ],
      },
      {
        id: 'inventario-de-dados',
        number: '03',
        title: 'Inventário técnico de armazenamento e retenção',
        paragraphs: [
          'A tabela abaixo sintetiza cada categoria de dados processada pelo Search Link, a infraestrutura responsável e os prazos operacionais de retenção:',
        ],
        table: {
          headers: ['Categoria de dado', 'Elementos específicos', 'Infraestrutura / Operador', 'Retenção operacional'],
          rows: [
            {
              category: 'Conta de usuário',
              collectedData: 'UUID, e-mail, nome, avatar OAuth',
              processor: 'Supabase Auth (PostgreSQL)',
              retention: 'Enquanto a conta permanecer ativa ou até pedido de exclusão',
            },
            {
              category: 'Organização e serviços',
              collectedData: 'Nome, logotipo, slug, hash SHA-256 da API Key e catálogo',
              processor: 'Supabase PostgreSQL + Cloudflare R2 (logotipo)',
              retention: 'Até exclusão do serviço ou remoção da conta',
            },
            {
              category: 'Imagens do catálogo',
              collectedData: 'Arquivos WebP otimizados e URLs públicas vinculadas',
              processor: 'Cloudflare R2',
              retention: 'Enquanto o catálogo existir ou remoção imediata em reversão / cancelamento',
            },
            {
              category: 'Trabalhos em segundo plano',
              collectedData: 'Estado da fila, progresso e eventos de moderação',
              processor: 'Banco de dados PostgreSQL (Supabase) e RAM efêmera no Render',
              retention: 'Expurgo automático de logs finalizados após 12 horas',
            },
            {
              category: 'Antiabuso e limites de chat',
              collectedData: 'Cookie assinado sl_guest_ext e contador diário de consultas',
              processor: 'Servidor Node.js (Render) via cookie HTTP-only HMAC',
              retention: 'Janelas curtas (24h para chat; estado de cota de visitante)',
            },
            {
              category: 'Caches de desempenho',
              collectedData: 'Validação JWT, contagem de cota e manifest Core',
              processor: 'Memória RAM volátil no Render',
              retention: 'TTL estrito de 45 a 120 segundos sem gravação em disco',
            },
          ],
        },
      },
      {
        id: 'ciclo-de-processamento',
        number: '04',
        title: 'Ciclo de processamento, otimização e inteligência artificial',
        paragraphs: [
          'Ao colar uma URL externa, nosso servidor valida previamente que o domínio não aponta para redes privadas internas (prevenção contra SSRF e DNS rebinding) nem integra nossas listas de bloqueio por conteúdo pornográfico ou violência extrema. Após essa verificação, o extrator coleta apenas metadados e referências de imagem compatíveis com os critérios mínimos de resolução.',
          'Quando o processamento em segundo plano é iniciado (via envio local ou imagens extraídas), os arquivos são convertidos para WebP, gravados no Cloudflare R2 e analisados automaticamente pela API multimodal de visão do Google Gemini. Essa etapa executa simultaneamente a triagem de segurança e a estruturação semântica do item no catálogo.',
          'As consultas no Search Link IA (simulador interno ou integrações externas via Search Link Core) operam com inferência da Groq restrita exclusivamente ao catálogo do serviço consultado. Não compartilhamos acervos entre organizações distintas nem utilizamos catálogos privados para treinar modelos públicos.',
        ],
      },
      {
        id: 'moderacao-e-reversao',
        number: '05',
        title: 'Moderação automatizada de segurança e reversão imediata',
        paragraphs: [
          'O Search Link aplica proteções automatizadas em tempo real contra pornografia explícita, nudez sexualizada, atos sexuais, violência letal, mutilações, cadáveres e armas ensanguentadas. Fotografias comerciais legítimas (como lingerie em vitrine ou facas culinárias limpas em contexto comercial não violento) são diferenciadas contextualmente pelo nosso mecanismo de análise.',
          'Caso uma primeira violação moderada seja identificada durante o lote em segundo plano, a imagem infratora é bloqueada e removida imediatamente do Cloudflare R2. Havendo reincidência no mesmo lote — ou diante de qualquer infração grave — o protocolo de reversão interrompe imediatamente a fila, exclui do R2 todas as imagens do lote, desfaz registros provisórios no Supabase e informa o motivo no indicador de ciclo de vida.',
          'Além disso, qualquer tentativa de inserir ou enviar uma URL pertencente a domínios pornográficos, de webcams adultas ou de violência extrema é bloqueada instantaneamente antes de qualquer requisição de rede.',
        ],
      },
      {
        id: 'cookies-e-armazenamento',
        number: '06',
        title: 'Cookies e armazenamento local do navegador',
        paragraphs: [
          'O Search Link não utiliza cookies publicitários de terceiros, rastreadores comportamentais entre sites nem perfis de segmentação comercial. Utilizamos apenas recursos técnicos essenciais:',
        ],
        bullets: [
          'Sessão autenticada (Supabase Auth): mantém seu acesso autenticado e a renovação segura dos tokens OAuth.',
          'Preferência manual de idioma (localStorage sl_locale): preserva sua escolha explícita entre Español, English e Português.',
          'Continuidade operacional (localStorage): guarda temporariamente identificadores de fila ativa e estado local da Organização para evitar perda visual em recarregamentos.',
          'Cookies HTTP-only assinados com HMAC-SHA256: protegem as cotas gratuitas de extração para visitantes e os limites diários do simulador conversacional contra adulteração.',
        ],
      },
      {
        id: 'suboperadores-e-transferencias',
        number: '07',
        title: 'Suboperadores de infraestrutura e transferências internacionais',
        paragraphs: [
          'Para assegurar baixa latência e alta disponibilidade, o Search Link conta com provedores tecnológicos especializados sob compromissos contratuais de segurança e privacidade:',
        ],
        bullets: [
          'Supabase Inc.: autenticação OAuth com Google, banco de dados PostgreSQL e políticas de segurança em nível de linha (Row-Level Security).',
          'Cloudflare Inc.: distribuição estática de frontend (Cloudflare Pages) e armazenamento distribuído de objetos (Cloudflare R2).',
          'Render Services Inc.: execução do servidor API Node.js, processamento em segundo plano e caches voláteis em RAM.',
          'Google LLC (Google Gemini API): inspeção multimodal de segurança e extração semântica de atributos de catálogo.',
          'Groq Inc.: inferência linguística de baixa latência restrita ao catálogo do serviço ativo.',
        ],
      },
      {
        id: 'seguranca-da-informacao',
        number: '08',
        title: 'Medidas técnicas e organizacionais de segurança',
        paragraphs: [
          'Adotamos controles de defesa em profundidade nas camadas de transporte, aplicação e persistência. Todo o tráfego ocorre exclusivamente sob criptografia TLS. Endpoints autenticados exigem verificação válida de assinatura JWT emitida pelo Supabase antes de qualquer envio, consulta de fila ou alteração de catálogo.',
          'No PostgreSQL aplicamos políticas Row-Level Security (RLS) que isolam organizações e serviços por proprietário autenticado. As chaves API do Search Link Core são geradas com entropia criptográfica e verificadas por comparação de hash SHA-256; o titular pode desativar serviços ou rotacionar chaves imediatamente pelo painel de Organização.',
          'Para mitigar ataques SSRF (Server-Side Request Forgery), toda URL externa submetida passa por restrição de protocolo HTTP/HTTPS, bloqueio de IPs privados, locais ou de metadados em nuvem após resolução DNS e revalidação em cada redirecionamento.',
        ],
      },
      {
        id: 'uso-aceitavel-e-elegibilidade',
        number: '09',
        title: 'Uso aceitável e elegibilidade etária',
        paragraphs: [
          'O Search Link destina-se exclusivamente a pessoas maiores de 18 anos ou com plena capacidade civil para contratar e operar ferramentas comerciais digitais. Não coletamos intencionalmente dados de menores de idade e encerraremos contas identificadas como pertencentes a menores.',
          'É estritamente proibido utilizar o Search Link para extrair, armazenar, indexar ou distribuir conteúdo ilícito, material sexual explícito, violência gráfica extrema, malware ou obras protegidas sem autorização, bem como tentar burlar limites de cota ou comprometer a disponibilidade da plataforma.',
        ],
      },
      {
        id: 'direitos-e-controle',
        number: '10',
        title: 'Direitos dos titulares e controle direto na conta',
        paragraphs: [
          'Nos termos da legislação aplicável — incluindo a Lei Geral de Proteção de Dados (LGPD), o Regulamento Geral sobre a Proteção de Dados (GDPR), a CCPA/CPRA e demais normas de proteção de dados — você tem direito à confirmação de tratamento, acesso aos dados, correção de informações inexatas, oposição, portabilidade do catálogo e eliminação definitiva da conta e das mídias armazenadas.',
          'Esses controles são exercidos diretamente dentro da sua sessão autenticada no Search Link: pelos painéis Conta, Organização e Minha loja você pode alterar nome e logotipo da organização, renomear ou desativar serviços, rotacionar API Keys do Search Link Core a qualquer instante e ajustar sua preferência manual de idioma.',
          'Estas Políticas de privacidade e uso podem ser atualizadas periodicamente para refletir evoluções técnicas, novos suboperadores ou exigências legais. Alterações relevantes serão indicadas pela data de atualização e número de versão exibidos ao final deste documento.',
        ],
      },
    ],
    footerNote:
      'Search Link · Documento oficial de Políticas de privacidade e uso.',
  },
};
