import type { SupportedLocale } from '../lib/i18n';
import type { PrivacyPolicyDocument } from './privacyPolicyContent';

export const AGENCY_LIABILITY_DOC_CONTENT: Record<
  SupportedLocale,
  PrivacyPolicyDocument
> = {
  es: {
    documentTitle: 'Responsabilidad y propiedad en Modo Agencia',
    documentCategory: 'Delimitación operativa, responsabilidad externa y propiedad intelectual',
    effectiveLabel: 'Última actualización',
    effectiveDate: '24 de noviembre de 2026',
    versionLabel: 'Versión',
    version: '1.0',
    appliesToLabel: 'Ámbito',
    appliesTo: 'Modo Agencia · Servidores externos conectados, clientes finales y Plan Plus',
    backLabel: 'Cerrar',
    tocHeading: 'Contenido del documento',
    mobileTocToggleLabel: 'Índice de secciones',
    leadSummary:
      'Este documento define con precisión hasta dónde llega la responsabilidad de Search Link dentro del Modo Agencia, establece nuestra exención total frente a caídas de servidores externos y cualquier atención realizada a clientes finales fuera de nuestra infraestructura, separa la propiedad intelectual de la agencia frente a la de Search Link, y detalla la dependencia directa del Plan Plus para recibir actualizaciones.',
    sections: [
      {
        id: 'alcance-responsabilidad-search-link',
        number: '01',
        title: 'Hasta dónde llega la responsabilidad de Search Link',
        paragraphs: [
          'Dentro del Modo Agencia, la responsabilidad de Search Link comienza y termina exclusivamente en los procesos ejecutados dentro de nuestra plataforma: optimizar y convertir imágenes a formato WebP, alojarlas en Cloudflare R2 mientras exista una suscripción activa, mapear cada producto mediante inteligencia artificial y emitir el envío de sincronización firmado hacia el servidor configurado por el usuario.',
          'Una vez que Search Link entrega el paquete de sincronización al enlace configurado en Conecta tu servidor, nuestra intervención técnica concluye por completo. Las condiciones operativas generales de la plataforma se rigen de forma conjunta por nuestros Términos y condiciones y por el documento de Modo Agencia.',
        ],
      },
      {
        id: 'exencion-caidas-servidores-externos',
        number: '02',
        title: 'Exención total por caídas y fallos de servidores externos',
        paragraphs: [
          'Search Link no aloja, administra ni supervisa la infraestructura externa conectada por agencias o desarrolladores. En consecuencia, Search Link no asume responsabilidad alguna por interrupciones, pérdidas ni incidentes originados en servidores de terceros o propios del usuario:',
        ],
        bullets: [
          'Caídas, reinicios inesperados, saturación de memoria o CPU, vencimiento de certificados SSL o cortes de red en tu servidor externo o proveedor de nube.',
          'Pérdida, sobrescritura o eliminación accidental de catálogos almacenados en la base de datos local de tu servidor externo.',
          'Errores de implementación al validar la firma X-SearchLink-Signature, bloqueos de firewall, límites de tiempo de espera (timeouts) o brechas de seguridad en tu infraestructura.',
          'Sincronizaciones que no logren entregarse mientras el servidor receptor permanezca apagado, inaccesible o con errores internos HTTP.',
        ],
      },
      {
        id: 'exencion-clientes-atendidos-por-externo',
        number: '03',
        title: 'Exención total por clientes atendidos desde un servidor externo',
        paragraphs: [
          'Cuando una agencia, comercio o desarrollador utiliza los datos sincronizados para responder consultas, operar chatbots o atender compradores finales desde su propio servidor externo, toda relación jurídica, comercial y operativa se establece únicamente entre el operador de dicho servidor externo y sus clientes.',
          'Search Link no se hace responsable bajo ninguna circunstancia de lo que ocurra con un cliente atendido por un servidor externo. Esto abarca reclamos de consumidores finales, precios o inventarios desactualizados en el servidor externo, fallos en respuestas automáticas externas, incumplimientos comerciales, pagos, devoluciones o cualquier daño directo o indirecto derivado de la atención brindada fuera de Search Link.',
        ],
      },
      {
        id: 'propiedad-intelectual-agencia-vs-search-link',
        number: '04',
        title: 'Propiedad intelectual: qué pertenece al usuario y qué pertenece a Search Link',
        paragraphs: [
          'El uso del Modo Agencia mantiene intacta la frontera de titularidad intelectual entre lo que aporta y opera el usuario y la tecnología desarrollada por Search Link:',
        ],
        table: {
          headers: [
            'Activo o componente',
            'Titular exclusivo',
            'Alcance de derechos',
            'Condición aplicable',
          ],
          rows: [
            {
              category: 'Catálogos, marcas, descripciones propias e imágenes legítimas',
              collectedData: 'Usuario o Agencia',
              processor: 'Propiedad íntegra sobre los datos comerciales de tu negocio o clientes.',
              retention: 'Sujeto a las garantías de licencia de Propiedad intelectual, límites y responsabilidad.',
            },
            {
              category: 'Código, base de datos y clientes de tu servidor externo',
              collectedData: 'Usuario o Agencia',
              processor: 'Control exclusivo sobre tu servidor receptor, lógica y cartera de clientes.',
              retention: 'Operación y riesgo 100% del titular del servidor externo.',
            },
            {
              category: 'Motor IA, compresión WebP, web, Core APIs y marca Search Link',
              collectedData: 'Search Link',
              processor: 'Propiedad intelectual exclusiva sobre software, esquemas y arquitectura.',
              retention: 'Sin cesión de código fuente ni licencia independiente perpetua.',
            },
            {
              category: 'Actualizaciones de plataforma, mejoras y sincronización continua',
              collectedData: 'Search Link',
              processor: 'Nuevas versiones, mejoras de mapeo, parches y envío automático de cambios.',
              retention: 'Disponible exclusivamente con Plan Plus activo y almacenamiento al día.',
            },
          ],
        },
      },
      {
        id: 'actualizaciones-y-dependencia-plan-plus',
        number: '05',
        title: 'Actualizaciones de Search Link y dependencia directa del Plan Plus',
        paragraphs: [
          'Todas las actualizaciones de software, mejoras del motor de mapeo, mantenimiento de CDN/R2, correcciones técnicas y el flujo continuo de sincronización hacia servidores externos pertenecen a Search Link y dependen directamente de que la cuenta mantenga activo su Plan Plus y el almacenamiento correspondiente al día.',
          'Aunque los datos previamente guardados en tu servidor propio sigan bajo tu gestión local, si la suscripción del Plan Plus vence, se cancela o presenta impago, Search Link suspenderá de inmediato el acceso a las URLs de imágenes alojadas en R2, detendrá las actualizaciones de plataforma y bloqueará nuevas sincronizaciones hacia tu servidor, conforme a lo establecido en Modo Agencia.',
        ],
      },
      {
        id: 'indemnidad-e-independencia',
        number: '06',
        title: 'Indemnidad frente a terceros y relación independiente',
        paragraphs: [
          'El titular de la cuenta y del servidor externo acepta defender, indemnizar y mantener indemne a Search Link ante cualquier demanda, queja administrativa, sanción o reclamo presentado por sus clientes finales, socios comerciales o terceros en relación con operaciones ejecutadas desde su servidor externo o con infracciones a nuestras Políticas de contenido.',
          'La conexión técnica mediante Modo Agencia no crea sociedad comercial, franquicia, representación legal ni responsabilidad solidaria entre Search Link y la agencia usuaria. Todo tratamiento de datos personales dentro de nuestra plataforma se rige además por nuestras Políticas de privacidad y uso.',
        ],
      },
    ],
    footerNote:
      'Search Link · Responsabilidad y propiedad en Modo Agencia. Consulta además nuestra guía operativa Cosas a tener en cuenta en Modo Agencia.',
  },

  en: {
    documentTitle: 'Agency Mode Liability and Intellectual Property',
    documentCategory: 'Operational Boundaries, External Server Disclaimers, and Ownership',
    effectiveLabel: 'Last updated',
    effectiveDate: 'November 24, 2026',
    versionLabel: 'Version',
    version: '1.0',
    appliesToLabel: 'Scope',
    appliesTo: 'Agency Mode · Connected external servers, end clients, and Plus Plan',
    backLabel: 'Close',
    tocHeading: 'Document contents',
    mobileTocToggleLabel: 'Section index',
    leadSummary:
      'This document defines the exact boundaries of Search Link’s responsibility under Agency Mode, establishes full liability disclaimers for external server outages and end clients served outside our infrastructure, separates agency ownership from Search Link intellectual property, and explains how ongoing updates depend on an active Plus Plan.',
    sections: [
      {
        id: 'scope-of-search-link-responsibility',
        number: '01',
        title: 'Where Search Link responsibility begins and ends',
        paragraphs: [
          'In Agency Mode, Search Link’s technical responsibility begins and ends strictly with the operations executed inside our own platform: optimizing and converting images into WebP, hosting them on Cloudflare R2 while an active subscription is maintained, running AI catalog mapping, and dispatching signed synchronization events to the server URL you configured.',
          'The moment Search Link delivers synchronization payloads to your external server endpoint, our technical role concludes. General platform rules also apply together with our Terms and Conditions and the Agency Mode documentation.',
        ],
      },
      {
        id: 'external-server-outages-disclaimer',
        number: '02',
        title: 'No liability for external server outages or failures',
        paragraphs: [
          'Search Link does not host, administer, or guarantee the uptime of external servers connected by agencies or developers. Accordingly, Search Link assumes zero responsibility for failures, downtime, or incidents occurring on external infrastructure:',
        ],
        bullets: [
          'Outages, unexpected restarts, CPU/memory exhaustion, expired SSL certificates, or network disruptions on your external server or cloud host.',
          'Loss, corruption, or accidental deletion of catalog data stored inside your external server’s local database after delivery.',
          'Implementation bugs when verifying X-SearchLink-Signature headers, firewall blocks, response timeouts, or security vulnerabilities on your external server.',
          'Missed or delayed synchronization events whenever your receiving server is offline, unreachable, or returning HTTP errors.',
        ],
      },
      {
        id: 'end-clients-served-externally-disclaimer',
        number: '03',
        title: 'No liability for end clients served by an external server',
        paragraphs: [
          'Whenever an agency, merchant, or developer uses synchronized catalog data to answer queries, power chatbots, or serve end consumers from their own external server, every commercial, legal, and customer-service relationship exists solely between the external server operator and its clients.',
          'Search Link accepts zero liability for anything that happens with an end client served by an external server, including consumer disputes, outdated prices or stock on your external server, external chatbot errors, unfulfilled commercial promises, payments, refunds, or financial losses arising outside Search Link.',
        ],
      },
      {
        id: 'ip-agency-vs-search-link',
        number: '04',
        title: 'Intellectual property: what belongs to you vs. what belongs to Search Link',
        paragraphs: [
          'Using Agency Mode preserves a clear intellectual property boundary between user-owned business assets and Search Link’s proprietary platform:',
        ],
        table: {
          headers: [
            'Asset or component',
            'Exclusive owner',
            'Scope of rights',
            'Governing condition',
          ],
          rows: [
            {
              category: 'Catalogs, brand names, descriptions, and licensed product media',
              collectedData: 'User or Agency',
              processor: 'Full ownership and commercial control over your legitimate business inventories.',
              retention: 'Subject to licensing warranties in Intellectual Property, Limits, and Liability.',
            },
            {
              category: 'Your external server codebase, database, and end-client relationships',
              collectedData: 'User or Agency',
              processor: 'Complete autonomy over your receiving server, integrations, and customer base.',
              retention: '100% operated and borne at the external operator’s sole risk.',
            },
            {
              category: 'AI mapping engine, WebP pipeline, Core APIs, and Search Link brand',
              collectedData: 'Search Link',
              processor: 'Exclusive intellectual property over platform source code, schemas, and design.',
              retention: 'No transfer of source code or perpetual standalone license.',
            },
            {
              category: 'Platform updates, improvements, and ongoing sync delivery',
              collectedData: 'Search Link',
              processor: 'Continuous software releases, mapping upgrades, security patches, and sync events.',
              retention: 'Available exclusively with an active Plus Plan and current storage allocation.',
            },
          ],
        },
      },
      {
        id: 'updates-and-plus-plan-dependency',
        number: '05',
        title: 'Platform updates and mandatory Plus Plan dependency',
        paragraphs: [
          'All platform updates, AI mapping improvements, Cloudflare R2 media CDN upkeep, security fixes, and continuous synchronization pipelines belong exclusively to Search Link and depend directly on maintaining an active Plus Plan subscription and storage allocation.',
          'Even if previously synced records remain locally on your server, if your Plus Plan subscription expires, is canceled, or goes unpaid, Search Link will immediately disable hosted R2 image links, stop platform updates, and suspend new synchronization deliveries as described in Agency Mode.',
        ],
      },
      {
        id: 'indemnification-and-independence',
        number: '06',
        title: 'Indemnification and independent relationship',
        paragraphs: [
          'You agree to defend, indemnify, and hold Search Link harmless from any claim, regulatory complaint, fine, or demand brought by your end clients, commercial partners, or third parties arising out of operations run on your external server or breaches of our Content Policies.',
          'Connecting an external server through Agency Mode creates no partnership, joint venture, franchise, fiduciary agency, or joint liability between Search Link and your agency. Personal data handled inside our platform remains governed by our Privacy and Usage Policies.',
        ],
      },
    ],
    footerNote:
      'Search Link · Agency Mode Liability and Intellectual Property. See also our operational guide Things to Keep in Mind in Agency Mode.',
  },

  pt: {
    documentTitle: 'Responsabilidade e propriedade no Modo Agência',
    documentCategory: 'Delimitação operacional, isenção externa e propriedade intelectual',
    effectiveLabel: 'Última atualização',
    effectiveDate: '24 de novembro de 2026',
    versionLabel: 'Versão',
    version: '1.0',
    appliesToLabel: 'Escopo',
    appliesTo: 'Modo Agência · Servidores externos conectados, clientes finais e Plano Plus',
    backLabel: 'Fechar',
    tocHeading: 'Conteúdo do documento',
    mobileTocToggleLabel: 'Índice de seções',
    leadSummary:
      'Este documento define até onde vai a responsabilidade do Search Link dentro do Modo Agência, estabelece isenção total diante de quedas de servidores externos e atendimentos a clientes finais fora da nossa infraestrutura, separa a propriedade intelectual da agência e a do Search Link e detalha a dependência do Plano Plus para receber atualizações.',
    sections: [
      {
        id: 'alcance-responsabilidade-search-link',
        number: '01',
        title: 'Até onde vai a responsabilidade do Search Link',
        paragraphs: [
          'No Modo Agência, a responsabilidade técnica do Search Link limita-se estritamente aos processos executados em nossa plataforma: otimizar imagens em formato WebP, hospedá-las no Cloudflare R2 enquanto houver assinatura ativa, realizar o mapeamento com IA e enviar o evento de sincronização assinado para a URL configurada por você.',
          'No instante em que o Search Link envia a sincronização para o seu servidor externo, encerra-se nossa atuação técnica. As regras gerais aplicáveis constam também em nossos Termos e condições e na documentação de Modo Agência.',
        ],
      },
      {
        id: 'isencao-quedas-servidores-externos',
        number: '02',
        title: 'Isenção total por quedas e falhas de servidores externos',
        paragraphs: [
          'O Search Link não hospeda, monitora nem garante a disponibilidade de servidores externos conectados por agências ou desenvolvedores. Assim, o Search Link não responde por:',
        ],
        bullets: [
          'Quedas, reinicializações, sobrecarga de recursos, certificados SSL vencidos ou falhas de rede no servidor externo.',
          'Perda, corrupção ou exclusão acidental de catálogos no banco de dados próprio do servidor externo após a entrega.',
          'Erros na validação da assinatura X-SearchLink-Signature, bloqueios de firewall, timeouts ou falhas de segurança na sua infraestrutura.',
          'Sincronizações não entregues enquanto o servidor receptor estiver desligado ou inacessível.',
        ],
      },
      {
        id: 'isencao-clientes-atendidos-por-externo',
        number: '03',
        title: 'Isenção total por clientes atendidos por um servidor externo',
        paragraphs: [
          'Quando uma agência, loja ou desenvolvedor utiliza os catálogos sincronizados para atender consumidores finais a partir do seu próprio servidor externo, toda relação comercial e de atendimento ocorre exclusivamente entre o operador desse servidor externo e seus clientes.',
          'O Search Link não assume qualquer responsabilidade pelo que acontecer com um cliente final atendido por um servidor externo, incluindo erros de preço ou estoque no servidor próprio, falhas em chatbots externos, promessas comerciais, pagamentos, reembolsos ou prejuízos decorrentes de atendimento fora do Search Link.',
        ],
      },
      {
        id: 'propriedade-intelectual-agencia-vs-search-link',
        number: '04',
        title: 'Propriedade intelectual: o que pertence ao usuário e o que pertence ao Search Link',
        paragraphs: [
          'O Modo Agência preserva uma divisão clara entre os ativos da agência/usuário e a tecnologia proprietária do Search Link:',
        ],
        table: {
          headers: [
            'Ativo ou componente',
            'Titular exclusivo',
            'Alcance de direitos',
            'Condição aplicável',
          ],
          rows: [
            {
              category: 'Catálogos, marcas, descrições próprias e imagens legítimas',
              collectedData: 'Usuário ou Agência',
              processor: 'Propriedade integral sobre seus dados comerciais e inventários.',
              retention: 'Sujeito às garantias de Propriedade intelectual, limites e responsabilidade.',
            },
            {
              category: 'Código, banco de dados e clientes do servidor externo',
              collectedData: 'Usuário ou Agência',
              processor: 'Controle exclusivo sobre sua infraestrutura receptora e carteira de clientes.',
              retention: 'Operação e risco 100% do operador do servidor externo.',
            },
            {
              category: 'Motor de IA, compressão WebP, web, Core APIs e marca Search Link',
              collectedData: 'Search Link',
              processor: 'Propriedade intelectual exclusiva sobre software, esquemas e arquitetura.',
              retention: 'Sem cessão de código-fonte nem licença perpétua fora da plataforma.',
            },
            {
              category: 'Atualizações da plataforma, melhorias e sincronização contínua',
              collectedData: 'Search Link',
              processor: 'Novas versões, evoluções de mapeamento, correções e envio contínuo.',
              retention: 'Disponível somente com Plano Plus ativo e armazenamento em dia.',
            },
          ],
        },
      },
      {
        id: 'atualizacoes-e-dependencia-plano-plus',
        number: '05',
        title: 'Atualizações do Search Link e dependência do Plano Plus',
        paragraphs: [
          'Todas as atualizações da plataforma, evoluções do motor de IA, manutenção de CDN/R2 e envio contínuo de sincronizações pertencem exclusivamente ao Search Link e dependem da manutenção ativa do Plano Plus e do armazenamento correspondente.',
          'Mesmo que registros sincronizados antes permaneçam localmente no servidor da agência, caso o Plano Plus seja cancelado ou interrompido, o Search Link desativará imediatamente as URLs de imagens no R2, suspenderá atualizações e interromperá novas sincronizações conforme descrito em Modo Agência.',
        ],
      },
      {
        id: 'indenidade-e-independencia',
        number: '06',
        title: 'Indenidade e relação independente',
        paragraphs: [
          'O titular do servidor externo concorda em indenizar e manter o Search Link isento diante de quaisquer reclamações de clientes finais ou terceiros relacionadas a atendimentos feitos em seu servidor externo ou violações às nossas Políticas de conteúdo.',
          'A conexão por Modo Agência não cria sociedade, franquia ou responsabilidade solidária entre o Search Link e a agência. O tratamento de dados na plataforma segue nossas Políticas de privacidade e uso.',
        ],
      },
    ],
    footerNote:
      'Search Link · Responsabilidade e propriedade no Modo Agência. Consulte também nosso guia operacional O que considerar no Modo Agência.',
  },
};
