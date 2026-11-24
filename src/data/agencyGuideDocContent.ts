import type { SupportedLocale } from '../lib/i18n';
import type { PrivacyPolicyDocument } from './privacyPolicyContent';

export const AGENCY_GUIDE_DOC_CONTENT: Record<
  SupportedLocale,
  PrivacyPolicyDocument
> = {
  es: {
    documentTitle: 'Cosas a tener en cuenta en Modo Agencia',
    documentCategory: 'Guía operativa de sincronización, alcance y funcionamiento de servidores',
    effectiveLabel: 'Última actualización',
    effectiveDate: '24 de noviembre de 2026',
    versionLabel: 'Versión',
    version: '1.0',
    appliesToLabel: 'Ámbito',
    appliesTo: 'Modo Agencia · Conecta tu servidor, actualizaciones y manejo multi-servicio',
    backLabel: 'Cerrar',
    tocHeading: 'Contenido del documento',
    mobileTocToggleLabel: 'Índice de secciones',
    leadSummary:
      'Esta guía explica cómo funciona en la práctica la sincronización del Modo Agencia: la diferencia entre elegir «Sincronizar todos» o un servicio específico, por qué todos los servicios de una cuenta conectada corren bajo tu servidor, la excepción del chat Search Link IA y cómo distingue tu servidor un servicio de otro sin mezclar catálogos.',
    sections: [
      {
        id: 'sincronizar-todos-vs-un-servicio',
        number: '01',
        title: 'Cómo funcionan las actualizaciones: «Sincronizar todos» vs. un solo servicio',
        paragraphs: [
          'Dentro de Conecta tu servidor puedes elegir entre sincronizar toda tu organización («Sincronizar todos») o seleccionar únicamente un servicio específico. Esa elección define cuándo envía Search Link actualizaciones automáticas hacia tu servidor:',
        ],
        table: {
          headers: [
            'Opción seleccionada',
            'Al crear un servicio nuevo',
            'Al editar un servicio existente',
            'Qué recibe tu servidor',
          ],
          rows: [
            {
              category: 'Sincronizar todos',
              collectedData: 'Se envía automáticamente a tu servidor apenas termina el mapeo.',
              processor: 'Se envía automáticamente cada vez que editas cualquier servicio.',
              retention: 'El catálogo completo actualizado de todos tus servicios.',
            },
            {
              category: 'Un servicio específico',
              collectedData: 'No se dispara envío automático para otros servicios nuevos.',
              processor: 'Se envía automáticamente solo cuando editas ese servicio específico.',
              retention: 'Únicamente la información actualizada del servicio seleccionado.',
            },
          ],
        },
      },
      {
        id: 'todos-los-servicios-corren-bajo-tu-servidor',
        number: '02',
        title: 'Por qué toda tu cuenta corre bajo tu servidor conectado',
        paragraphs: [
          'Es importante no confundir el filtro de envío automático («Sincronizar todos» o un servicio específico) con el enrutamiento de peticiones de la cuenta.',
          'En el instante en que conectas y sincronizas un servidor externo, todos los servicios de esa cuenta pasan a correr bajo tu propio servidor. Search Link bloquea las consultas externas de catálogo hacia nuestros servidores (respondiendo HTTP 403 en las APIs públicas de esa cuenta) para evitar que se mezclen consumos ni se cobren peticiones en nuestros servidores mientras operas en Modo Agencia.',
        ],
      },
      {
        id: 'excepcion-chat-search-link-ia',
        number: '03',
        title: 'La única excepción: el chat Search Link IA',
        paragraphs: [
          'Aunque conectes tu servidor externo y tus consultas de catálogo corran íntegramente desde tu infraestructura, el probador y chat Search Link IA continúa operando desde los servidores de Search Link.',
          'Esto se debe a que el chat conversacional consume modelos de lenguaje externos administrados por nuestra plataforma y mantiene su propio límite diario de mensajes por cuenta.',
        ],
      },
      {
        id: 'como-distingue-tu-servidor-cada-servicio',
        number: '04',
        title: 'Cómo distingue tu servidor un servicio de otro sin confundirse',
        paragraphs: [
          'Si administras múltiples tiendas, marcas o clientes bajo una misma cuenta en Modo Agencia, tu servidor puede separar cada catálogo con precisión matemática gracias a los identificadores que enviamos en cada webhook:',
        ],
        bullets: [
          'Cada evento firmado por POST incluye los campos event (searchlink.catalog.sync, searchlink.service.created o searchlink.service.updated), scope («all» o «single») y changed_service_id cuando un servicio puntual acaba de crearse o editarse.',
          'Dentro del arreglo servicios, cada servicio incluye su identificador único e irrepetible (id UUID y slug público, por ejemplo srv_...) junto con su arreglo independiente de productos (id, nombre, categoria, descripcion, imagen_url).',
          'Tu servidor solo necesita guardar o actualizar cada catálogo indexándolo por su slug o id; de esa manera, aunque tengas veinte servicios distintos en una sola cuenta, nunca se mezclarán los productos de un servicio con los de otro.',
          'Adicionalmente, cada envío incluye los encabezados X-SearchLink-Timestamp y X-SearchLink-Signature (HMAC-SHA256) para que valides con tu Clave secreta que la actualización proviene legítimamente de Search Link.',
        ],
      },
      {
        id: 'desconexion-y-dependencia-plan-plus',
        number: '05',
        title: 'Desconexión, continuidad de imágenes y relación con el Plan Plus',
        paragraphs: [
          'Si decides desconectar tu servidor externo o dejar de usarlo, la cuenta puede volver a operar sobre los endpoints estándar de Search Link sujetos a la cuota de tu plan vigente.',
          'Recuerda que para recibir nuevas sincronizaciones, actualizaciones automáticas y mantener activas las URLs de tus imágenes en Cloudflare R2 es indispensable conservar tu Plan Plus activo según lo explicado en Modo Agencia. El reparto de responsabilidades externas y de propiedad intelectual se rige además por Responsabilidad y propiedad en Modo Agencia, Propiedad intelectual, límites y responsabilidad, Términos y condiciones y Políticas de privacidad y uso.',
        ],
      },
    ],
    footerNote:
      'Search Link · Guía operativa de Cosas a tener en cuenta en Modo Agencia.',
  },

  en: {
    documentTitle: 'Things to Keep in Mind in Agency Mode',
    documentCategory: 'Operational Guide on Sync Behavior, Scope, and Multi-Service Routing',
    effectiveLabel: 'Last updated',
    effectiveDate: 'November 24, 2026',
    versionLabel: 'Version',
    version: '1.0',
    appliesToLabel: 'Scope',
    appliesTo: 'Agency Mode · Connect your server, auto-sync rules, and multi-service separation',
    backLabel: 'Close',
    tocHeading: 'Document contents',
    mobileTocToggleLabel: 'Section index',
    leadSummary:
      'This guide explains how Agency Mode synchronization works in practice: the difference between choosing "Sync all" or a single service, why every service in a connected account runs under your server, the Search Link AI chat exception, and how your server keeps multiple services strictly separated.',
    sections: [
      {
        id: 'sync-all-vs-single-service',
        number: '01',
        title: 'How updates work: "Sync all" vs. a specific service',
        paragraphs: [
          'Inside Connect your server, you can choose between syncing your entire organization ("Sync all") or picking one specific service. That setting controls when Search Link automatically pushes updates to your server:',
        ],
        table: {
          headers: [
            'Selected option',
            'When a new service is created',
            'When an existing service is edited',
            'Payload sent to your server',
          ],
          rows: [
            {
              category: 'Sync all',
              collectedData: 'Automatically pushed to your server as soon as mapping completes.',
              processor: 'Automatically pushed whenever any service is edited.',
              retention: 'Complete updated catalog across all your services.',
            },
            {
              category: 'Specific service',
              collectedData: 'Does not auto-push newly created services.',
              processor: 'Automatically pushed only when that specific service is edited.',
              retention: 'Only the updated data for the selected service.',
            },
          ],
        },
      },
      {
        id: 'all-account-services-under-your-server',
        number: '02',
        title: 'Why your entire account runs under your connected server',
        paragraphs: [
          'Do not confuse the automatic update filter ("Sync all" vs. one specific service) with account-level request routing.',
          'Once you connect and sync an external server, every service on that account runs under your own server. Search Link blocks public catalog reads against our servers (returning HTTP 403 on public catalog APIs for that account) so request metering and billing are never mixed within the same Agency account.',
        ],
      },
      {
        id: 'search-link-ai-chat-exception',
        number: '03',
        title: 'The single exception: Search Link AI chat',
        paragraphs: [
          'Even with an external server connected, the Search Link AI chat simulator continues running from Search Link’s own servers.',
          'Because conversational AI queries use managed language models on our infrastructure, chat traffic remains governed by its own daily message quotas per account.',
        ],
      },
      {
        id: 'how-your-server-separates-services',
        number: '04',
        title: 'How your server keeps each service separate without mix-ups',
        paragraphs: [
          'If you manage multiple stores, brands, or clients under one Agency account, your receiving server can keep every catalog strictly isolated using the identifiers included in every webhook payload:',
        ],
        bullets: [
          'Each signed POST event includes event (searchlink.catalog.sync, searchlink.service.created, or searchlink.service.updated), scope ("all" or "single"), and changed_service_id whenever a specific service was created or modified.',
          'Inside the servicios array, every service carries unique, immutable identifiers (UUID id and public slug such as srv_...) together with its own isolated list of productos (id, nombre, categoria, descripcion, imagen_url).',
          'Your server simply stores or updates each catalog keyed by slug or id, guaranteeing products from different clients or services never collide.',
          'Every delivery also includes X-SearchLink-Timestamp and X-SearchLink-Signature (HMAC-SHA256) headers so your backend can verify authenticity using your Secret Key.',
        ],
      },
      {
        id: 'disconnection-and-plus-plan',
        number: '05',
        title: 'Disconnection, image continuity, and Plus Plan requirement',
        paragraphs: [
          'If you disconnect your external server, your account can return to serving requests via Search Link’s standard endpoints subject to your active plan limits.',
          'Keep in mind that continuous updates, sync deliveries, and active Cloudflare R2 image links require an active Plus Plan as explained in Agency Mode. External server disclaimers and intellectual property boundaries are governed by Agency Mode Liability and Intellectual Property, Intellectual Property, Limits, and Liability, Terms and Conditions, and Privacy and Usage Policies.',
        ],
      },
    ],
    footerNote:
      'Search Link · Operational Guide: Things to Keep in Mind in Agency Mode.',
  },

  pt: {
    documentTitle: 'O que considerar no Modo Agência',
    documentCategory: 'Guia operacional de sincronização, escopo e separação de serviços',
    effectiveLabel: 'Última atualização',
    effectiveDate: '24 de novembro de 2026',
    versionLabel: 'Versão',
    version: '1.0',
    appliesToLabel: 'Escopo',
    appliesTo: 'Modo Agência · Conecte seu servidor, regras de atualização e múltiplos serviços',
    backLabel: 'Fechar',
    tocHeading: 'Conteúdo do documento',
    mobileTocToggleLabel: 'Índice de seções',
    leadSummary:
      'Este guia explica como funciona na prática a sincronização do Modo Agência: a diferença entre escolher "Sincronizar todos" ou um único serviço, por que todos os serviços de uma conta conectada rodam sob o seu servidor, a exceção do chat Search Link IA e como seu servidor separa cada serviço sem misturar catálogos.',
    sections: [
      {
        id: 'sincronizar-todos-vs-um-servico',
        number: '01',
        title: 'Como funcionam as atualizações: "Sincronizar todos" vs. um único serviço',
        paragraphs: [
          'Em Conecte seu servidor você pode escolher entre sincronizar toda a organização ("Sincronizar todos") ou selecionar apenas um serviço específico. Essa escolha define quando o Search Link envia atualizações automáticas ao seu servidor:',
        ],
        table: {
          headers: [
            'Opção escolhida',
            'Ao criar um novo serviço',
            'Ao editar um serviço existente',
            'O que seu servidor recebe',
          ],
          rows: [
            {
              category: 'Sincronizar todos',
              collectedData: 'Enviado automaticamente ao seu servidor assim que o mapeamento termina.',
              processor: 'Enviado automaticamente sempre que qualquer serviço é editado.',
              retention: 'Catálogo completo e atualizado de todos os seus serviços.',
            },
            {
              category: 'Um serviço específico',
              collectedData: 'Não dispara envio automático para outros serviços novos.',
              processor: 'Enviado automaticamente apenas ao editar esse serviço específico.',
              retention: 'Somente os dados atualizados do serviço selecionado.',
            },
          ],
        },
      },
      {
        id: 'todos-servicos-sob-seu-servidor',
        number: '02',
        title: 'Por que toda a conta roda sob o seu servidor conectado',
        paragraphs: [
          'É importante não confundir o filtro de atualização automática ("Sincronizar todos" ou um serviço) com o roteamento das requisições da conta.',
          'Assim que um servidor externo é conectado e sincronizado, todos os serviços daquela conta passam a rodar sob o seu próprio servidor. O Search Link bloqueia consultas externas aos nossos servidores (retornando HTTP 403 nas APIs públicas dessa conta) para evitar mistura de consumo e cobranças indevidas dentro da mesma conta.',
        ],
      },
      {
        id: 'excecao-chat-search-link-ia',
        number: '03',
        title: 'A única exceção: o chat Search Link IA',
        paragraphs: [
          'Mesmo com um servidor externo conectado, o simulador e chat Search Link IA continua rodando a partir dos servidores do Search Link.',
          'Isso ocorre porque o chat utiliza modelos de linguagem gerenciados em nossa infraestrutura e possui limites diários próprios por usuário.',
        ],
      },
      {
        id: 'como-servidor-separa-servicos',
        number: '04',
        title: 'Como seu servidor diferencia um serviço do outro sem confusão',
        paragraphs: [
          'Ao gerenciar múltiplas lojas ou clientes em uma única conta no Modo Agência, seu servidor separa cada catálogo com precisão pelos identificadores enviados em cada webhook:',
        ],
        bullets: [
          'Cada evento POST assinado traz event (searchlink.catalog.sync, searchlink.service.created ou searchlink.service.updated), scope ("all" ou "single") e changed_service_id quando um serviço foi criado ou editado.',
          'Dentro do array servicios, cada serviço possui identificadores únicos (id UUID e slug público como srv_...) junto com sua lista isolada de productos (id, nombre, categoria, descripcion, imagen_url).',
          'Basta que seu servidor salve e atualize cada catálogo usando slug ou id como chave para nunca misturar produtos de serviços diferentes.',
          'Cada envio inclui ainda os cabeçalhos X-SearchLink-Timestamp e X-SearchLink-Signature (HMAC-SHA256) para validação com sua Chave secreta.',
        ],
      },
      {
        id: 'desconexao-e-dependencia-plano-plus',
        number: '05',
        title: 'Desconexão, continuidade das imagens e Plano Plus',
        paragraphs: [
          'Se você desconectar seu servidor externo, a conta poderá voltar a utilizar os endpoints padrão do Search Link conforme os limites do seu plano atual.',
          'Lembre-se de que atualizações, novas sincronizações e a disponibilidade das URLs de imagens no Cloudflare R2 dependem da manutenção ativa do Plano Plus, conforme descrito em Modo Agência. As regras de isenção e propriedade intelectual constam em Responsabilidade e propriedade no Modo Agência, Propriedade intelectual, limites e responsabilidade, Termos e condições e Políticas de privacidade e uso.',
        ],
      },
    ],
    footerNote:
      'Search Link · Guia operacional: O que considerar no Modo Agência.',
  },
};
