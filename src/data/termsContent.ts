import type { SupportedLocale } from '../lib/i18n';
import type { PrivacyPolicyDocument } from './privacyPolicyContent';

export const TERMS_AND_CONDITIONS_CONTENT: Record<SupportedLocale, PrivacyPolicyDocument> = {
  es: {
    documentTitle: 'Términos y condiciones',
    documentCategory: 'Documentación legal y condiciones del servicio',
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
      'Estos Términos y condiciones regulan el acceso y uso de la plataforma Search Link, incluyendo la extracción de recursos web, la optimización y alojamiento multimedia, la generación automatizada de catálogos mediante inteligencia artificial, los endpoints Search Link Core y el asistente Search Link IA.',
    sections: [
      {
        id: 'aceptacion-de-los-terminos',
        number: '01',
        title: 'Aceptación de las condiciones y naturaleza del servicio',
        paragraphs: [
          'Al navegar por Search Link, utilizar la barra de extracción pública, iniciar sesión mediante Google OAuth o integrar cualquier endpoint de Search Link Core, el usuario acepta quedar vinculado por los presentes Términos y condiciones y por las Políticas de privacidad y uso vigentes.',
          'Search Link ofrece infraestructura técnica automatizada orientada a comercios, organizaciones y desarrolladores para transformar páginas web o lotes de imágenes en catálogos estructurados consultables mediante API e inteligencia artificial conversacional. Search Link actúa exclusivamente como proveedor de herramientas tecnológicas de procesamiento y no como intermediario comercial, vendedor directo ni garante de las transacciones entre tus clientes finales y tu organización.',
        ],
      },
      {
        id: 'elegibilidad-y-cuentas',
        number: '02',
        title: 'Elegibilidad, registro y veracidad de la cuenta',
        paragraphs: [
          'Para crear una cuenta autenticada en Search Link debes ser mayor de 18 años o contar con plena capacidad legal para contratar y operar servicios digitales en tu jurisdicción. Si utilizas la plataforma en representación de una persona jurídica o comercio, declaras tener facultades suficientes para obligar a dicha entidad bajo estos términos.',
          'El acceso autenticado se realiza únicamente mediante Google OAuth. Eres responsable exclusivo de mantener la seguridad de tu cuenta de Google, de la veracidad del nombre y logotipo configurados en tu panel de Organización y de toda actividad ejecutada bajo tus credenciales o claves API emitidas.',
        ],
      },
      {
        id: 'licencia-y-uso-permitido',
        number: '03',
        title: 'Licencia de uso y alcance técnico permitido',
        paragraphs: [
          'Sujeto al cumplimiento íntegro de estas condiciones, Search Link te otorga una licencia limitada, no exclusiva, revocable e intransferible para utilizar la aplicación web y consultar tus servicios a través de Search Link Core conforme a los límites técnicos de tu plan vigente.',
          'No está permitido ceder, revender la infraestructura bruta como servicio autónomo sin valor agregado propio, realizar ingeniería inversa no autorizada sobre los flujos privados del servidor, intentar acceder a datos de otras organizaciones ni automatizar peticiones masivas fuera de los endpoints oficiales documentados.',
        ],
      },
      {
        id: 'responsabilidad-sobre-urls-e-imagenes',
        number: '04',
        title: 'Responsabilidad sobre URLs, imágenes y derechos de terceros',
        paragraphs: [
          'El usuario conserva la titularidad jurídica de los catálogos, fotografías comerciales y textos que aporte o genere para su organización, y declara de forma expresa al confirmar cada lote que posee los derechos de propiedad intelectual, licencias comerciales o autorizaciones vigentes sobre cualquier sitio web cuya URL pegue en la plataforma o sobre cualquier imagen que suba desde su dispositivo.',
          'Al confirmar el procesamiento, otorgas a Search Link únicamente una licencia técnica limitada y revocable para optimizar, alojar en Cloudflare R2 y distribuir dichos recursos a través de tus endpoints o servidor externo. Queda estrictamente prohibido usar el extractor para apropiarse indebidamente de catálogos de competidores sin permiso o eludir restricciones de acceso; el usuario asume toda responsabilidad y mantendrá indemne a Search Link frente a reclamaciones de terceros sobre los contenidos que procese.',
        ],
      },
      {
        id: 'cuotas-y-limites-operativos',
        number: '05',
        title: 'Cuotas operativas, plan gratuito y control antiabuso',
        paragraphs: [
          'Search Link aplica límites técnicos para preservar la estabilidad compartida de la infraestructura:',
        ],
        bullets: [
          'Modo visitante (sin inicio de sesión): permite realizar pruebas limitadas de extracción directa de imágenes desde URLs públicas (máximo 10 imágenes visibles por consulta y límite por dirección IP/cookie firmada), sin almacenamiento en la nube ni mapeo con inteligencia artificial.',
          'Cuenta gratuita autenticada: habilita la compresión WebP, almacenamiento en Cloudflare R2, indexación semántica con IA y endpoints Search Link Core hasta un máximo acumulado de 20 imágenes dentro del plan gratuito.',
          'Simulador Search Link IA: sujeto a límites diarios razonables de consultas por navegador/sesión para evitar saturación automatizada.',
          'Prohibición de evasión y conservación antifraude de cuota gratuita: queda prohibido crear múltiples cuentas automatizadas, rotar proxies o borrar cuentas o archivos de almacenamiento para reiniciar créditos gratuitos. Si una cuenta en plan gratuito borra imágenes de R2 o elimina definitivamente su cuenta, Search Link conserva únicamente un registro mínimo cifrado por hash SHA-256 de las cuotas gratuitas ya consumidas para aplicarlo si vuelve a registrarse con el mismo correo. Quienes eliminen una cuenta con suscripción Plus activa y regresen posteriormente sin suscripción iniciarán normalmente con el límite estándar del plan gratuito.',
        ],
      },
      {
        id: 'api-keys-y-search-link-core',
        number: '06',
        title: 'Credenciales Search Link Core, API Keys y seguridad operativa',
        paragraphs: [
          'Cada servicio creado en tu organización dispone de un endpoint dedicado y una clave API secreta con prefijo slk_. Por razones de seguridad criptográfica, la clave completa se exhibe una sola vez en el momento de su generación o rotación; Search Link almacena únicamente su hash SHA-256.',
          'Debes resguardar tus claves API en entornos privados del lado del servidor y nunca exponerlas en código público o repositorios abiertos. Si sospechas que una clave ha sido comprometida, debes rotarla de inmediato o desactivar el servicio afectado desde tu panel de Organización. Search Link no responde por consumos ni exposiciones derivadas de la divulgación negligente de tus credenciales.',
        ],
      },
      {
        id: 'contenido-prohibido-y-reversion',
        number: '07',
        title: 'Contenido prohibido, bloqueo de dominios y reversión automática',
        paragraphs: [
          'Está terminantemente prohibido procesar a través de Search Link material pornográfico, desnudez sexualizada explícita, explotación o abuso sexual, violencia letal o gráfica extrema, armas ensanguentadas, mutilaciones, restos humanos, incitación al odio, estafas o contenido ilegal.',
          'Search Link aplica filtros automáticos de bloqueo inmediato de dominios incompatibles y evaluación visual multimodal sobre las imágenes enviadas al procesamiento en segundo plano. Cuando un lote infringe nuestras políticas de seguridad, aceptas expresamente que la plataforma detenga el trabajo de inmediato, elimine las imágenes implicadas de Cloudflare R2 y revierta cualquier registro provisional asociado sin derecho a compensación.',
        ],
      },
      {
        id: 'propiedad-intelectual-de-search-link',
        number: '08',
        title: 'Propiedad intelectual de Search Link',
        paragraphs: [
          'La marca Search Link, su logotipo geométrico, la interfaz visual, el código fuente del sitio web, la arquitectura de colas, los prompts de clasificación y el diseño de los endpoints Search Link Core son propiedad exclusiva de Search Link o de sus respectivos licenciantes, y se encuentran protegidos por las leyes aplicables de propiedad intelectual y derechos de autor.',
          'Nada en estos términos transfiere al usuario derecho alguno sobre nuestras marcas, diseño o infraestructura más allá del uso funcional autorizado mientras su cuenta permanezca activa.',
        ],
      },
      {
        id: 'disponibilidad-y-limitacion-de-responsabilidad',
        number: '09',
        title: 'Disponibilidad, Modo Agencia y limitación de responsabilidad',
        paragraphs: [
          'Search Link se presta "tal cual" y "según disponibilidad". Aunque diseñamos la plataforma con colas resilientes, cachés de protección y almacenamiento redundante, ciertas operaciones dependen de proveedores externos especializados (Supabase, Cloudflare, Render, Google Gemini y Groq) así como de la disponibilidad y estructura HTML de las páginas web externas que el usuario decida consultar.',
          'Cuando conectes tu propio servidor mediante Modo Agencia (Conecta tu servidor), la operación, seguridad, verificación de firma criptográfica y manejo de datos dentro de dicho servidor externo recaen exclusivamente bajo tu responsabilidad. Asimismo, respetamos solicitudes verificadas de retirada DMCA o exclusión inmediata de dominios.',
          'En la máxima medida permitida por la ley aplicable, Search Link no será responsable por pérdidas indirectas, lucro cesante, interrupciones de servidores externos, sitios web de terceros ni decisiones comerciales tomadas a partir de respuestas generadas por IA, limitándose cualquier eventual responsabilidad directa acumulada al monto efectivamente pagado por el usuario durante los últimos tres (3) meses previos al evento (siendo cero en modalidad gratuita o visitante).',
        ],
      },
      {
        id: 'suspension-modificaciones-y-vigencia',
        number: '10',
        title: 'Suspensión, cancelación y actualización de estos términos',
        paragraphs: [
          'Puedes dejar de utilizar Search Link, desactivar tus servicios públicos o rotar tus credenciales en cualquier momento directamente desde tu cuenta autenticada. Search Link se reserva el derecho de suspender temporal o definitivamente el acceso a cuentas, direcciones IP o servicios que incumplan gravemente estos Términos y condiciones, infrinjan reiteradamente las políticas de contenido o comprometan la seguridad e integridad de la plataforma.',
          'Podemos actualizar estos Términos y condiciones para reflejar nuevas capacidades técnicas, ajustes de cuotas o cambios regulatorios. La versión vigente se identificará siempre mediante la fecha de actualización indicada al final de este documento; el uso continuado de Search Link tras una actualización implica la aceptación de las condiciones revisadas.',
        ],
      },
    ],
    footerNote:
      'Search Link · Documento oficial de Términos y condiciones.',
  },

  en: {
    documentTitle: 'Terms and Conditions',
    documentCategory: 'Legal Documentation and Service Terms',
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
      'These Terms and Conditions govern your access to and use of the Search Link platform, including webpage image extraction, media optimization and hosting, AI-assisted catalog indexing, Search Link Core API endpoints, and Search Link AI.',
    sections: [
      {
        id: 'acceptance-of-terms',
        number: '01',
        title: 'Acceptance of terms and nature of the service',
        paragraphs: [
          'By browsing Search Link, submitting URLs in the public extractor, signing in with Google OAuth, or integrating any Search Link Core endpoint, you agree to be bound by these Terms and Conditions and our applicable Privacy and Usage Policies.',
          'Search Link provides automated technical infrastructure enabling merchants, organizations, and developers to convert webpage assets or image batches into structured catalogs queryable via API and conversational AI. Search Link acts solely as a technical processing provider and does not act as a commercial broker, merchant of record, or party to transactions between you and your end customers.',
        ],
      },
      {
        id: 'eligibility-and-accounts',
        number: '02',
        title: 'Eligibility, registration, and account accuracy',
        paragraphs: [
          'To register an authenticated Search Link account, you must be at least 18 years old or have full legal capacity to enter into binding agreements in your jurisdiction. If you use Search Link on behalf of a company or organization, you represent that you are authorized to bind that entity to these terms.',
          'Authenticated access is provided exclusively through Google OAuth. You are solely responsible for safeguarding your Google account, ensuring the accuracy of your Organization profile details, and all actions performed using your session or issued API keys.',
        ],
      },
      {
        id: 'license-and-permitted-use',
        number: '03',
        title: 'License grant and permitted technical scope',
        paragraphs: [
          'Subject to your ongoing compliance with these terms, Search Link grants you a limited, non-exclusive, revocable, non-transferable license to access the web application and query your active services via Search Link Core within applicable plan limits.',
          'You may not resell raw Search Link infrastructure as a standalone commodity without authorized integration, reverse engineer proprietary server workflows, attempt unauthorized access to other organizations, or run automated scraping against Search Link endpoints.',
        ],
      },
      {
        id: 'user-responsibility-for-inputs',
        number: '04',
        title: 'Responsibility for URLs, images, and third-party rights',
        paragraphs: [
          'You retain ownership over the product catalogs, commercial photography, and metadata generated for your organization, and by confirming each batch you expressly warrant that you hold all required intellectual property rights, commercial licenses, or valid authorizations for every webpage URL you submit and every image file you upload.',
          'By confirming processing, you grant Search Link solely a limited, revocable technical license to optimize, store in Cloudflare R2, and serve those assets via your configured endpoints or external server. Misappropriating third-party catalogs without authorization or bypassing external access controls is strictly prohibited, and you agree to assume sole responsibility and indemnify Search Link against any third-party claims arising from your submitted inputs.',
        ],
      },
      {
        id: 'quotas-and-abuse-limits',
        number: '05',
        title: 'Operational quotas, free tier limits, and anti-abuse rules',
        paragraphs: [
          'Search Link enforces technical boundaries to maintain shared platform stability:',
        ],
        bullets: [
          'Guest mode (unauthenticated): supports limited extraction tests from public URLs (up to 10 preview images per query, subject to IP/signed-cookie limits), without cloud hosting or AI catalog mapping.',
          'Authenticated free plan: provides WebP optimization, Cloudflare R2 storage, AI safety screening and indexing, and Search Link Core endpoints up to a cumulative allowance of 20 catalog images.',
          'Search Link AI simulator: subject to daily conversational rate limits per session/browser to prevent automated abuse.',
          'No circumvention and free-tier quota ledger: creating multiple automated accounts, rotating proxies, or deleting accounts or storage files to reset free credits is strictly prohibited. When a free-tier account purges R2 media or permanently deletes its account, Search Link retains only a minimal one-way SHA-256 email-hash ledger of consumed free quota to preserve accurate limits if the same email registers again. Accounts holding an active Plus subscription that are permanently deleted start cleanly under standard free-tier limits if later re-registered without a subscription.',
        ],
      },
      {
        id: 'api-keys-and-security',
        number: '06',
        title: 'Search Link Core credentials, API keys, and key custody',
        paragraphs: [
          'Each service created inside your organization receives a dedicated endpoint and a secret API key prefixed with slk_. For cryptographic security, the plaintext key is displayed only once upon issuance or rotation; only its SHA-256 hash is retained in storage.',
          'You must store API keys strictly in secure server-side environments and never expose them in public client code or open repositories. If a key is compromised, you must rotate it immediately or deactivate the affected service from your Organization panel.',
        ],
      },
      {
        id: 'prohibited-content-and-rollback',
        number: '07',
        title: 'Prohibited content, domain blocking, and automated rollback',
        paragraphs: [
          'Using Search Link to process explicit pornography, sexualized nudity, sexual exploitation, extreme graphic violence, bloodied weapons, mutilations, human remains, hate speech, fraud, or unlawful material is strictly forbidden.',
          'Search Link operates instant domain blocklists and automated multimodal safety inspection across background jobs. If a batch violates our content safety thresholds, you expressly agree that Search Link may immediately halt processing, purge all associated media from Cloudflare R2, and roll back incomplete database records without liability.',
        ],
      },
      {
        id: 'intellectual-property',
        number: '08',
        title: 'Search Link intellectual property',
        paragraphs: [
          'The Search Link name, geometric mark, visual interface, application codebase, queue orchestration, classification schemas, and Search Link Core API design remain the exclusive property of Search Link and its licensors, protected under applicable copyright and intellectual property laws.',
          'Nothing in these terms transfers ownership of any Search Link software, branding, or infrastructure to you beyond the limited functional access granted while your account remains active.',
        ],
      },
      {
        id: 'availability-and-liability',
        number: '09',
        title: 'Service availability, Agency Mode, and liability limits',
        paragraphs: [
          'Search Link is provided on an "as is" and "as available" basis. While engineered with resilient background queues, memory caches, and redundant object storage, platform execution depends on specialized infrastructure providers (Supabase, Cloudflare, Render, Google Gemini, and Groq) as well as the availability and structure of third-party websites submitted by users.',
          'When you connect your own external server under Agency Mode (Connect your server), uptime, security, signature verification, and data handling on that external server remain solely under your responsibility. We also honor verified DMCA takedown and immediate domain opt-out requests.',
          'To the maximum extent permitted by applicable law, Search Link shall not be liable for indirect or consequential damages, lost profits, external server outages, third-party websites, or commercial decisions based on AI outputs, and any aggregate direct liability is capped at fees actually paid by you during the three (3) months preceding the claim (zero for free or guest accounts).',
        ],
      },
      {
        id: 'suspension-and-updates',
        number: '10',
        title: 'Suspension, termination, and modifications to terms',
        paragraphs: [
          'You may stop using Search Link, deactivate public services, or rotate API credentials at any time directly from your authenticated workspace. Search Link reserves the right to suspend or terminate accounts, IP addresses, or services that materially breach these Terms and Conditions, repeatedly trigger safety enforcement, or threaten system security.',
          'We may revise these Terms and Conditions periodically to reflect new technical capabilities, quota updates, or legal requirements. The current version is indicated by the update date shown at the bottom of this document; continued use after updates take effect constitutes acceptance of the revised terms.',
        ],
      },
    ],
    footerNote:
      'Search Link · Official Terms and Conditions.',
  },

  pt: {
    documentTitle: 'Termos e condições',
    documentCategory: 'Documentação jurídica e termos do serviço',
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
      'Estes Termos e condições regulam o acesso e a utilização da plataforma Search Link, incluindo a extração de recursos web, otimização e hospedagem de mídia, catalogação automatizada por inteligência artificial, endpoints Search Link Core e o assistente Search Link IA.',
    sections: [
      {
        id: 'aceitacao-dos-termos',
        number: '01',
        title: 'Aceitação dos termos e natureza do serviço',
        paragraphs: [
          'Ao navegar no Search Link, utilizar a barra de extração pública, entrar com Google OAuth ou integrar qualquer endpoint do Search Link Core, o usuário concorda em vincular-se a estes Termos e condições e às Políticas de privacidade e uso vigentes.',
          'O Search Link fornece infraestrutura técnica automatizada para que lojistas, organizações e desenvolvedores transformem páginas web ou lotes de imagens em catálogos estruturados consultáveis por API e IA conversacional. O Search Link atua exclusivamente como provedor tecnológico de processamento, não atuando como intermediário comercial ou vendedor direto nas operações com seus clientes finais.',
        ],
      },
      {
        id: 'elegibilidade-e-contas',
        number: '02',
        title: 'Elegibilidade, cadastro e veracidade da conta',
        paragraphs: [
          'Para criar uma conta autenticada no Search Link, você deve ter no mínimo 18 anos ou plena capacidade civil para contratar serviços digitais em sua jurisdição. Caso utilize a plataforma em nome de uma empresa ou organização, declara possuir autorização para representá-la.',
          'O acesso autenticado ocorre exclusivamente via Google OAuth. Você é o único responsável pela segurança da sua conta Google, pela veracidade das informações configuradas na Organização e por todas as ações executadas com suas credenciais ou API Keys.',
        ],
      },
      {
        id: 'licenca-e-uso-permitido',
        number: '03',
        title: 'Licença de uso e escopo técnico permitido',
        paragraphs: [
          'Observado o cumprimento integral destes termos, o Search Link concede uma licença limitada, não exclusiva, revogável e intransferível para acessar a aplicação web e consultar seus serviços via Search Link Core dentro dos limites técnicos do seu plano.',
          'Não é permitido revender a infraestrutura bruta como serviço isolado, realizar engenharia reversa não autorizada de fluxos privados do servidor, tentar acessar dados de outras organizações ou executar varreduras automatizadas abusivas contra nossos endpoints.',
        ],
      },
      {
        id: 'responsabilidade-sobre-urls-e-imagens',
        number: '04',
        title: 'Responsabilidade sobre URLs, imagens e direitos de terceiros',
        paragraphs: [
          'O usuário mantém a titularidade sobre os catálogos, fotografias comerciais e metadados produzidos para sua organização e declara expressamente, ao confirmar cada lote, que detém os direitos autorais, licenças comerciais ou autorizações válidas sobre cada URL submetida e cada imagem enviada do dispositivo.',
          'Ao confirmar o processamento, você concede ao Search Link apenas uma licença técnica limitada e revogável para otimizar, armazenar no Cloudflare R2 e entregar tais recursos via seus endpoints ou servidor externo. É proibido usar o extrator para copiar catálogos de terceiros sem permissão, assumindo o usuário total responsabilidade e obrigação de indenidade diante de reclamações de terceiros sobre seus materiais.',
        ],
      },
      {
        id: 'cotas-e-limites-operacionais',
        number: '05',
        title: 'Cotas operacionais, plano gratuito e regras antiabuso',
        paragraphs: [
          'O Search Link aplica limites técnicos para preservar a estabilidade compartilhada da infraestrutura:',
        ],
        bullets: [
          'Modo visitante (sem login): permite testes limitados de extração direta de URLs públicas (máximo de 10 imagens por consulta, sujeito a controle por IP/cookie assinado), sem hospedagem em nuvem nem mapeamento por IA.',
          'Conta gratuita autenticada: habilita otimização WebP, armazenamento no Cloudflare R2, triagem e indexação por IA e endpoints Search Link Core até o limite acumulado de 20 imagens do plano gratuito.',
          'Simulador Search Link IA: sujeito a limites diários razoáveis de consultas por sessão/navegador contra abuso automatizado.',
          'Vedação a burla e registro antifraude de cota gratuita: é estritamente proibido criar múltiplas contas automatizadas, rotacionar proxies ou excluir contas e arquivos para reiniciar créditos gratuitos. Quando uma conta do plano gratuito exclui imagens do R2 ou encerra definitivamente a conta, o Search Link mantém apenas um registro mínimo por hash SHA-256 das cotas gratuitas já consumidas para preservar os limites reais caso o mesmo e-mail volte a se cadastrar. Contas com assinatura Plus ativa que forem excluídas definitivamente iniciam normalmente no limite padrão gratuito caso retornem depois sem assinatura.',
        ],
      },
      {
        id: 'api-keys-e-search-link-core',
        number: '06',
        title: 'Credenciais Search Link Core, API Keys e guarda de segredos',
        paragraphs: [
          'Cada serviço criado em sua organização recebe um endpoint exclusivo e uma API Key secreta com prefixo slk_. Por segurança criptográfica, a chave completa é exibida uma única vez na criação ou rotação; armazenamos apenas seu hash SHA-256.',
          'Você deve manter suas API Keys exclusivamente em ambientes seguros de servidor e nunca expô-las em código público ou repositórios abertos. Diante de qualquer suspeita de comprometimento, rotacione a chave ou desative o serviço imediatamente no painel de Organização.',
        ],
      },
      {
        id: 'conteudo-proibido-e-reversao',
        number: '07',
        title: 'Conteúdo proibido, bloqueio de domínios e reversão automática',
        paragraphs: [
          'É terminantemente proibido processar no Search Link pornografia explícita, nudez sexualizada, exploração sexual, violência gráfica extrema, armas ensanguentadas, mutilações, cadáveres, discurso de ódio, fraudes ou material ilícito.',
          'O Search Link aplica bloqueio instantâneo de domínios incompatíveis e inspeção multimodal automatizada no processamento em segundo plano. Caso um lote viole nossas políticas de segurança, você concorda expressamente que a plataforma interrompa imediatamente a fila, exclua todas as imagens relacionadas no Cloudflare R2 e reverta registros provisórios no banco de dados.',
        ],
      },
      {
        id: 'propriedade-intelectual-search-link',
        number: '08',
        title: 'Propriedade intelectual do Search Link',
        paragraphs: [
          'A marca Search Link, seu símbolo geométrico, a interface visual, o código-fonte, a arquitetura de filas, os esquemas de classificação e o desenho dos endpoints Search Link Core pertencem exclusivamente ao Search Link e seus licenciadores, protegidos pela legislação de propriedade intelectual.',
          'Estes termos não transferem ao usuário qualquer direito sobre nossas marcas, código ou infraestrutura além do uso funcional autorizado enquanto a conta estiver ativa.',
        ],
      },
      {
        id: 'disponibilidade-e-limitacao-de-responsabilidade',
        number: '09',
        title: 'Disponibilidade, Modo Agência e limitação de responsabilidade',
        paragraphs: [
          'O Search Link é fornecido "no estado em que se encontra" e "conforme disponibilidade". Embora operado com filas resilientes, caches em memória e armazenamento redundante, a execução depende de provedores externos especializados (Supabase, Cloudflare, Render, Google Gemini e Groq) e da disponibilidade dos sites externos informados pelo usuário.',
          'Ao conectar seu próprio servidor no Modo Agência (Conecte seu servidor), a operação, segurança, verificação de assinatura e tratamento de dados nesse servidor externo permanecem sob sua exclusiva responsabilidade. Também atendemos solicitações verificadas de remoção DMCA ou exclusão imediata de domínios.',
          'Na máxima extensão permitida em lei, o Search Link não se responsabiliza por danos indiretos, lucros cessantes, falhas em servidores externos, bloqueios impostos por sites de terceiros ou decisões comerciais baseadas em respostas geradas por IA, ficando eventual responsabilidade direta limitada aos valores pagos pelo usuário nos últimos três (3) meses anteriores ao evento (zero no plano gratuito ou visitante).',
        ],
      },
      {
        id: 'suspensao-e-atualizacoes',
        number: '10',
        title: 'Suspensão, encerramento e atualizações destes termos',
        paragraphs: [
          'Você pode encerrar o uso do Search Link, desativar serviços públicos ou rotacionar credenciais a qualquer momento diretamente em sua conta autenticada. O Search Link reserva-se o direito de suspender ou encerrar contas, endereços IP ou serviços que violem gravemente estes Termos e condições, reincidam em infrações de conteúdo ou ameacem a segurança da plataforma.',
          'Estes Termos e condições podem ser atualizados periodicamente para refletir evoluções técnicas, ajustes de cotas ou exigências legais. A versão em vigor estará indicada pela data ao final deste documento, e o uso contínuo após atualizações representa concordância com as novas condições.',
        ],
      },
    ],
    footerNote:
      'Search Link · Documento oficial de Termos e condições.',
  },
};
