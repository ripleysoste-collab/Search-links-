import type { SupportedLocale } from '../lib/i18n';
import type { PrivacyPolicyDocument } from './privacyPolicyContent';

export const COOKIE_POLICY_CONTENT: Record<SupportedLocale, PrivacyPolicyDocument> = {
  es: {
    documentTitle: 'Políticas de cookies',
    documentCategory: 'Documentación técnica de cookies y almacenamiento local',
    effectiveLabel: 'Última actualización',
    effectiveDate: '22 de noviembre de 2026',
    versionLabel: 'Versión',
    version: '1.1',
    appliesToLabel: 'Ámbito',
    appliesTo: 'Search Link Web, Autenticación OAuth, Search Link IA y Banco de Imágenes (Pexels y Pixabay)',
    backLabel: 'Cerrar',
    tocHeading: 'Contenido del documento',
    mobileTocToggleLabel: 'Índice de secciones',
    leadSummary:
      'Estas Políticas de cookies explican qué son las cookies y las tecnologías equivalentes de almacenamiento local en el navegador, cuáles utiliza exactamente Search Link para operar de forma segura, qué finalidad cumple cada una y cómo puedes gestionarlas o eliminarlas desde tu dispositivo.',
    sections: [
      {
        id: 'que-son-las-cookies',
        number: '01',
        title: 'Qué son las cookies y tecnologías de almacenamiento local',
        paragraphs: [
          'Una cookie es un pequeño archivo de texto que un servidor envía al navegador cuando visitas un sitio web para conservar información técnica entre peticiones, como proteger una cuota de uso, mantener la seguridad de la sesión o evitar peticiones automatizadas abusivas.',
          'Además de las cookies HTTP tradicionales, las aplicaciones web modernas utilizan mecanismos locales del navegador como localStorage para recordar preferencias de interfaz elegidas por el usuario (por ejemplo, el idioma) o conservar temporalmente el estado operativo sin obligar a recargar datos desde el servidor en cada interacción.',
        ],
      },
      {
        id: 'principio-de-uso-en-search-link',
        number: '02',
        title: 'Enfoque estricto de Search Link: cero rastreo publicitario',
        paragraphs: [
          'Search Link utiliza exclusivamente cookies y almacenamiento local estrictamente necesarios para el funcionamiento técnico, la seguridad criptográfica de cuotas y la continuidad de tu experiencia en la plataforma.',
          'No utilizamos cookies de publicidad, redes de remarketing, píxeles de seguimiento entre sitios, perfiles comerciales de comportamiento ni herramientas de venta de datos a terceros.',
        ],
      },
      {
        id: 'inventario-de-cookies-y-almacenamiento',
        number: '03',
        title: 'Inventario exacto de cookies y almacenamiento local utilizados',
        paragraphs: [
          'A continuación se detalla cada cookie técnica emitida por nuestro servidor y cada elemento almacenado localmente en tu navegador:',
        ],
        table: {
          headers: ['Identificador / Tipo', 'Categoría', 'Finalidad específica', 'Duración / Alcance'],
          rows: [
            {
              category: 'sl_guest_ext (Cookie HTTP-only)',
              collectedData: 'Seguridad y cuota antiabuso',
              processor: 'Controla el límite de extracciones de prueba para visitantes sin inicio de sesión mediante firma HMAC-SHA256',
              retention: 'Hasta 24 horas; se limpia automáticamente al iniciar sesión',
            },
            {
              category: 'sl_ia_daily (Cookie HTTP-only)',
              collectedData: 'Seguridad y límite diario',
              processor: 'Protege el asistente Search Link IA frente a saturación automatizada contabilizando consultas diarias mediante firma HMAC-SHA256',
              retention: 'Ventana móvil de 24 horas',
            },
            {
              category: 'sl_img_bank_cd (Cookie HTTP-only)',
              collectedData: 'Control de frecuencia anti-saturación',
              processor: 'Aplica un intervalo mínimo de 3 minutos entre búsquedas en el banco público de imágenes (Pexels / Pixabay) mediante firma HMAC-SHA256',
              retention: '3 minutos por cada consulta realizada',
            },
            {
              category: 'Tokens de sesión OAuth (Almacenamiento local)',
              collectedData: 'Autenticación esencial',
              processor: 'Mantiene activa y verificada tu sesión autenticada con Google a través de Supabase Auth',
              retention: 'Hasta cerrar sesión o revocar tokens en el navegador',
            },
            {
              category: 'sl_locale (localStorage)',
              collectedData: 'Preferencia funcional',
              processor: 'Guarda el idioma seleccionado manualmente por el usuario (Español, English o Português)',
              retention: 'Persistente hasta que el usuario cambie de idioma o limpie el navegador',
            },
            {
              category: 'Estado operativo local (localStorage)',
              collectedData: 'Continuidad de interfaz',
              processor: 'Conserva localmente borradores de organización, historial del probador Search Link IA y seguimiento de trabajos en curso tras recargas',
              retention: 'Temporal en el dispositivo hasta completar el flujo o limpiar datos del sitio',
            },
            {
              category: 'sl_image_bank_saved_v1 (localStorage)',
              collectedData: 'Colección del usuario',
              processor: 'Guarda localmente en tu dispositivo las imágenes seleccionadas desde los bancos públicos Pexels y Pixabay dentro de la sección Guardado para organizarlas antes de crear catálogos',
              retention: 'Persistente en el dispositivo hasta que las elimines o borres los datos del sitio',
            },
          ],
        },
      },
      {
        id: 'cookies-de-terceros',
        number: '04',
        title: 'Intervención de proveedores técnicos y autenticación',
        paragraphs: [
          'Cuando decides iniciar sesión mediante Google OAuth, Google y nuestro proveedor de autenticación (Supabase Auth) pueden establecer sus propios mecanismos técnicos de verificación necesarios exclusivamente para completar el flujo de identidad OAuth de forma segura.',
          'Las llamadas de procesamiento hacia infraestructura de almacenamiento, modelos de inteligencia artificial o consulta a los bancos públicos de imágenes Pexels y Pixabay se ejecutan del lado del servidor sin exponer cookies publicitarias ni rastreadores al navegador del usuario final. Al previsualizar o guardar recursos de dichos bancos, tu navegador solicita las imágenes públicas directamente desde los servidores multimedia de Pexels o Pixabay bajo sus respectivas licencias públicas y atribución.',
        ],
      },
      {
        id: 'por-que-no-requieren-perfilado',
        number: '05',
        title: 'Base técnica y necesidad operativa',
        paragraphs: [
          'Las cookies sl_guest_ext, sl_ia_daily y sl_img_bank_cd están configuradas con el atributo HttpOnly, lo que impide que scripts del lado del cliente lean o manipulen su contenido, y con protección criptográfica HMAC-SHA256 para asegurar la integridad de los límites de servicio. Cuando la conexión se realiza mediante HTTPS, se transmiten únicamente sobre canales cifrados.',
          'Debido a que estas cookies y registros locales cumplen funciones estrictamente técnicas de seguridad, autenticación y preferencias explícitamente solicitadas por el usuario, resultan indispensables para prestar el servicio solicitado.',
        ],
      },
      {
        id: 'como-gestionar-o-eliminar',
        number: '06',
        title: 'Cómo gestionar, bloquear o eliminar cookies y datos locales',
        paragraphs: [
          'Puedes revisar, bloquear o borrar las cookies y el almacenamiento local en cualquier momento desde la configuración de privacidad de tu navegador web (Chrome, Safari, Firefox, Edge o navegadores móviles):',
        ],
        bullets: [
          'Eliminar datos del sitio desde la barra de direcciones o ajustes de privacidad del navegador borra de inmediato tanto las cookies HTTP-only como las entradas de localStorage.',
          'Cerrar sesión dentro de Search Link revoca tu sesión autenticada activa en el navegador.',
          'Ten en cuenta que bloquear por completo las cookies esenciales puede impedir el inicio de sesión con Google, restablecer tu idioma seleccionado o impedir el uso controlado del probador Search Link IA y la barra de extracción.',
        ],
      },
      {
        id: 'actualizaciones-de-esta-politica',
        number: '07',
        title: 'Actualizaciones de estas Políticas de cookies',
        paragraphs: [
          'Si en el futuro incorporamos nuevas herramientas técnicas, métricas opcionales o mecanismos adicionales que impliquen el uso de nuevas categorías de cookies, actualizaremos este documento e indicaremos la nueva fecha y versión al pie de la página antes de su entrada en vigor.',
        ],
      },
    ],
    footerNote:
      'Search Link · Políticas de cookies. Complementan nuestras Políticas de privacidad y uso y Términos y condiciones.',
  },

  en: {
    documentTitle: 'Cookie Policies',
    documentCategory: 'Technical Documentation on Cookies and Local Storage',
    effectiveLabel: 'Last updated',
    effectiveDate: 'November 22, 2026',
    versionLabel: 'Version',
    version: '1.1',
    appliesToLabel: 'Scope',
    appliesTo: 'Search Link Web, OAuth Authentication, Search Link AI, and Image Bank (Pexels & Pixabay)',
    backLabel: 'Close',
    tocHeading: 'Document contents',
    mobileTocToggleLabel: 'Section index',
    leadSummary:
      'These Cookie Policies explain what cookies and browser local storage technologies are, which specific items Search Link uses to operate securely, the exact purpose of each mechanism, and how you can manage or clear them from your device.',
    sections: [
      {
        id: 'what-are-cookies',
        number: '01',
        title: 'What cookies and browser local storage are',
        paragraphs: [
          'A cookie is a small text record sent by a server to your browser when you visit a website in order to preserve essential technical state across requests, such as enforcing service quotas, maintaining security, or preventing automated abuse.',
          'Alongside standard HTTP cookies, modern web applications use browser local storage (localStorage) to remember user-selected interface preferences (such as language) and preserve active workflow state smoothly without forcing redundant server reloads.',
        ],
      },
      {
        id: 'zero-ad-tracking',
        number: '02',
        title: 'Search Link approach: zero advertising tracking',
        paragraphs: [
          'Search Link uses strictly necessary cookies and local browser storage solely for technical operation, cryptographic quota enforcement, authentication continuity, and user-chosen preferences.',
          'We do not deploy advertising cookies, cross-site remarketing pixels, behavioral profiling trackers, or third-party ad-tech data brokers.',
        ],
      },
      {
        id: 'cookie-inventory',
        number: '03',
        title: 'Exact inventory of cookies and local storage used',
        paragraphs: [
          'The table below lists every technical cookie set by our server and every local browser storage entry used by Search Link:',
        ],
        table: {
          headers: ['Identifier / Type', 'Category', 'Specific purpose', 'Duration / Scope'],
          rows: [
            {
              category: 'sl_guest_ext (HTTP-only cookie)',
              collectedData: 'Security & anti-abuse quota',
              processor: 'Enforces extraction preview quotas for unauthenticated visitors using an HMAC-SHA256 signature',
              retention: 'Up to 24 hours; automatically cleared upon sign-in',
            },
            {
              category: 'sl_ia_daily (HTTP-only cookie)',
              collectedData: 'Security & daily rate limit',
              processor: 'Protects Search Link AI against automated saturation by tracking daily query allowances with an HMAC-SHA256 signature',
              retention: '24-hour rolling window',
            },
            {
              category: 'sl_img_bank_cd (HTTP-only cookie)',
              collectedData: 'Anti-saturation rate control',
              processor: 'Enforces a 3-minute cooldown interval between public image bank searches (Pexels / Pixabay) using an HMAC-SHA256 signature',
              retention: '3 minutes per completed search',
            },
            {
              category: 'OAuth session tokens (Browser storage)',
              collectedData: 'Essential authentication',
              processor: 'Maintains your verified Google OAuth session safely via Supabase Auth',
              retention: 'Until sign-out or browser storage removal',
            },
            {
              category: 'sl_locale (localStorage)',
              collectedData: 'Functional preference',
              processor: 'Remembers the interface language explicitly selected by the user (Español, English, or Português)',
              retention: 'Persistent until language change or browser clearing',
            },
            {
              category: 'Local workflow state (localStorage)',
              collectedData: 'Interface continuity',
              processor: 'Temporarily caches organization display details, Search Link AI chat tester history, and active background job progress across page reloads',
              retention: 'Temporary on-device storage until workflow completion or site data reset',
            },
            {
              category: 'sl_image_bank_saved_v1 (localStorage)',
              collectedData: 'User collection',
              processor: 'Stores on your device the images you save from the Pexels and Pixabay public image banks inside the Saved view so you can organize them before building catalogs',
              retention: 'Persistent on-device until removed by you or site data is cleared',
            },
          ],
        },
      },
      {
        id: 'third-party-auth',
        number: '04',
        title: 'Technical providers and authentication flows',
        paragraphs: [
          'When you choose to sign in using Google OAuth, Google and our authentication provider (Supabase Auth) may set technical verification tokens strictly required to complete secure OAuth identity handshakes.',
          'Backend media processing, AI model inference, and search queries to the Pexels and Pixabay public image banks execute server-to-server without injecting third-party advertising trackers into your browser. When previewing or saving public assets, your browser loads image files from Pexels or Pixabay media endpoints subject to their public licenses and attribution.',
        ],
      },
      {
        id: 'security-attributes',
        number: '05',
        title: 'Security attributes and operational necessity',
        paragraphs: [
          'The cookies sl_guest_ext, sl_ia_daily, and sl_img_bank_cd are issued with the HttpOnly flag—preventing client-side scripts from reading or altering them—and signed with HMAC-SHA256 to guarantee quota integrity. Over HTTPS connections, they are transmitted exclusively over encrypted channels.',
          'Because these cookies and local entries strictly perform security enforcement, authentication, and user-requested preferences, they are indispensable to deliver the service safely.',
        ],
      },
      {
        id: 'managing-and-clearing',
        number: '06',
        title: 'How to manage, block, or delete cookies and site data',
        paragraphs: [
          'You may inspect, block, or erase cookies and local storage at any time through your browser privacy settings (Chrome, Safari, Firefox, Edge, or mobile browsers):',
        ],
        bullets: [
          'Clearing site data from your browser privacy settings immediately removes both HTTP-only cookies and localStorage keys.',
          'Signing out inside Search Link revokes your active authenticated browser session.',
          'Blocking strictly necessary cookies may prevent Google authentication, reset your chosen language, or restrict access to Search Link AI and extraction rate-limit controls.',
        ],
      },
      {
        id: 'policy-updates',
        number: '07',
        title: 'Updates to these Cookie Policies',
        paragraphs: [
          'If future platform capabilities introduce optional analytics or additional storage categories, we will update these Cookie Policies and reflect the revised date and version summary at the bottom of this page prior to activation.',
        ],
      },
    ],
    footerNote:
      'Search Link · Cookie Policies. These policies complement our Privacy and Usage Policies and Terms and Conditions.',
  },

  pt: {
    documentTitle: 'Políticas de cookies',
    documentCategory: 'Documentação técnica de cookies e armazenamento local',
    effectiveLabel: 'Última atualização',
    effectiveDate: '22 de novembro de 2026',
    versionLabel: 'Versão',
    version: '1.1',
    appliesToLabel: 'Escopo',
    appliesTo: 'Search Link Web, Autenticação OAuth, Search Link IA e Banco de Imagens (Pexels e Pixabay)',
    backLabel: 'Fechar',
    tocHeading: 'Conteúdo do documento',
    mobileTocToggleLabel: 'Índice de seções',
    leadSummary:
      'Estas Políticas de cookies explicam o que são cookies e armazenamento local no navegador, quais itens específicos o Search Link utiliza para operar com segurança, a finalidade exata de cada mecanismo e como você pode gerenciá-los ou removê-los do seu dispositivo.',
    sections: [
      {
        id: 'o-que-sao-cookies',
        number: '01',
        title: 'O que são cookies e armazenamento local do navegador',
        paragraphs: [
          'Um cookie é um pequeno registro de texto enviado pelo servidor ao navegador durante a visita a um site para preservar estado técnico essencial entre requisições, como controle de cotas, segurança da sessão e prevenção contra abuso automatizado.',
          'Além dos cookies HTTP tradicionais, aplicações web modernas utilizam recursos locais do navegador como localStorage para recordar preferências escolhidas pelo usuário (como o idioma) e preservar o estado visual sem exigir recargas desnecessárias do servidor.',
        ],
      },
      {
        id: 'zero-rastreamento-publicitario',
        number: '02',
        title: 'Critério do Search Link: zero rastreamento publicitário',
        paragraphs: [
          'O Search Link utiliza exclusivamente cookies e armazenamento local estritamente necessários para operação técnica, segurança criptográfica de cotas, continuidade da autenticação e preferências definidas pelo usuário.',
          'Não utilizamos cookies publicitários, redes de remarketing, rastreadores comportamentais entre sites nem corretores comerciais de dados.',
        ],
      },
      {
        id: 'inventario-de-cookies',
        number: '03',
        title: 'Inventário exato de cookies e armazenamento local utilizados',
        paragraphs: [
          'A tabela abaixo descreve cada cookie técnico emitido pelo servidor e cada registro local mantido pelo Search Link no navegador:',
        ],
        table: {
          headers: ['Identificador / Tipo', 'Categoria', 'Finalidade específica', 'Duração / Escopo'],
          rows: [
            {
              category: 'sl_guest_ext (Cookie HTTP-only)',
              collectedData: 'Segurança e cota antiabuso',
              processor: 'Controla o limite de testes de extração para visitantes sem login utilizando assinatura HMAC-SHA256',
              retention: 'Até 24 horas; removido automaticamente ao fazer login',
            },
            {
              category: 'sl_ia_daily (Cookie HTTP-only)',
              collectedData: 'Segurança e limite diário',
              processor: 'Protege o assistente Search Link IA contra saturação automatizada contabilizando consultas diárias com assinatura HMAC-SHA256',
              retention: 'Janela móvel de 24 horas',
            },
            {
              category: 'sl_img_bank_cd (Cookie HTTP-only)',
              collectedData: 'Controle anti-saturação',
              processor: 'Aplica um intervalo mínimo de 3 minutos entre buscas no banco público de imagens (Pexels / Pixabay) com assinatura HMAC-SHA256',
              retention: '3 minutos por busca realizada',
            },
            {
              category: 'Tokens de sessão OAuth (Armazenamento local)',
              collectedData: 'Autenticação essencial',
              processor: 'Mantém sua sessão autenticada com Google segura por meio do Supabase Auth',
              retention: 'Até encerrar sessão ou limpar os dados do navegador',
            },
            {
              category: 'sl_locale (localStorage)',
              collectedData: 'Preferência funcional',
              processor: 'Registra o idioma selecionado manualmente pelo usuário (Español, English ou Português)',
              retention: 'Persistente até nova troca de idioma ou limpeza do navegador',
            },
            {
              category: 'Estado operacional local (localStorage)',
              collectedData: 'Continuidade de interface',
              processor: 'Guarda localmente detalhes da organização, histórico do testador Search Link IA e acompanhamento de trabalhos em andamento após recarregamentos',
              retention: 'Temporário no dispositivo até conclusão do fluxo ou limpeza dos dados do site',
            },
            {
              category: 'sl_image_bank_saved_v1 (localStorage)',
              collectedData: 'Coleção do usuário',
              processor: 'Armazena localmente no dispositivo as imagens salvas dos bancos públicos Pexels e Pixabay na seção Salvos para organizá-las antes de criar catálogos',
              retention: 'Persistente no dispositivo até você removê-las ou limpar os dados do site',
            },
          ],
        },
      },
      {
        id: 'provedores-tecnicos-e-oauth',
        number: '04',
        title: 'Provedores técnicos e fluxos de autenticação',
        paragraphs: [
          'Ao optar por entrar com Google OAuth, o Google e nosso provedor de autenticação (Supabase Auth) podem utilizar mecanismos técnicos de verificação estritamente necessários para concluir o login OAuth com segurança.',
          'O processamento de mídias, a inferência de modelos de IA e as buscas nos bancos públicos de imagens Pexels e Pixabay ocorrem no lado do servidor, sem expor rastreadores publicitários no navegador do usuário. Ao visualizar ou salvar imagens públicas, o navegador carrega os arquivos de mídia do Pexels ou Pixabay sob suas respectivas licenças públicas e créditos.',
        ],
      },
      {
        id: 'atributos-de-seguranca',
        number: '05',
        title: 'Atributos de segurança e necessidade técnica',
        paragraphs: [
          'Os cookies sl_guest_ext, sl_ia_daily e sl_img_bank_cd são configurados com a flag HttpOnly — impedindo leitura ou alteração via scripts no navegador — e assinados com HMAC-SHA256 para assegurar integridade dos limites de uso. Em conexões HTTPS, trafegam apenas por canal criptografado.',
          'Por executarem funções estritamente técnicas de segurança, autenticação e preferências solicitadas pelo próprio usuário, esses registros são indispensáveis para fornecer o serviço.',
        ],
      },
      {
        id: 'gerenciamento-e-exclusao',
        number: '06',
        title: 'Como gerenciar, bloquear ou excluir cookies e dados locais',
        paragraphs: [
          'Você pode consultar, bloquear ou apagar cookies e dados de armazenamento local a qualquer momento nas configurações de privacidade do seu navegador (Chrome, Safari, Firefox, Edge ou navegadores móveis):',
        ],
        bullets: [
          'Limpar os dados do site nas configurações do navegador remove imediatamente tanto os cookies HTTP-only quanto as chaves de localStorage.',
          'Sair da conta no Search Link revoga sua sessão autenticada ativa no navegador.',
          'Bloquear integralmente cookies essenciais pode impedir o login com Google, redefinir o idioma selecionado ou restringir o uso controlado do Search Link IA e da barra de extração.',
        ],
      },
      {
        id: 'atualizacoes-desta-politica',
        number: '07',
        title: 'Atualizações destas Políticas de cookies',
        paragraphs: [
          'Caso recursos futuros introduzam métricas opcionais ou novas categorias de armazenamento, atualizaremos este documento com a nova data e versão ao final da página antes de sua ativação.',
        ],
      },
    ],
    footerNote:
      'Search Link · Políticas de cookies. Complementam nossas Políticas de privacidade e uso e Termos e condições.',
  },
};
