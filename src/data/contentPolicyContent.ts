import type { SupportedLocale } from '../lib/i18n';
import type { PrivacyPolicyDocument } from './privacyPolicyContent';

export const CONTENT_POLICY_CONTENT: Record<SupportedLocale, PrivacyPolicyDocument> = {
  es: {
    documentTitle: 'Políticas de contenido',
    documentCategory: 'Documentación de seguridad y moderación',
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
      'Estas Políticas de contenido definen qué materiales están permitidos o prohibidos dentro de Search Link, cómo opera la diferenciación contextual para catálogos comerciales legítimos y qué medidas automáticas ejecuta la plataforma ante dominios o imágenes que infrinjan nuestros estándares de seguridad.',
    sections: [
      {
        id: 'proposito-y-alcance',
        number: '01',
        title: 'Propósito y alcance de aplicación',
        paragraphs: [
          'Search Link está diseñado exclusivamente para indexar catálogos lícitos de productos y servicios comerciales. Estas normas aplican de forma obligatoria a toda dirección web pegada en la barra de extracción, a cualquier archivo de imagen cargado desde dispositivos locales, a logotipos de organización, a descripciones generadas en la base de catálogos y a las respuestas entregadas mediante Search Link Core y Search Link IA.',
          'Al subir o extraer contenido, cada usuario asume responsabilidad directa por asegurarse de que el material origen cumpla íntegramente con estas disposiciones y con la legislación vigente en su jurisdicción.',
        ],
      },
      {
        id: 'contenido-prohibido',
        number: '02',
        title: 'Material terminantemente prohibido',
        paragraphs: [
          'Search Link mantiene tolerancia cero frente a las siguientes categorías de contenido, con independencia de si provienen de un dominio externo o de una carga directa desde almacenamiento local:',
        ],
        bullets: [
          'Explotación, abuso o sexualización de menores (CSAM/CSAE) en cualquier formato real, ilustrado o generado sintéticamente.',
          'Pornografía explícita, actos sexuales, desnudez frontal o genital sexualizada, servicios sexuales, acompañamiento adulto o promoción de portales pornográficos.',
          'Violencia letal o gráfica extrema: homicidios, ejecuciones, cadáveres, restos humanos, tortura, mutilaciones, heridas abiertas o apología de autolesiones y suicidio.',
          'Armas ensanguentadas o escenas de agresión violenta activa con armas blancas, objetos contundentes o armas de fuego.',
          'Terrorismo, extremismo violento, incitación grave al odio, fraude financiero, suplantación de identidad o comercialización de bienes ilícitos.',
        ],
      },
      {
        id: 'diferenciacion-comercial',
        number: '03',
        title: 'Criterio contextual para catálogos comerciales legítimos',
        paragraphs: [
          'Nuestro motor de evaluación multimodal no aplica filtros ciegos por palabras aisladas o presencia genérica de artículos de consumo; evalúa la intención y el contexto visual de cada escena para proteger el comercio legítimo:',
        ],
        bullets: [
          'Moda, lencería y ropa de baño: las fotografías comerciales de prendas íntimas, corsetería o trajes de baño exhibidas sobre maniquíes, perchas o modelos sin desnudez explícita ni connotación pornográfica son aceptadas normalmente.',
          'Utensilios de cocina, ferretería y campismo: los catálogos lícitos de cuchillos culinarios, navajas utilitarias o herramientas metálicas limpias en exhibición comercial pasan la verificación sin bloqueos siempre que no muestren sangre, agresiones ni lesiones.',
          'Arte, cosmética y bienestar: artículos dermatológicos, cuidado corporal o piezas decorativas en presentación comercial no explícita se indexan con normalidad.',
        ],
      },
      {
        id: 'bloqueo-de-dominios',
        number: '04',
        title: 'Bloqueo preventivo e inmediato de dominios',
        paragraphs: [
          'Search Link mantiene una lista activa de bloqueo de dominios asociados a pornografía explícita, transmisiones sexuales en vivo, hentai explícito, directorios de prostitución y portales de violencia extrema.',
          'Cuando un usuario intenta pegar, escribir o enviar una dirección web perteneciente a un dominio restringido —incluidos sus subdominios, espejos numerados o extensiones de dominio dedicadas a contenido adulto—, la plataforma rechaza y limpia la entrada de inmediato antes de iniciar extracciones de red y notifica que dicho dominio infringe nuestras políticas de contenido.',
        ],
      },
      {
        id: 'deteccion-y-reversion',
        number: '05',
        title: 'Moderación multimodal y reversión automática del lote',
        paragraphs: [
          'Durante el procesamiento en segundo plano, cada imagen se somete a verificación visual automatizada de seguridad antes de quedar consolidada en el catálogo público del servicio:',
        ],
        bullets: [
          'Primera detección de infracción moderada: la imagen infractora es rechazada al instante y eliminada inmediatamente de nuestro almacenamiento en la nube, impidiendo su publicación en el catálogo.',
          'Reincidencia en el lote o infracción de gravedad extrema: si una segunda imagen del mismo lote infringe las políticas —o si se detecta una única imagen con contenido grave como violencia letal o material sexual explícito—, el sistema deduce que el lote completo es incompatible, detiene la cola en seco, elimina de la nube todas las imágenes vinculadas al proceso y revierte el registro provisional del servicio.',
          'Transparencia en ciclo de vida: cuando ocurre un freno automático por seguridad, el indicador de ciclo de vida informa claramente que el proceso fue detenido por violación a las políticas de contenido.',
        ],
      },
      {
        id: 'propiedad-intelectual',
        number: '06',
        title: 'Propiedad intelectual, marcas y autorización del sitio origen',
        paragraphs: [
          'Solo está permitido indexar imágenes, marcas y fichas técnicas sobre las cuales tu organización posea titularidad, licencia comercial o autorización verificable. Queda prohibido utilizar Search Link para copiar masivamente inventarios ajenos, reproducir obras protegidas sin permiso o inducir confusión sobre la identidad oficial de una marca comercial.',
        ],
      },
      {
        id: 'integridad-de-ia',
        number: '07',
        title: 'Uso íntegro de Search Link IA y endpoints Core',
        paragraphs: [
          'Los servicios conectados mediante Search Link Core y el asistente conversacional Search Link IA deben operar exclusivamente sobre información veraz de catálogo. Está prohibido manipular metadatos para inyectar instrucciones ocultas (prompt injection), engañar a usuarios finales sobre disponibilidad o seguridad de artículos, o emplear el asistente para distribuir enlaces maliciosos.',
        ],
      },
      {
        id: 'cumplimiento-y-sanciones',
        number: '08',
        title: 'Medidas de cumplimiento y suspensión',
        paragraphs: [
          'Search Link podrá ampliar sus listas de dominios restringidos, bloquear la extracción desde orígenes abusivos, desactivar servicios de Search Link Core, suprimir catálogos infractores o suspender cuentas que intenten eludir los controles de moderación mediante recortes, ofuscación visual o reintentos automatizados tras un bloqueo.',
        ],
      },
    ],
    footerNote:
      'Search Link · Políticas de contenido. Estas reglas operan en conjunto con nuestros Términos y condiciones, Políticas de privacidad y uso y Propiedad intelectual, límites y responsabilidad.',
  },

  en: {
    documentTitle: 'Content Policies',
    documentCategory: 'Safety and Moderation Documentation',
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
      'These Content Policies define what media and source URLs are permitted or prohibited on Search Link, how contextual screening preserves legitimate commercial catalogs, and what automated enforcement actions trigger when a domain or image violates our safety standards.',
    sections: [
      {
        id: 'purpose-and-scope',
        number: '01',
        title: 'Purpose and scope of application',
        paragraphs: [
          'Search Link is built exclusively for indexing legitimate commercial products and services. These rules apply strictly to every website URL submitted for extraction, all image files uploaded from local devices, organization logos, catalog metadata, and responses served through Search Link Core and Search Link AI.',
          'Whenever content is uploaded or extracted, the account holder bears direct responsibility for ensuring full compliance with these standards and applicable law.',
        ],
      },
      {
        id: 'prohibited-content',
        number: '02',
        title: 'Strictly prohibited content categories',
        paragraphs: [
          'Search Link enforces zero tolerance across the following material, regardless of whether it originates from an external webpage or direct file upload:',
        ],
        bullets: [
          'Child sexual abuse or exploitation material (CSAM/CSAE) in any photographic, illustrated, or synthetic form.',
          'Explicit pornography, sexual acts, sexualized frontal or genital nudity, adult escort services, or promotion of pornographic portals.',
          'Extreme lethal or graphic violence: homicides, executions, corpses, human remains, torture, mutilation, severe open wounds, or encouragement of self-harm and suicide.',
          'Bloodied weapons or depictions of active violent assault involving bladed weapons, blunt instruments, or firearms.',
          'Terrorism, violent extremism, severe hate speech, financial fraud, impersonation, or unlawful goods.',
        ],
      },
      {
        id: 'commercial-context',
        number: '03',
        title: 'Contextual accuracy for legitimate commerce',
        paragraphs: [
          'Our multimodal evaluation engine does not rely on blind keyword filtering; it evaluates visual intent and commercial context so lawful retail catalogs operate uninterrupted:',
        ],
        bullets: [
          'Fashion, lingerie, and swimwear: retail product photography of intimate apparel, corsetry, or swimwear on mannequins, hangers, or models without explicit nudity or pornographic framing is accepted normally.',
          'Cutlery, kitchenware, and hardware: legitimate catalog photos of clean kitchen knives, utility tools, or camping cutlery pass safety screening provided there is no blood, injury, or violent depiction.',
          'Cosmetics, wellness, and decor: skincare items, personal care products, or decorative goods presented in standard commercial contexts are indexed without friction.',
        ],
      },
      {
        id: 'domain-blocking',
        number: '04',
        title: 'Immediate domain-level prevention',
        paragraphs: [
          'Search Link maintains an active blocklist covering explicit pornography portals, adult webcam sites, explicit hentai networks, escort directories, and extreme shock-gore domains.',
          'When a user pastes, types, or submits a URL belonging to a restricted domain—including subdomains, numeric mirrors, or dedicated adult top-level domains—the input is cleared immediately prior to outbound fetching and displays a policy violation notice.',
        ],
      },
      {
        id: 'multimodal-rollback',
        number: '05',
        title: 'Multimodal screening and automated batch rollback',
        paragraphs: [
          'During background processing, every image undergoes automated visual safety inspection before catalog publication:',
        ],
        bullets: [
          'First moderate violation: the offending image is rejected immediately and permanently deleted from cloud object storage so it never enters the service catalog.',
          'Repeated batch violation or severe offense: if a second image in the same batch triggers a safety violation—or if any single image depicts severe content such as extreme violence or explicit sex—the system halts the entire batch immediately, deletes every media file stored for that batch, rolls back draft database records, and stops processing.',
          'Lifecycle clarity: whenever automated enforcement halts a batch, the lifecycle status panel notifies the user that processing stopped due to content policy violations.',
        ],
      },
      {
        id: 'intellectual-property',
        number: '06',
        title: 'Intellectual property and source site authorization',
        paragraphs: [
          'Users may only index images, trademarks, and product descriptions for which their organization holds ownership, valid commercial licensing, or verifiable permission. Search Link may not be used to scrape competitor catalogs without authorization or misrepresent official brand identity.',
        ],
      },
      {
        id: 'ai-integrity',
        number: '07',
        title: 'Integrity of Search Link AI and Core endpoints',
        paragraphs: [
          'Services exposed via Search Link Core and the Search Link AI tester must rely on accurate catalog data. Inserting hidden prompt-injection instructions into product fields, misleading end buyers, or distributing malicious links through conversational responses is strictly prohibited.',
        ],
      },
      {
        id: 'enforcement-actions',
        number: '08',
        title: 'Enforcement and account suspension',
        paragraphs: [
          'Search Link reserves the right to expand domain restrictions, block abusive extraction origins, disable Search Link Core endpoints, remove violating catalogs, or suspend accounts that attempt to evade moderation via cropping, visual obfuscation, or repeated prohibited submissions.',
        ],
      },
    ],
    footerNote:
      'Search Link · Content Policies. These standards operate together with our Terms and Conditions, Privacy and Usage Policies, and Intellectual Property, Limits, and Liability.',
  },

  pt: {
    documentTitle: 'Políticas de conteúdo',
    documentCategory: 'Documentação de segurança e moderação',
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
      'Estas Políticas de conteúdo definem quais materiais são permitidos ou proibidos no Search Link, como funciona a diferenciação contextual para catálogos comerciais legítimos e quais ações automáticas são executadas diante de domínios ou imagens incompatíveis com nossas diretrizes de segurança.',
    sections: [
      {
        id: 'proposito-e-escopo',
        number: '01',
        title: 'Propósito e escopo de aplicação',
        paragraphs: [
          'O Search Link destina-se exclusivamente à indexação de catálogos lícitos de produtos e serviços comerciais. Estas regras aplicam-se a toda URL colada na barra de extração, arquivos de imagem enviados localmente, logotipos de organização, metadados gerados e respostas entregues via Search Link Core e Search Link IA.',
          'Ao enviar ou extrair qualquer conteúdo, o titular da conta assume responsabilidade direta pelo cumprimento integral destas normas e da legislação aplicável.',
        ],
      },
      {
        id: 'conteudo-proibido',
        number: '02',
        title: 'Material terminantemente proibido',
        paragraphs: [
          'O Search Link adota tolerância zero em relação às seguintes categorias, independentemente de origem externa ou envio local:',
        ],
        bullets: [
          'Exploração, abuso ou sexualização de menores (CSAM/CSAE) em qualquer formato real, ilustrado ou sintético.',
          'Pornografia explícita, atos sexuais, nudez frontal ou genital sexualizada, serviços sexuais ou divulgação de portais pornográficos.',
          'Violência letal ou gráfica extrema: homicídios, execuções, cadáveres, restos humanos, tortura, mutilações, ferimentos graves ou incentivo à automutilação e suicídio.',
          'Armas ensanguentadas ou cenas de agressão violenta com armas brancas, objetos contundentes ou armas de fogo.',
          'Terrorismo, extremismo violento, discurso de ódio grave, fraude financeira, falsidade ideológica ou bens ilícitos.',
        ],
      },
      {
        id: 'diferenciacao-comercial',
        number: '03',
        title: 'Critério contextual para comércio legítimo',
        paragraphs: [
          'Nosso motor multimodal não aplica bloqueios cegos por palavras isoladas; ele avalia intenção e contexto visual para proteger operações comerciais legítimas:',
        ],
        bullets: [
          'Moda, lingerie e moda praia: fotografias comerciais de peças íntimas, espartilhos ou trajes de banho em manequins, cabides ou modelos sem nudez explícita nem conotação pornográfica são aceitas normalmente.',
          'Cutelaria, cozinha e ferramentas: catálogos lícitos de facas culinárias, canivetes utilitários ou ferramentas limpas em exibição comercial são aprovados desde que não apresentem sangue, ferimentos ou violência.',
          'Cosméticos, bem-estar e decoração: itens de cuidado pessoal e produtos comerciais convencionais passam sem restrições.',
        ],
      },
      {
        id: 'bloqueio-de-dominios',
        number: '04',
        title: 'Bloqueio preventivo e imediato de domínios',
        paragraphs: [
          'O Search Link mantém uma lista ativa de bloqueio para domínios associados a pornografia explícita, webcams adultas, hentai explícito, diretórios de prostituição e portais de violência extrema.',
          'Quando alguém cola, digita ou envia uma URL pertencente a um domínio restrito — incluindo subdomínios, espelhos numerados ou extensões dedicadas a conteúdo adulto —, o campo é limpo imediatamente antes de qualquer requisição de rede com aviso de violação às políticas de conteúdo.',
        ],
      },
      {
        id: 'deteccao-e-reversao',
        number: '05',
        title: 'Moderação multimodal e reversão automática do lote',
        paragraphs: [
          'Durante o processamento em segundo plano, cada imagem passa por inspeção visual automatizada antes de integrar o catálogo público do serviço:',
        ],
        bullets: [
          'Primeira infração moderada: a imagem infratora é rejeitada na hora e removida imediatamente do armazenamento em nuvem.',
          'Reincidência no lote ou infração grave: havendo uma segunda imagem infratora no mesmo lote — ou diante de qualquer imagem de gravidade extrema — o sistema interrompe a fila imediatamente, exclui todas as imagens já enviadas do lote na nuvem e reverte o registro provisório no banco de dados.',
          'Transparência no ciclo de vida: quando a proteção automática interrompe o lote, o indicador de ciclo de vida informa claramente a violação às políticas de conteúdo.',
        ],
      },
      {
        id: 'propriedade-intelectual',
        number: '06',
        title: 'Propriedade intelectual e autorização da fonte',
        paragraphs: [
          'Somente é permitido indexar imagens, marcas e descrições comerciais sobre as quais sua organização detenha titularidade, licença ou autorização válida. É vedado utilizar o Search Link para copiar catálogos de terceiros sem permissão ou induzir confusão sobre marcas oficiais.',
        ],
      },
      {
        id: 'integridade-da-ia',
        number: '07',
        title: 'Integridade do Search Link IA e endpoints Core',
        paragraphs: [
          'Os serviços conectados ao Search Link Core e ao assistente Search Link IA devem utilizar exclusivamente informações comerciais legítimas. É proibido inserir instruções ocultas (prompt injection) em descrições, enganar consumidores ou distribuir links maliciosos via respostas conversacionais.',
        ],
      },
      {
        id: 'cumprimento-e-sancoes',
        number: '08',
        title: 'Medidas de cumprimento e suspensão',
        paragraphs: [
          'O Search Link pode ampliar restrições de domínios, bloquear origens abusivas, desativar endpoints do Search Link Core, remover catálogos infratores ou suspender contas que tentem burlar a moderação por meio de recortes, ofuscação visual ou envios reiterados após bloqueio.',
        ],
      },
    ],
    footerNote:
      'Search Link · Políticas de conteúdo. Estas diretrizes atuam em conjunto com nossos Termos e condições, Políticas de privacidade e uso e Propriedade intelectual, limites e responsabilidade.',
  },
};
