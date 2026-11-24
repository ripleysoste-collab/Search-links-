import type { SupportedLocale } from '../lib/i18n';
import type { PrivacyPolicyDocument } from './privacyPolicyContent';

export const INTELLECTUAL_PROPERTY_DOC_CONTENT: Record<
  SupportedLocale,
  PrivacyPolicyDocument
> = {
  es: {
    documentTitle: 'Propiedad intelectual, límites y responsabilidad',
    documentCategory: 'Protección de derechos, exención y límites operativos',
    effectiveLabel: 'Última actualización',
    effectiveDate: '23 de noviembre de 2026',
    versionLabel: 'Versión',
    version: '1.0',
    appliesToLabel: 'Ámbito',
    appliesTo:
      'Extracción por URL, Carga local, Search Link Core API, Search Link IA y Modo Agencia',
    backLabel: 'Cerrar',
    tocHeading: 'Contenido del documento',
    mobileTocToggleLabel: 'Índice de secciones',
    leadSummary:
      'Este documento establece las declaraciones obligatorias de propiedad intelectual y licencias de uso aplicables a todo recurso procesado en Search Link, el alcance limitado de los permisos concedidos a la plataforma, el procedimiento de retirada y bloqueo de dominios (DMCA / Opt-Out) y los límites objetivos de responsabilidad aplicables al servicio y al Modo Agencia.',
    sections: [
      {
        id: 'titularidad-y-garantia-del-usuario',
        number: '01',
        title: 'Titularidad previa y garantía obligatoria del usuario',
        paragraphs: [
          'Antes de iniciar la optimización, alojamiento o indexación de imágenes extraídas mediante URL o cargadas desde un dispositivo, el usuario declara y garantiza de forma expresa que es titular legítimo de los derechos de autor, marca o imagen comercial implicados, o que cuenta con licencia válida y autorización previa suficiente de su titular para reproducir, transformar, alojar y exhibir dicho contenido en su catálogo.',
          'Search Link opera exclusivamente como un proveedor neutral de infraestructura automatizada y no verifica ni certifica la titularidad jurídica privada entre usuarios, proveedores comerciales o terceros propietarios de sitios web.',
        ],
      },
      {
        id: 'licencia-tecnica-limitada',
        number: '02',
        title: 'Licencia operativa limitada concedida a Search Link',
        paragraphs: [
          'Al confirmar y aceptar el procesamiento de un lote de imágenes o catálogo, el usuario conserva todos sus derechos legítimos sobre sus activos y concede a Search Link únicamente una licencia técnica no exclusiva, mundial mientras el servicio permanezca activo, gratuita y revocable para ejecutar las tareas solicitadas:',
        ],
        bullets: [
          'Descargar temporalmente, renderizar y convertir las imágenes a formato WebP optimizado.',
          'Alojar dichas copias optimizadas en Cloudflare R2 vinculadas a tu cuenta y organización.',
          'Generar metadatos descriptivos y categorías mediante modelos de inteligencia artificial y servirlos por Search Link Core, Search Link IA o webhooks hacia tu servidor en Modo Agencia.',
          'Search Link no adquiere propiedad comercial sobre tus catálogos ni utiliza tus inventarios privados para entrenar modelos fundacionales públicos.',
        ],
      },
      {
        id: 'exencion-por-imagenes-y-indemnidad',
        number: '03',
        title: 'Ausencia de responsabilidad por contenido aportado e indemnidad',
        paragraphs: [
          'Search Link no responde en ningún supuesto por fotografías, descripciones, logotipos, enlaces, marcas registradas o catálogos introducidos por el usuario mediante URLs externas o archivos locales, ni por cualquier infracción de derechos de propiedad intelectual, derechos de imagen o competencia desleal derivada de su uso.',
          'El usuario asume plena y exclusiva responsabilidad por todo recurso que decida procesar y se obliga a mantener indemne a Search Link frente a cualquier reclamación extrajudicial, notificación legal, sanción administrativa, daño o gasto razonable originado por contenidos procesados desde su cuenta o por el incumplimiento de estas declaraciones.',
        ],
      },
      {
        id: 'retirada-dmca-y-exclusion-dominios',
        number: '04',
        title: 'Procedimiento de notificación, retirada (DMCA) y exclusión de dominios',
        paragraphs: [
          'Respetamos de forma estricta los derechos de propiedad intelectual y el control de los titulares sobre sus propios sitios web. Si eres propietario de una marca, creador de contenido o administrador de un dominio y consideras que un usuario procesó material protegido sin autorización o deseas excluir permanentemente tu dominio del extractor:',
        ],
        bullets: [
          'Puedes enviar una solicitud formal al canal oficial de contacto y administración de Search Link indicando: (a) tu identidad y acreditación como titular o representante autorizado, (b) el dominio exacto o la URL específica del recurso afectado y (c) una declaración de buena fe de que el uso cuestionado no está autorizado.',
          'Tras validar la solicitud, Search Link procederá con carácter prioritario a incorporar el dominio en nuestra lista de bloqueo preventivo inmediato, desactivar el servicio público asociado y eliminar de Cloudflare R2 las copias almacenadas correspondientes.',
          'Este canal directo tiene como finalidad resolver de manera ágil y amistosa cualquier incidencia relacionada con derechos de autor o exclusión de rastreo sin necesidad de litigio previo.',
        ],
      },
      {
        id: 'modo-agencia-y-servidores-externos',
        number: '05',
        title: 'Modo Agencia, webhooks y servidores externos del usuario',
        paragraphs: [
          'Cuando una cuenta conecta un servidor externo mediante la función Conecta tu servidor, el cliente receptor, su alojamiento, base de datos, disponibilidad, cifrado, validación de la cabecera criptográfica X-SearchLink-Signature mediante la Clave secreta y el tratamiento de datos frente a terceros operan bajo control y responsabilidad exclusiva del usuario o agencia.',
          'Una vez entregados los eventos de sincronización hacia el servidor configurado por el usuario, Search Link no supervisa ni responde por fallos de seguridad, pérdida de datos, caídas de infraestructura externa ni usos comerciales realizados desde dicho servidor.',
        ],
      },
      {
        id: 'limites-ia-disponibilidad-y-tope',
        number: '06',
        title: 'Límites de la inteligencia artificial, servicio «tal cual» y tope de responsabilidad',
        paragraphs: [
          'Las etiquetas, categorías, descripciones y respuestas conversacionales generadas por Search Link IA o por los flujos de mapeo automático tienen carácter exclusivamente asistido y orientativo. Pueden producirse errores de interpretación visual o textual; es obligación del comercio revisar sus catálogos antes de ofrecer productos o asumir compromisos de venta frente a consumidores finales.',
          'Search Link se presta «tal cual» y «según disponibilidad», sujeto a cuotas técnicas y a la continuidad operativa de proveedores externos especializados (Supabase, Cloudflare, Render, Google Gemini y Groq) así como de las URLs de origen consultadas.',
          'En la máxima medida permitida por la legislación aplicable, Search Link excluye toda responsabilidad por daños indirectos, incidentales, lucro cesante o pérdida de oportunidades comerciales. En cualquier escenario en que resulte exigible responsabilidad directa probada, la responsabilidad económica agregada total de Search Link queda limitada como máximo al importe efectivamente abonado por el usuario durante los tres (3) meses inmediatamente anteriores al hecho, siendo cero (0) para cuentas en modalidad gratuita o visitante.',
        ],
      },
      {
        id: 'independencia-y-resolucion',
        number: '07',
        title: 'Relación entre las partes y vigencia',
        paragraphs: [
          'El uso de Search Link, de sus endpoints Core o del Modo Agencia no constituye sociedad, asociación conjunta, franquicia, representación comercial ni relación laboral entre Search Link y sus usuarios o agencias.',
          'Las obligaciones de indemnidad, declaración de titularidad y limitación de responsabilidad contenidas en este documento continuarán vigentes incluso después de cancelar un servicio, desconectar un servidor externo o cerrar la cuenta.',
        ],
      },
    ],
    footerNote:
      'Search Link · Propiedad intelectual, límites y responsabilidad. Para revisar el alcance específico en integraciones externas consulta Modo Agencia y Responsabilidad y propiedad en Modo Agencia, junto con nuestros Términos y condiciones y Políticas de contenido.',
  },

  en: {
    documentTitle: 'Intellectual Property, Limits, and Liability',
    documentCategory: 'Rights Protection, Disclaimers, and Liability Caps',
    effectiveLabel: 'Last updated',
    effectiveDate: 'November 23, 2026',
    versionLabel: 'Version',
    version: '1.0',
    appliesToLabel: 'Scope',
    appliesTo:
      'URL Extraction, Local Upload, Search Link Core API, Search Link AI, and Agency Mode',
    backLabel: 'Close',
    tocHeading: 'Document contents',
    mobileTocToggleLabel: 'Section index',
    leadSummary:
      'This document sets out the mandatory intellectual property and usage-permission warranties for all media processed in Search Link, the strictly limited technical license granted to the platform, our takedown and domain opt-out procedure (DMCA / Opt-Out), and the objective liability limits governing the service and Agency Mode.',
    sections: [
      {
        id: 'user-ownership-and-warranty',
        number: '01',
        title: 'Prior ownership and mandatory user warranty',
        paragraphs: [
          'Before optimizing, hosting, or indexing images extracted from a URL or uploaded from a device, you expressly represent and warrant that you are the lawful owner of the relevant copyrights, trademarks, or product media—or hold a valid license and sufficient prior authorization from the rights holder—to reproduce, optimize, store, and distribute such content in your catalog.',
          'Search Link operates strictly as a neutral automated technical infrastructure provider and does not verify private licensing chains between users, merchants, or third-party website operators.',
        ],
      },
      {
        id: 'limited-technical-license',
        number: '02',
        title: 'Limited operational license granted to Search Link',
        paragraphs: [
          'By confirming and accepting batch processing, you retain all pre-existing ownership over your legitimate business assets and grant Search Link solely a non-exclusive, revocable, royalty-free technical license strictly necessary to perform your requested operations while your service remains active:',
        ],
        bullets: [
          'Temporarily fetch, render, and convert submitted media into optimized WebP assets.',
          'Store those optimized assets in Cloudflare R2 under your account and organization.',
          'Generate structured product titles, categories, and descriptions via AI and serve them through Search Link Core, Search Link AI, or Agency Mode webhooks to your configured server.',
          'Search Link claims no commercial ownership over your catalogs and does not use your private inventories to train public foundation models.',
        ],
      },
      {
        id: 'no-liability-for-user-content-indemnity',
        number: '03',
        title: 'No liability for user-submitted content and indemnification',
        paragraphs: [
          'Search Link assumes zero liability for any photographs, descriptions, logos, links, trademarks, or catalogs submitted by users via external URLs or local files, nor for any copyright, trademark, or unfair-competition infringement resulting from their use.',
          'You assume full and exclusive responsibility for all material you choose to process and agree to defend, indemnify, and hold Search Link harmless from any claims, takedown notices, regulatory fines, damages, or reasonable legal expenses arising out of content processed through your account or breach of these warranties.',
        ],
      },
      {
        id: 'dmca-takedown-and-domain-optout',
        number: '04',
        title: 'Takedown notice procedure (DMCA) and domain exclusion',
        paragraphs: [
          'We strictly respect intellectual property rights and website operators’ control over their domains. If you are a brand owner, content creator, or domain administrator and believe protected material was processed without authorization, or wish to exclude your domain permanently from our extractor:',
        ],
        bullets: [
          'Submit a verifiable request through Search Link’s official administration and legal contact channel specifying: (a) your identity and authority as rights holder or authorized agent, (b) the exact domain or specific URL/asset involved, and (c) a good-faith statement that the disputed use is unauthorized.',
          'Upon verification, Search Link will promptly add the domain to our immediate preventive domain blocklist, deactivate affected public service endpoints, and purge corresponding stored copies from Cloudflare R2.',
          'This direct channel provides fast, good-faith resolution for copyright or crawl-exclusion requests without requiring prior litigation.',
        ],
      },
      {
        id: 'agency-mode-external-servers',
        number: '05',
        title: 'Agency Mode, webhooks, and user-operated external servers',
        paragraphs: [
          'When an account connects an external server via Connect your server, the receiving infrastructure, database, uptime, encryption, cryptographic verification of X-SearchLink-Signature using your Secret Key, and end-user data handling remain under the sole control and responsibility of the user or agency.',
          'Once synchronization events are delivered to your designated server URL, Search Link does not monitor and is not responsible for security incidents, data loss, external server outages, or commercial actions taken from your external infrastructure.',
        ],
      },
      {
        id: 'ai-limits-availability-liability-cap',
        number: '06',
        title: 'AI accuracy limits, "as-is" availability, and maximum liability cap',
        paragraphs: [
          'Titles, categories, descriptions, and conversational replies generated by Search Link AI or automated mapping pipelines are assistive outputs that may contain visual or textual inaccuracies. Merchants must review catalog outputs before publishing offers or making binding commitments to end customers.',
          'Search Link is provided on an "as is" and "as available" basis, subject to technical quotas and external infrastructure providers (Supabase, Cloudflare, Render, Google Gemini, and Groq) as well as the availability of user-submitted origin URLs.',
          'To the maximum extent permitted by applicable law, Search Link disclaims all indirect, incidental, consequential, or lost-profit damages. Where direct liability is legally established, Search Link’s total aggregate liability is strictly capped at the fees actually paid by you during the three (3) months immediately preceding the event (and zero for free-tier or guest usage).',
        ],
      },
      {
        id: 'independent-relationship',
        number: '07',
        title: 'Independent relationship and survival',
        paragraphs: [
          'Use of Search Link, Core APIs, or Agency Mode creates no partnership, joint venture, franchise, fiduciary agency, or employment relationship between Search Link and its users.',
          'The ownership warranties, indemnification, and liability limitations in this document survive service deactivation, external server disconnection, or account closure.',
        ],
      },
    ],
    footerNote:
      'Search Link · Intellectual Property, Limits, and Liability. For external infrastructure rules see Agency Mode and Agency Mode Liability and Intellectual Property, together with our Terms and Conditions and Content Policies.',
  },

  pt: {
    documentTitle: 'Propriedade intelectual, limites e responsabilidade',
    documentCategory: 'Proteção de direitos, isenção e limites operacionais',
    effectiveLabel: 'Última atualização',
    effectiveDate: '23 de novembro de 2026',
    versionLabel: 'Versão',
    version: '1.0',
    appliesToLabel: 'Escopo',
    appliesTo:
      'Extração por URL, Upload local, Search Link Core API, Search Link IA e Modo Agência',
    backLabel: 'Fechar',
    tocHeading: 'Conteúdo do documento',
    mobileTocToggleLabel: 'Índice de seções',
    leadSummary:
      'Este documento estabelece as declarações obrigatórias de propriedade intelectual e licenças de uso aplicáveis a todo material processado no Search Link, o alcance limitado das permissões concedidas à plataforma, o procedimento oficial de remoção e bloqueio de domínios (DMCA / Opt-Out) e os limites objetivos de responsabilidade do serviço e do Modo Agência.',
    sections: [
      {
        id: 'titularidade-e-garantia-usuario',
        number: '01',
        title: 'Titularidade prévia e garantia obrigatória do usuário',
        paragraphs: [
          'Antes de iniciar a otimização, hospedagem ou indexação de imagens extraídas por URL ou enviadas de um dispositivo, o usuário declara e garante expressamente que é o legítimo titular dos direitos autorais, marcas ou imagens envolvidas, ou que possui licença válida e autorização prévia suficiente para reproduzir, otimizar, hospedar e exibir esse conteúdo em seu catálogo.',
          'O Search Link atua exclusivamente como provedor neutro de infraestrutura técnica automatizada e não audita cadeias privadas de licenciamento entre usuários, lojistas ou operadores de sites externos.',
        ],
      },
      {
        id: 'licenca-tecnica-limitada',
        number: '02',
        title: 'Licença operacional limitada concedida ao Search Link',
        paragraphs: [
          'Ao confirmar e aceitar o processamento de um lote de imagens, o usuário mantém todos os seus direitos legítimos sobre seus ativos e concede ao Search Link apenas uma licença técnica não exclusiva, gratuita e revogável para executar as ações solicitadas enquanto o serviço permanecer ativo:',
        ],
        bullets: [
          'Baixar temporariamente, renderizar e converter imagens para formato WebP otimizado.',
          'Armazenar essas cópias otimizadas no Cloudflare R2 vinculadas à sua conta e organização.',
          'Gerar títulos, categorias e descrições estruturadas via IA e disponibilizá-los pelo Search Link Core, Search Link IA ou webhooks para o seu servidor no Modo Agência.',
          'O Search Link não adquire propriedade comercial sobre seus catálogos nem utiliza seus estoques privados para treinar modelos fundacionais públicos.',
        ],
      },
      {
        id: 'isencao-e-indenizacao',
        number: '03',
        title: 'Ausência de responsabilidade por conteúdo de terceiros e indenidade',
        paragraphs: [
          'O Search Link não se responsabiliza em hipótese alguma por fotografias, descrições, logotipos, links, marcas ou catálogos inseridos pelo usuário via URLs externas ou arquivos locais, nem por eventuais violações de direitos autorais, marcas registradas ou concorrência desleal decorrentes desse uso.',
          'O usuário assume total e exclusiva responsabilidade pelo material processado e compromete-se a indenizar e manter o Search Link isento diante de quaisquer reclamações, notificações legais, multas, danos ou despesas razoáveis originadas pelos conteúdos de sua conta ou pelo descumprimento destas declarações.',
        ],
      },
      {
        id: 'remocao-dmca-exclusao-dominios',
        number: '04',
        title: 'Procedimento de notificação, remoção (DMCA) e exclusão de domínios',
        paragraphs: [
          'Respeitamos rigorosamente direitos de propriedade intelectual e o controle de administradores sobre seus sites. Se você é titular de marca, criador ou responsável por um domínio e deseja solicitar remoção de conteúdo ou exclusão definitiva do extrator:',
        ],
        bullets: [
          'Envie solicitação verificável ao canal oficial de contato e administração do Search Link informando: (a) sua identificação e comprovação de titularidade ou representação, (b) o domínio exato ou URL específica do recurso e (c) declaração de boa-fé de que o uso contestado não foi autorizado.',
          'Após verificação, o Search Link incluirá o domínio em nossa lista de bloqueio preventivo imediato, desativará o serviço público afetado e removerá as cópias correspondentes do Cloudflare R2.',
          'Esse canal direto visa resolver solicitações de direitos autorais ou exclusão de forma ágil e amigável sem necessidade de litígio prévio.',
        ],
      },
      {
        id: 'modo-agencia-servidores-externos',
        number: '05',
        title: 'Modo Agência, webhooks e servidores externos do usuário',
        paragraphs: [
          'Quando uma conta conecta um servidor externo por meio da função Conecte seu servidor, a infraestrutura receptora, banco de dados, disponibilidade, criptografia, validação da assinatura X-SearchLink-Signature com a Chave secreta e tratamento de dados perante clientes finais permanecem sob controle e responsabilidade exclusiva do usuário ou agência.',
          'Após a entrega dos eventos de sincronização para a URL configurada pelo usuário, o Search Link não monitora nem responde por falhas de segurança, perda de dados, indisponibilidades do servidor externo ou operações realizadas a partir dele.',
        ],
      },
      {
        id: 'limites-ia-e-teto-responsabilidade',
        number: '06',
        title: 'Limites da inteligência artificial, serviço «no estado» e teto de responsabilidade',
        paragraphs: [
          'Metadados gerados por IA e respostas do Search Link IA são sugestões automatizadas sujeitas a eventuais imprecisões visuais ou textuais; cabe ao lojista validar seus catálogos antes de publicar ofertas comerciais.',
          'O Search Link é fornecido «no estado em que se encontra» e «conforme disponibilidade», dependendo de provedores externos (Supabase, Cloudflare, Render, Google Gemini e Groq) e da disponibilidade das URLs de origem informadas.',
          'Na máxima extensão permitida por lei, o Search Link exclui danos indiretos, lucros cessantes ou perda de oportunidades, limitando eventual responsabilidade direta comprovada ao total efetivamente pago pelo usuário nos últimos três (3) meses anteriores ao evento (sendo zero para contas gratuitas ou visitantes).',
        ],
      },
      {
        id: 'relacao-independente',
        number: '07',
        title: 'Relação independente entre as partes',
        paragraphs: [
          'O uso do Search Link, de seus endpoints Core ou do Modo Agência não estabelece sociedade, franquia, representação comercial ou vínculo trabalhista entre o Search Link e seus usuários.',
          'As obrigações de indenidade, garantias de titularidade e limitações de responsabilidade permanecem válidas mesmo após a desativação de serviços, desconexão de servidor externo ou encerramento da conta.',
        ],
      },
    ],
    footerNote:
      'Search Link · Propriedade intelectual, limites e responsabilidade. Para regras específicas de servidores externos consulte Modo Agência e Responsabilidade e propriedade no Modo Agência, junto com nossos Termos e condições e Políticas de conteúdo.',
  },
};
