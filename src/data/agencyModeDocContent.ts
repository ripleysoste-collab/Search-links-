import type { SupportedLocale } from '../lib/i18n';
import type { PrivacyPolicyDocument } from './privacyPolicyContent';

export const AGENCY_MODE_DOC_CONTENT: Record<SupportedLocale, PrivacyPolicyDocument> = {
  es: {
    documentTitle: 'Modo Agencia',
    documentCategory: 'Documentación oficial de arquitectura operativa',
    effectiveLabel: 'Última actualización',
    effectiveDate: '22 de noviembre de 2026',
    versionLabel: 'Versión',
    version: '1.0',
    appliesToLabel: 'Ámbito',
    appliesTo: 'Search Link · Agencias y Desarrolladores (Plan Plus)',
    backLabel: 'Cerrar',
    tocHeading: 'Contenido del documento',
    mobileTocToggleLabel: 'Índice de secciones',
    leadSummary:
      'El Modo Agencia permite a agencias y desarrolladores conectar su propio servidor a Search Link en pocos minutos para responder consultas de catálogos directamente desde su infraestructura, ahorrándose el consumo de peticiones sin renunciar a nuestro alojamiento multimedia, compresión ni mapeo inteligente.',
    sections: [
      {
        id: 'que-es-el-modo-agencia',
        number: '01',
        title: 'Qué es el Modo Agencia',
        paragraphs: [
          'El Modo Agencia es una modalidad diseñada para agencias digitales, equipos técnicos y desarrolladores que administran catálogos para uno o varios clientes y ya cuentan con su propio servidor o entorno de ejecución.',
          'En lugar de que cada pregunta o búsqueda de tus clientes viaje hasta los servidores de Search Link cada vez que se consulta un producto, el Modo Agencia sincroniza la información de tus catálogos con tu servidor. De esa forma, tus bots, tiendas o aplicaciones responden al instante desde tu propia infraestructura, mientras Search Link sigue encargándose de la parte pesada: extraer, comprimir, alojar tus imágenes en R2 y mapear cada producto con inteligencia artificial.',
        ],
      },
      {
        id: 'objetivo-del-modo-agencia',
        number: '02',
        title: 'Objetivo del Modo Agencia',
        paragraphs: [
          'El objetivo principal es que puedas escalar tus proyectos y atender a tus clientes con total tranquilidad, eliminando el miedo a que un pico de tráfico o miles de mensajes diarios disparen el conteo de peticiones o agoten una cuota mensual.',
          'Queremos que cualquier agencia o desarrollador pueda aprovechar la potencia de Search Link como su motor de preparación de catálogos, conectando su propio servidor de forma sencilla en un par de minutos y reduciendo drásticamente el costo recurrente operativo.',
        ],
        bullets: [
          'Atender altos volúmenes de consultas desde tu propio servidor sin consumir peticiones en nuestra plataforma.',
          'Centralizar en Search Link la optimización WebP, el alojamiento en R2 y el mapeo automático de productos.',
          'Facilitar que agencias gestionen múltiples catálogos comerciales con costos predecibles y estables.',
        ],
      },
      {
        id: 'que-implica-y-ahorro',
        number: '03',
        title: 'Qué implica y diferencia frente al Plan Plus normal',
        paragraphs: [
          'Tanto el uso estándar como el Modo Agencia pertenecen al mismo Plan Plus. La diferencia no está en un plan distinto ni en perder capacidades, sino en dónde se atienden las consultas diarias de tus usuarios finales.',
          'En el modo estándar, Search Link se encarga de todo: alojamiento en R2, mapeo con IA, nuestra base de datos y la atención directa de cada petición que hacen tus bots o aplicaciones. En el Modo Agencia sigues cubriendo tu suscripción Plus y el almacenamiento correspondiente para mantener vivas tus imágenes en R2 y tus mapeos, pero al mover el tráfico de consultas a tu propio servidor te ahorras por completo el costo recurrente de las peticiones.',
        ],
        table: {
          headers: [
            'Concepto',
            'Plan Plus normal',
            'Plan Plus + Modo Agencia',
            'Impacto para tu proyecto',
          ],
          rows: [
            {
              category: 'Alojamiento de imágenes (R2) y mapeo IA',
              collectedData: 'Incluido y gestionado en Search Link',
              processor: 'Incluido y gestionado en Search Link',
              retention: 'Sin cambios: mantienes la calidad, compresión y CDN.',
            },
            {
              category: 'Base de datos y panel de organización',
              collectedData: 'Administrado desde tu cuenta Search Link',
              processor: 'Administrado desde tu cuenta Search Link',
              retention: 'Misma interfaz para crear, editar y organizar catálogos.',
            },
            {
              category: 'Peticiones y consultas de catálogos',
              collectedData: 'Las atiende y contabiliza el servidor de Search Link',
              processor: 'Las atiende directamente tu propio servidor',
              retention: 'Ahorro masivo: cero consumo ni cobro por peticiones.',
            },
            {
              category: 'Configuración inicial',
              collectedData: 'Lista al instante con URL y clave API',
              processor: 'Conexión rápida de tu servidor en pocos minutos',
              retention: 'Ideal cuando ya tienes servidor y buscas escalar sin límites.',
            },
          ],
        },
      },
      {
        id: 'como-se-activa-y-requisitos',
        number: '04',
        title: 'Cómo se activa y requisitos para mantenerlo',
        paragraphs: [
          'Activar el Modo Agencia es un proceso simple pensado para que no pierdas horas en configuraciones complejas:',
        ],
        bullets: [
          'Contar con una suscripción activa en el Plan Plus dentro de Search Link.',
          'Tener al día el almacenamiento asignado a tus catálogos para cubrir el mantenimiento continuo de tus archivos en Cloudflare R2.',
          'Habilitar el Modo Agencia desde la configuración correspondiente en tu cuenta y registrar el enlace de tu servidor receptor para sincronizar tus catálogos.',
          'Mantener tu servidor disponible para recibir las actualizaciones cuando crees o modifiques un catálogo.',
        ],
      },
      {
        id: 'limitaciones-y-suspension',
        number: '05',
        title: 'Limitaciones y condiciones de permanencia',
        paragraphs: [
          'Es muy importante entender qué cubre y qué exige el Modo Agencia para evitar malentendidos operativos. Que las peticiones corran en tu propio servidor no significa que la plataforma funcione sin suscripción ni mantenimiento.',
          'Para que el sistema opere correctamente, debes mantener activo tu Plan Plus y al día el pago correspondiente al almacenamiento de tus catálogos y mantenimiento de R2. Si se deja de pagar el Plan Plus o se cancela la suscripción, se aplicarán de inmediato las siguientes medidas:',
        ],
        bullets: [
          'Retiro y suspensión de las URLs de tus imágenes alojadas en R2: los enlaces de imágenes dejarán de cargar en tus catálogos y aplicaciones.',
          'Bloqueo de nuevas sincronizaciones y actualizaciones: tu servidor dejará de recibir cambios, nuevos productos o mapeos realizados en la plataforma.',
          'Interrupción operativa del sistema: sin el respaldo activo de las imágenes en R2 ni las actualizaciones del servicio, el sistema no podrá funcionar en tus servidores hasta que la suscripción vuelva a estar activa.',
          'El Modo Agencia no permite transferir ni perpetuar de forma gratuita los recursos alojados en Search Link fuera de una suscripción vigente.',
        ],
      },
    ],
    footerNote:
      'Search Link · Modo Agencia. Consulta los límites sobre servidores externos, clientes finales y actualizaciones en Responsabilidad y propiedad en Modo Agencia, así como nuestros Términos y condiciones y Propiedad intelectual, límites y responsabilidad.',
  },
  en: {
    documentTitle: 'Agency Mode',
    documentCategory: 'Official operational architecture documentation',
    effectiveLabel: 'Last updated',
    effectiveDate: 'November 22, 2026',
    versionLabel: 'Version',
    version: '1.0',
    appliesToLabel: 'Scope',
    appliesTo: 'Search Link · Agencies & Developers (Plus Plan)',
    backLabel: 'Close',
    tocHeading: 'Document contents',
    mobileTocToggleLabel: 'Section index',
    leadSummary:
      'Agency Mode lets agencies and developers connect their own server to Search Link in just a few minutes so catalog queries are answered directly from their infrastructure, saving recurring API request volume while keeping our media hosting, compression, and AI mapping.',
    sections: [
      {
        id: 'what-is-agency-mode',
        number: '01',
        title: 'What Agency Mode is',
        paragraphs: [
          'Agency Mode is an operating option designed for digital agencies, technical teams, and developers who manage product catalogs for one or more clients and already run their own server.',
          'Instead of sending every end-user search or chatbot message back to Search Link servers, Agency Mode syncs your prepared catalog data with your server. Your bots, storefronts, or apps respond locally from your infrastructure, while Search Link continues handling extraction, WebP compression, R2 image hosting, and AI catalog mapping.',
        ],
      },
      {
        id: 'agency-mode-goal',
        number: '02',
        title: 'Goal of Agency Mode',
        paragraphs: [
          'Our goal is to help agencies and developers scale confidently across many clients without worrying about high-traffic days exhausting monthly request limits or triggering unpredictable per-request bills.',
          'By separating catalog creation and media hosting from everyday read traffic, you can connect your server in a couple of minutes and dramatically reduce recurring request costs.',
        ],
        bullets: [
          'Serve high-volume catalog queries directly from your own server with zero API request consumption on our end.',
          'Keep WebP image optimization, R2 storage, and AI product mapping centralized inside Search Link.',
          'Scale multiple client catalogs under predictable, stable storage and subscription costs.',
        ],
      },
      {
        id: 'what-it-implies-and-savings',
        number: '03',
        title: 'How it compares to standard Plus Plan usage',
        paragraphs: [
          'Both standard usage and Agency Mode belong to the exact same Plus Plan. The difference is simply where your everyday customer queries are answered.',
          'On the standard Plus setup, Search Link handles everything: R2 image storage, AI mapping, database hosting, and serving every live API request. With Agency Mode, you stay on the Plus Plan and continue paying your corresponding storage and maintenance allocation for R2 and AI mapping—while completely eliminating recurring request usage because queries run on your server.',
        ],
        table: {
          headers: [
            'Area',
            'Standard Plus Plan',
            'Plus Plan + Agency Mode',
            'What it means for you',
          ],
          rows: [
            {
              category: 'R2 image hosting & AI mapping',
              collectedData: 'Included and managed by Search Link',
              processor: 'Included and managed by Search Link',
              retention: 'Unchanged: full image quality, compression, and CDN.',
            },
            {
              category: 'Catalog management dashboard',
              collectedData: 'Managed inside your Search Link account',
              processor: 'Managed inside your Search Link account',
              retention: 'Same workflow to create, edit, and organize catalogs.',
            },
            {
              category: 'Catalog API requests & queries',
              collectedData: 'Served and metered by Search Link servers',
              processor: 'Served directly by your own server',
              retention: 'Massive savings: zero request usage or request billing.',
            },
            {
              category: 'Setup effort',
              collectedData: 'Ready instantly with endpoint URL and key',
              processor: 'Quick server connection in a few minutes',
              retention: 'Built for agencies wanting unlimited local traffic.',
            },
          ],
        },
      },
      {
        id: 'activation-and-requirements',
        number: '04',
        title: 'How to activate and keep it running',
        paragraphs: [
          'Enabling Agency Mode is straightforward and designed to take only a few minutes:',
        ],
        bullets: [
          'Maintain an active Plus Plan subscription on your Search Link account.',
          'Keep your corresponding storage allocation active to cover ongoing R2 image hosting and maintenance.',
          'Enable Agency Mode in your account settings and connect your receiving server URL to sync catalog data.',
          'Keep your server reachable whenever you create or update catalogs so updates arrive promptly.',
        ],
      },
      {
        id: 'limitations-and-nonpayment',
        number: '05',
        title: 'Limitations and subscription requirements',
        paragraphs: [
          'Agency Mode relies on an active Plus Plan and storage maintenance. Serving queries from your own server does not turn Search Link into a free or standalone offline system.',
          'If your Plus Plan subscription or storage payment is canceled, expires, or stops being paid, the following measures apply immediately:',
        ],
        bullets: [
          'Removal and suspension of R2 image URLs: hosted product images will stop loading across your catalogs and connected apps.',
          'Suspension of all catalog updates and sync events: your server will stop receiving updates, edits, or newly mapped catalogs.',
          'Service stoppage on connected servers: without active R2 image links and ongoing synchronization, the integration will not work for your servers until your Plus subscription is active again.',
        ],
      },
    ],
    footerNote:
      'Search Link · Agency Mode. Review external server boundaries, end-client disclaimers, and update dependencies in Agency Mode Liability and Intellectual Property, as well as our Terms and Conditions and Intellectual Property, Limits, and Liability.',
  },
  pt: {
    documentTitle: 'Modo Agência',
    documentCategory: 'Documentação oficial de arquitetura operacional',
    effectiveLabel: 'Última atualização',
    effectiveDate: '22 de novembro de 2026',
    versionLabel: 'Versão',
    version: '1.0',
    appliesToLabel: 'Escopo',
    appliesTo: 'Search Link · Agências e Desenvolvedores (Plano Plus)',
    backLabel: 'Fechar',
    tocHeading: 'Conteúdo do documento',
    mobileTocToggleLabel: 'Índice de seções',
    leadSummary:
      'O Modo Agência permite que agências e desenvolvedores conectem seu próprio servidor ao Search Link em poucos minutos para responder às consultas de catálogos diretamente de sua infraestrutura, economizando o consumo de requisições sem abrir mão da nossa hospedagem de mídia, compressão e mapeamento com IA.',
    sections: [
      {
        id: 'o-que-e-modo-agencia',
        number: '01',
        title: 'O que é o Modo Agência',
        paragraphs: [
          'O Modo Agência é uma modalidade criada para agências digitais, equipes técnicas e desenvolvedores que gerenciam catálogos para um ou vários clientes e já possuem servidor próprio.',
          'Em vez de enviar cada consulta dos seus clientes até os servidores do Search Link, o Modo Agência sincroniza os dados preparados dos seus catálogos com o seu servidor. Assim, seus bots, lojas ou aplicativos respondem instantaneamente pela sua própria infraestrutura, enquanto o Search Link continua cuidando da extração, compressão WebP, hospedagem das imagens no R2 e mapeamento com inteligência artificial.',
        ],
      },
      {
        id: 'objetivo-do-modo-agencia',
        number: '02',
        title: 'Objetivo do Modo Agência',
        paragraphs: [
          'O objetivo é permitir que agências e desenvolvedores cresçam e atendam muitos clientes com tranquilidade, sem medo de picos de tráfego estourarem limites mensais ou gerarem custos imprevisíveis por requisição.',
          'Ao conectar seu servidor em poucos minutos, você reduz drasticamente o custo recorrente operacional mantendo toda a praticidade do Search Link.',
        ],
        bullets: [
          'Atender altos volumes de busca diretamente no seu servidor sem gastar requisições na nossa plataforma.',
          'Manter otimização WebP, armazenamento no R2 e mapeamento automático com IA centralizados no Search Link.',
          'Gerenciar múltiplos catálogos de clientes com custos previsíveis e estáveis.',
        ],
      },
      {
        id: 'diferenca-e-economia',
        number: '03',
        title: 'O que implica e diferença para o Plano Plus normal',
        paragraphs: [
          'Tanto o uso padrão quanto o Modo Agência fazem parte do mesmo Plano Plus. A diferença está apenas em onde as consultas diárias dos usuários finais são respondidas.',
          'No modo padrão, o Search Link cuida de tudo: armazenamento R2, mapeamento com IA, banco de dados e atendimento direto de cada requisição. No Modo Agência, você continua mantendo sua assinatura Plus e o pagamento de armazenamento correspondente ao R2 e mapeamento, mas como o tráfego de consultas roda no seu servidor, você economiza integralmente o consumo de requisições.',
        ],
        table: {
          headers: [
            'Item',
            'Plano Plus normal',
            'Plano Plus + Modo Agência',
            'Impacto no seu projeto',
          ],
          rows: [
            {
              category: 'Hospedagem no R2 e mapeamento com IA',
              collectedData: 'Incluído e gerenciado no Search Link',
              processor: 'Incluído e gerenciado no Search Link',
              retention: 'Sem mudanças: qualidade, compressão e CDN mantidos.',
            },
            {
              category: 'Painel e organização de catálogos',
              collectedData: 'Gerenciado na sua conta Search Link',
              processor: 'Gerenciado na sua conta Search Link',
              retention: 'Mesma interface para criar e editar catálogos.',
            },
            {
              category: 'Requisições e consultas de catálogo',
              collectedData: 'Atendidas e contabilizadas pelo Search Link',
              processor: 'Atendidas diretamente pelo seu servidor',
              retention: 'Economia massiva: zero consumo ou cobrança por requisição.',
            },
            {
              category: 'Configuração',
              collectedData: 'Pronta na hora com URL e chave API',
              processor: 'Conexão rápida do seu servidor em minutos',
              retention: 'Ideal para escalar sem limite de tráfego local.',
            },
          ],
        },
      },
      {
        id: 'ativacao-e-requisitos',
        number: '04',
        title: 'Como ativar e requisitos para manter ativo',
        paragraphs: [
          'Ativar o Modo Agência é direto e pensado para levar apenas alguns minutos:',
        ],
        bullets: [
          'Ter uma assinatura ativa no Plano Plus no Search Link.',
          'Manter em dia o pagamento do armazenamento correspondente para sustentar a hospedagem contínua no Cloudflare R2.',
          'Ativar o Modo Agência nas configurações da conta e informar o endereço do seu servidor para receber a sincronização.',
          'Manter seu servidor acessível para receber atualizações sempre que um catálogo for criado ou editado.',
        ],
      },
      {
        id: 'limitacoes-e-suspensao',
        number: '05',
        title: 'Limitações e suspensão por falta de pagamento',
        paragraphs: [
          'O Modo Agência depende obrigatoriamente de uma assinatura Plus ativa e da manutenção do armazenamento em R2. Responder consultas no seu servidor não torna o serviço gratuito nem independente da assinatura.',
          'Caso o pagamento do Plano Plus ou do armazenamento correspondente seja cancelado ou interrompido, aplicam-se imediatamente as seguintes medidas:',
        ],
        bullets: [
          'Remoção e suspensão das URLs de imagens no R2: os links das imagens deixam de carregar nos catálogos e aplicativos.',
          'Interrupção total de novas sincronizações e atualizações: seu servidor deixa de receber alterações e novos mapeamentos.',
          'Paralisação do funcionamento nos seus servidores: sem as imagens ativas no R2 e sem sincronização, o sistema não funcionará até a regularização do Plano Plus.',
        ],
      },
    ],
    footerNote:
      'Search Link · Modo Agência. Consulte os limites sobre servidores externos, clientes finais e atualizações em Responsabilidade e propriedade no Modo Agência, além dos nossos Termos e condições e Propriedade intelectual, limites e responsabilidade.',
  },
};
