import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { resolveApiUrl } from './apiConfig';

export type SupportedLocale = 'es' | 'en' | 'pt';
export type LocaleSource = 'geo' | 'header' | 'default' | 'manual';

export interface LanguageOption {
  code: SupportedLocale;
  nativeLabel: string;
  regionLabel: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: 'es',
    nativeLabel: 'Español',
    regionLabel: 'España y Latinoamérica',
  },
  {
    code: 'en',
    nativeLabel: 'English',
    regionLabel: 'United States, UK & Global',
  },
  {
    code: 'pt',
    nativeLabel: 'Português',
    regionLabel: 'Brasil e Portugal',
  },
];

export const BENEFIT_IDS = [
  'speed',
  'clean-urls',
  'easy-anywhere',
  'ready-to-share',
] as const;

export type BenefitId = (typeof BENEFIT_IDS)[number];

export interface TranslationDictionary {
  common: {
    accept: string;
    cancel: string;
    close: string;
    continueBtn: string;
    copied: string;
    copiedFem: string;
    copy: string;
    edit: string;
    generalCategory: string;
    nextBtn: string;
    productFallback: string;
    skip: string;
    userFallback: string;
  };
  app: {
    uploadImagesAria: string;
    uploadImagesTitle: string;
    pasteUrlFormAria: string;
    urlPlaceholder: string;
    urlInputAria: string;
    extractingAria: string;
    clearUrlAria: string;
    extractEmptyError: string;
    extractNetworkError: string;
    freePlanLimitNotice: (maxImages: number) => string;
    freeRemainingNotice: (remaining: number, total: number) => string;
    freeImageQuotaExceededError: string;
    guestExtractOnlyNotice: string;
    guestIpBlockedError: string;
    adminExtractOnlyNotice: (count: number) => string;
    domainRightsPromptQuestion: string;
    domainRightsPromptAccept: string;
    domainPromptQuestion: string;
    domainPromptCancel: string;
    domainPromptContinue: string;
    savedCatalogPromptQuestion: string;
    savedCatalogPromptAccept: string;
    noSavedCatalogImagesError: string;
    savedCatalogAuthRequiredError: string;
    invalidImageFilesError: string;
    uploadImageError: string;
    mapImageError: string;
    serviceDefaultPrefix: (productName: string) => string;
    coreSavedNotice: string;
    imageFallbackAlt: (index: number) => string;
    openAccountMenuAria: (name: string) => string;
    openAuthAria: string;
    openAuthTitle: string;
    imageUploadAria: (status: string, alt: string) => string;
    receiveStatusAria: (status: string, alt: string) => string;
    compressionStatusAria: (status: string, alt: string) => string;
    blockedDomainPolicyError: string;
  };
  imageBank: {
    openAria: string;
    openTitle: string;
    brandTitle: string;
    publicBankNotice: string;
    publicBankLinkLabel: string;
    publicBankSecondLinkLabel: string;
    savedAria: string;
    savedTitle: string;
    savedFullTitle: string;
    closeSavedAria: string;
    savedEmptyHint: string;
    placeholder: string;
    inputAria: string;
    clearQueryAria: string;
    closeAria: string;
    panelAria: string;
    searchingAria: string;
    noResultsNotice: string;
    searchErrorFallback: string;
    saveImageAria: (alt: string) => string;
    unsaveImageAria: (alt: string) => string;
    removeSavedAria: (alt: string) => string;
    cooldownNotice: (waitText: string) => string;
    generateCardTitle: string;
    generateCardPlusBadge: string;
    generatingAiLabel: string;
    plusRequiredNotice: string;
    generatedAutoSavedBadge: string;
  };
  examples: {
    sectionAria: string;
    sectionTitle: string;
    sectionSubtitle: string;
    cardAria: (platformLabel: string) => string;
    visitorName: string;
    items: Record<
      | 'whatsapp'
      | 'telegram'
      | 'instagram'
      | 'messenger'
      | 'web'
      | 'discord'
      | 'slack'
      | 'line',
      {
        bottomLabel: string;
        accountType: string;
        headerSubline: string;
        userGreeting: string;
        botGreeting: string;
        userRequest: string;
        botResultText: string;
        products: [
          { name: string; subtitle: string },
          { name: string; subtitle: string },
        ];
      }
    >;
  };
  menu: {
    account: string;
    accountCreatedOn: (formattedDate: string) => string;
    accountMenuAria: string;
    accountOptionsAria: string;
    backToMenuAria: string;
    backToOrgAria: string;
    closeAccountModalAria: string;
    closeMenuAria: string;
    closeOrgAria: string;
    closeStoreAria: string;
    confirmSignOutAria: string;
    confirmSignOutDescDesktop: string;
    confirmSignOutDescMobile: string;
    confirmSignOutTitle: string;
    createdAtLabel: string;
    dateUnavailable: string;
    googleAccount: string;
    googleAccountDetailsAria: string;
    googleAccountLabel: string;
    language: string;
    languageAutoDetectedNote: (countryCode: string | null) => string;
    languageLocalStorageHint: string;
    languageManualSavedNote: string;
    languageOptionsAria: string;
    languageSectionPrompt: string;
    languagesTitle: string;
    myStore: string;
    organization: string;
    signOut: string;
    signOutError: string;
    usernameLabel: string;
    documentation: string;
    privacyAndUse: string;
    termsAndConditions: string;
    contentPolicies: string;
    cookiePolicies: string;
    agencyMode: string;
    agencyModeGuide: string;
    agencyModeLiability: string;
    intellectualPropertyAndLiability: string;
    comingSoon: string;
    connectServer: string;
    closeConnectServerAria: string;
    goToAdvancedSettings: string;
    advancedSettings: string;
    backToGoogleAccountAria: string;
    closeAdvancedSettingsAria: string;
  };
  auth: {
    acceptTermsLabel: string;
    acceptTermsPrefix: string;
    acceptTermsLinkLabel: string;
    acceptTermsMiddle: string;
    acceptPrivacyLinkLabel: string;
    acceptTermsSuffix: string;
    bullet1: string;
    bullet2: string;
    bullet3: string;
    closePanelAria: string;
    connectingGoogle: string;
    continueWithGoogle: string;
    drawerAriaGuest: string;
    errProviderNotEnabled: string;
    errRateLimit: string;
    googleLinkError: string;
    googleSignInError: string;
    googleSignedInSuccess: string;
    loginHeading: string;
    loginSubtitle: string;
    openGoogleNewTab: string;
    popupBlockedError: string;
    supabaseMissingError: string;
    termsError: string;
  };
  chat: {
    clearConversation: string;
    clearShort: string;
    closeAria: string;
    dailyLimitNotice: string;
    dailyLimitPlaceholder: string;
    defaultRequestError: string;
    defaultStreamError: string;
    defaultSuccessReply: string;
    inputAria: string;
    inputPlaceholder: string;
    liveProducts: (count: number) => string;
    networkError: string;
    preparingReply: string;
    queryingCatalog: string;
    sendAria: string;
  };
  org: {
    apiHintPrefixDesktop: string;
    apiHintPrefixMobile: string;
    apiHintRaw: string;
    changeLogoAria: string;
    changeLogoTitle: string;
    closeBoxAria: string;
    companyPlaceholder: string;
    congratsBoth: string;
    congratsLogoOnly: string;
    congratsMobileFallback: string;
    congratsNameOnly: string;
    congratsTitle: string;
    copyCurlDesktop: string;
    copyCurlMobile: string;
    curlCopied: string;
    helperArrowPrompt: string;
    logoUploadError: string;
    myServices: string;
    newProduct: string;
    noServicesAvailable: string;
    noServicesDescDesktop: string;
    noServicesDescMobile: string;
    noServicesTitleDesktop: string;
    noServicesTitleMobile: string;
    openStoreAria: string;
    openStoreServicesAria: string;
    orgNamePlaceholder: string;
    orgNameShortPlaceholder: string;
    pasteKeyPlaceholder: string;
    pickStoreAria: string;
    productCount: (count: number) => string;
    productCountShort: (count: number) => string;
    regenerateKeyDesktop: string;
    regenerateKeyMobile: string;
    renameOrgAria: string;
    renameOrgTitle: string;
    renameServiceAria: (name: string) => string;
    renameServiceTitle: string;
    saveOrgNameAria: string;
    saveServiceNameAria: string;
    serviceActiveDesktop: string;
    serviceActiveMobile: string;
    serviceApiLink: string;
    serviceEndpointLink: string;
    servicePausedDesktop: string;
    servicePausedMobile: string;
    testChatAria: (name: string) => string;
    testChatTitle: string;
    testLive: string;
    unnamed: string;
    uploadLogoAria: string;
    uploadLogoTitle: string;
    viewHistoryAria: (name: string) => string;
    viewHistoryTitle: string;
    viewStoreOf: string;
    viewStoreTitle: string;
    welcomeSubtitle: string;
    welcomeTitle: string;
    moreActionsAria: (name: string) => string;
    menuSearchAi: string;
    menuViewProcess: string;
    menuViewSchema: string;
    schemaTitle: string;
    copySchemaAria: string;
    downloadSchemaZipAria: string;
    downloadSchemaZipTitle: string;
    backToOrgSchemaAria: string;
  };
  store: {
    emptyDescDesktop: string;
    emptyDescMobile: string;
    emptyTitle: string;
    noImage: string;
    tapToCollapse: string;
    tapToExpandFull: (name: string) => string;
    unnamedProduct: string;
  };
  pipeline: {
    backToMappedAria: string;
    benefits: Array<{
      id: BenefitId;
      title: string;
      description: string;
    }>;
    clickToViewTitle: (alt: string) => string;
    closeEditorBackAria: string;
    closeEditorTitle: string;
    closeExpandedAria: string;
    closeFullscreenAria: string;
    closeImageAria: string;
    congratsBodyDesktop: (count: number) => string;
    congratsBodyMobile: (count: number) => string;
    congratsTitleDesktop: string;
    congratsTitleMobile: string;
    copyAllJsonAria: string;
    copyApiAria: string;
    copyApiTitle: string;
    copyEndpointAria: string;
    copyEndpointTitle: string;
    copyJsonOfAria: (name: string) => string;
    copyJsonTitle: string;
    copyUrlOfAria: (label: string) => string;
    copyUrlTitle: string;
    couldNotMap: string;
    couldNotReceive: string;
    credentialsReadyHint: string;
    credentialsReadyTitle: string;
    doubleClickFullscreen: (alt: string) => string;
    elementsCount: (count: number) => string;
    enlargeLeftAria: (alt: string) => string;
    expandedImagesAria: string;
    expandedMetadataAria: string;
    generatedApiTitle: string;
    generatedApisLink: string;
    generatedEndpointLink: string;
    generatingApiKey: string;
    generatingEndpoint: string;
    goToLifecycleAria: string;
    mobileCarouselAria: string;
    mobileCompressionAria: string;
    openOriginalImageTitle: (alt: string) => string;
    pdfActions: {
      json: string;
      images: string;
      urls: string;
      metadata: string;
      all: string;
      openEditor: string;
      schema: string;
    };
    productJsonLabel: string;
    readOnlyEditorAria: string;
    searchingImages: string;
    showJsonAria: (isExpanded: boolean, name: string) => string;
    stageCompressingTitle: string;
    stageEditorTitle: string;
    stageImagesTitle: string;
    stageLifecycleFullTitle: string;
    stageLifecycleTitle: string;
    stageMappedDoneTitle: string;
    stageMappingTitle: string;
    stageMetadataTitle: string;
    stageProductivityTitle: string;
    stageReceivingTitle: string;
    stageUploadingTitle: string;
    stageViewApiTitle: string;
    tapBorderToExpand: string;
    useAsBackgroundAria: (alt: string) => string;
    viewInBackgroundTitle: (alt: string) => string;
    viewProductAria: (name: string) => string;
    viewYourOrg: string;
    whyUseSearchLink: string;
    whyUseSearchLinkAria: string;
  };
  connectServer: {
    title: string;
    serverUrlLabel: string;
    serverUrlPlaceholder: string;
    serverUrlAria: string;
    showUrlAria: string;
    hideUrlAria: string;
    chooseServiceLabel: string;
    chooseServicePlaceholder: string;
    chooseServiceMenuAria: string;
    allServicesSelected: string;
    syncAllOption: string;
    newServicesSelected: string;
    syncNewServicesOption: string;
    noServicesHint: string;
    secretKeyLabel: string;
    secretKeyAria: string;
    showSecretAria: string;
    hideSecretAria: string;
    copySecretAria: string;
    secretHelpTrigger: string;
    secretHelpTitle: string;
    secretHelpCloseAria: string;
    secretHelpWhyTitle: string;
    secretHelpWhyBody: string;
    secretHelpVarRuleTitle: string;
    secretHelpVarRuleBody: string;
    secretHelpVarNameLabel: string;
    secretHelpExampleValueLabel: string;
    secretHelpExampleValue: string;
    secretHelpExampleHint: string;
    secretHelpProvidersTitle: string;
    secretHelpProviders: Array<{
      id: string;
      name: string;
      steps: string[];
    }>;
    secretHelpFinalStepTitle: string;
    secretHelpFinalStepBody: string;
    syncAction: string;
    syncingAction: string;
    validationUrlRequired: string;
    validationUrlInvalid: string;
    validationServiceRequired: string;
    noServicesToSync: string;
    authRequired: string;
    syncSuccess: (services: number, products: number, durationMs: number) => string;
    syncNewServicesSuccess: (durationMs: number) => string;
    syncNetworkError: string;
    syncLiabilityConfirmText: string;
    disconnectAction: string;
    disconnectingAction: string;
    disconnectConfirmPrompt: string;
    disconnectConfirmPhrase: string;
    disconnectConfirmPlaceholder: string;
    disconnectConfirmInputAria: string;
    disconnectSuccess: string;
    disconnectNetworkError: string;
    quickServerTitle: string;
    quickServerFilesAria: string;
    downloadQuickServerZipAria: string;
    downloadQuickServerZipTitle: string;
    copyQuickServerFileAria: string;
    swipeHintLabel: string;
    swipeToQuickServerAria: string;
    backToConnectServerAria: string;
    testRequestAction: string;
    testServerTitle: string;
    testConsentPrompt: string;
    testRunningLabel: string;
    testEmptyCatalogNote: string;
    testStatusLabel: string;
    testLatencyLabel: string;
    testImagesCountLabel: string;
    testRetryAction: string;
    testCloseAria: string;
  };
  advancedSettings: {
    title: string;
    confirmPromptAria: string;
    r2DeleteTitle: string;
    r2DeleteButton: string;
    r2DeleteConfirmText: string;
    clearBrowserDataTitle: string;
    clearBrowserDataButton: string;
    clearBrowserDataConfirmText: string;
    deleteAccountTitle: string;
    deleteAccountButton: string;
    deleteAccountConfirmText: string;
    pauseAllApisTitle: string;
    pauseAllApisButton: string;
    pauseAllApisConfirmText: string;
    r2PurgeSuccess: (deletedCount: number) => string;
    r2EmptyError: string;
    pauseApisSuccess: (servicesCount: number) => string;
    thingsYouCanDoTitle: string;
    unfreezeApisSubtitle: string;
    unfreezeApisButton: string;
    unfreezeApisSuccess: (servicesCount: number) => string;
    actionErrorFallback: string;
  };
}

const ES_DICTIONARY: TranslationDictionary = {
  common: {
    accept: 'Aceptar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    continueBtn: 'Continuar',
    copied: 'Copiado',
    copiedFem: 'Copiada',
    copy: 'Copiar',
    edit: 'Editar',
    generalCategory: 'General',
    nextBtn: 'Siguiente',
    productFallback: 'Producto',
    skip: 'Omitir',
    userFallback: 'Usuario',
  },
  app: {
    uploadImagesAria: 'Subir imágenes desde el dispositivo',
    uploadImagesTitle: 'Subir imágenes desde tu dispositivo',
    pasteUrlFormAria: 'Pegar URL de página web',
    urlPlaceholder: 'Pega aquí la URL de tu página web...',
    urlInputAria: 'URL de tu página web',
    extractingAria: 'Extrayendo imágenes',
    clearUrlAria: 'Limpiar URL',
    extractEmptyError: 'No pudimos encontrar imágenes válidas en esa dirección web.',
    extractNetworkError:
      'No se pudo conectar con la página. Verifica la URL e intenta de nuevo.',
    freePlanLimitNotice: (max) =>
      `Plan gratuito: se procesarán ${max === 1 ? 'la imagen disponible' : `las primeras ${max} imágenes`}.`,
    freeRemainingNotice: (remaining, total) =>
      `Plan gratuito: te quedan ${remaining} de ${total} imágenes disponibles.`,
    freeImageQuotaExceededError:
      'Has alcanzado el límite de 20 imágenes del plan gratuito.',
    guestExtractOnlyNotice:
      'No has iniciado sesión, solo puedes probar este método.',
    guestIpBlockedError: 'Su IP ha sido bloqueado. Inicia sesión.',
    adminExtractOnlyNotice: (count) =>
      `Modo prueba admin: ${count} imagen${count === 1 ? '' : 'es'} extraída${count === 1 ? '' : 's'} del dominio (detenido tras la extracción, sin compresión ni mapeo IA).`,
    domainRightsPromptQuestion:
      'Al confirmar, aceptas que estas imágenes son de tu propiedad o cuentas con licencia y permiso de uso, siendo tu responsabilidad y no de Search Link.',
    domainRightsPromptAccept: 'Aceptar',
    domainPromptQuestion:
      'Si lo deseas, puedes detenerlo y subir desde almacenamiento.',
    domainPromptCancel: 'Cancelar',
    domainPromptContinue: 'Continuar',
    savedCatalogPromptQuestion: '¿Estás seguro de usar las imágenes del catálogo?',
    savedCatalogPromptAccept: 'Aceptar',
    noSavedCatalogImagesError: 'No encontramos imágenes guardadas.',
    savedCatalogAuthRequiredError: 'Inicia sesión con Google para procesar tu catálogo.',
    invalidImageFilesError: 'Por favor selecciona archivos de imagen válidos.',
    uploadImageError: 'Error al subir la imagen.',
    mapImageError: 'Error al renderizar y mapear la imagen con IA.',
    serviceDefaultPrefix: (name) => `Servicio ${name}`,
    coreSavedNotice: 'Servicio y API guardados en Search Link Core.',
    imageFallbackAlt: (index) => `Imagen ${index}`,
    openAccountMenuAria: (name) => `Abrir menú de cuenta (${name})`,
    openAuthAria: 'Abrir registro de cuenta',
    openAuthTitle: 'Crear cuenta o iniciar sesión',
    imageUploadAria: (status, alt) =>
      status === 'pending'
        ? `En cola para guardar ${alt}`
        : status === 'uploading'
          ? `Guardando ${alt} en la nube`
          : status === 'done'
            ? `${alt} guardada`
            : `Error al guardar ${alt}`,
    receiveStatusAria: (status, alt) =>
      status === 'waiting'
        ? `Recibiendo URL de ${alt}`
        : status === 'received'
          ? `URL recibida para ${alt}`
          : `Error al recibir ${alt}`,
    compressionStatusAria: (status, alt) =>
      status === 'rendering'
        ? `Renderizando ${alt}`
        : status === 'compressing'
          ? `Comprimiendo ${alt}`
          : status === 'done'
            ? `${alt} comprimida`
            : `Error al comprimir ${alt}`,
    blockedDomainPolicyError: 'Este dominio viola nuestras políticas de contenido',
  },
  imageBank: {
    openAria: 'Buscar imágenes en banco de imágenes',
    openTitle: 'Buscar imágenes',
    brandTitle: 'Search Link Pexels',
    publicBankNotice:
      'Este servicio utiliza los bancos públicos de Pexels y Pixabay. Al usarlas, aceptas que pertenecen a dichos bancos públicos y no a ti ni a Search Link, pero cuentas con permiso de uso. Si quieres ver:',
    publicBankLinkLabel: 'pexels.com',
    publicBankSecondLinkLabel: 'pixabay.com',
    savedAria: 'Ver imágenes guardadas',
    savedTitle: 'Guardado',
    savedFullTitle: 'Guardado',
    closeSavedAria: 'Cerrar Guardado',
    savedEmptyHint: 'Aquí verás las imágenes que guardes para tus catálogos.',
    placeholder: 'Describe la imagen que buscas...',
    inputAria: 'Descripción de la imagen que buscas',
    clearQueryAria: 'Limpiar búsqueda',
    closeAria: 'Cerrar buscador de imágenes',
    panelAria: 'Buscador de imágenes',
    searchingAria: 'Buscando imágenes',
    noResultsNotice: 'No encontramos imágenes para esa búsqueda. Prueba con otra descripción.',
    searchErrorFallback: 'No se pudo completar la búsqueda en el banco público.',
    saveImageAria: (alt) => `Guardar ${alt}`,
    unsaveImageAria: (alt) => `Quitar de Guardado: ${alt}`,
    removeSavedAria: (alt) => `Eliminar de Guardado: ${alt}`,
    cooldownNotice: (waitText) =>
      `Prohibido saturar servidores ajenos. Espera ${waitText}`,
    generateCardTitle: 'Generar con IA',
    generateCardPlusBadge: 'Es una función Plus',
    generatingAiLabel: 'Generando con IA...',
    plusRequiredNotice: 'Tienes que ser nivel Plus para generar.',
    generatedAutoSavedBadge: 'Guardado',
  },
  examples: {
    sectionAria: 'Ejemplos de automatizaciones',
    sectionTitle: 'Ejemplos de automatizaciones',
    sectionSubtitle: 'Cómo actúa Search Link en diferentes plataformas',
    cardAria: (platformLabel) => `Ejemplo en ${platformLabel}`,
    visitorName: 'Visitante',
    items: {
      whatsapp: {
        bottomLabel: 'WhatsApp · Chatbots',
        accountType: 'Enterprise',
        headerSubline: 'Catálogo automático',
        userGreeting: 'Hola',
        botGreeting: '¡Hola! ¿Cómo estás? ¿Qué estás buscando hoy?',
        userRequest: 'Quiero ver el catálogo de calzado blanco',
        botResultText: 'Aquí tienes lo que tenemos en catálogo.',
        products: [
          { name: 'Veloce Court', subtitle: 'Cuero blanco' },
          { name: 'Veloce Runner', subtitle: 'Knit marfil' },
        ],
      },
      telegram: {
        bottomLabel: 'Telegram · Bots',
        accountType: 'Bot Oficial',
        headerSubline: 'Concesionario digital',
        userGreeting: 'Hola, busco autos',
        botGreeting: '¡Bienvenido! ¿Prefieres sedán eléctrico o SUV?',
        userRequest: 'Muéstrame los disponibles hoy',
        botResultText: 'Estos dos modelos están listos para entrega.',
        products: [
          { name: 'Apex Air EV', subtitle: 'Sedán eléctrico' },
          { name: 'Apex Terra', subtitle: 'SUV híbrida' },
        ],
      },
      instagram: {
        bottomLabel: 'Instagram · DM Bot',
        accountType: 'Tienda',
        headerSubline: 'Respuestas en DM',
        userGreeting: 'Hola, me gustó su reel',
        botGreeting: '¡Gracias! ¿Qué accesorio quieres revisar?',
        userRequest: 'Relojes y gafas para regalo',
        botResultText: 'Aquí tienes nuestros favoritos de temporada.',
        products: [
          { name: 'Crono Cuero', subtitle: 'Edición clásica' },
          { name: 'Gafas Carey', subtitle: 'Filtro UV400' },
        ],
      },
      messenger: {
        bottomLabel: 'Messenger · Meta Bot',
        accountType: 'Hogar',
        headerSubline: 'Asesor de espacios',
        userGreeting: 'Buenas, vi su anuncio',
        botGreeting: '¡Hola! ¿Para qué espacio buscas piezas?',
        userRequest: 'Algo minimalista para la sala',
        botResultText: 'Estas dos piezas combinan perfecto juntas.',
        products: [
          { name: 'Silla Roble', subtitle: 'Tela beige' },
          { name: 'Monstera Maceta', subtitle: 'Cerámica mate' },
        ],
      },
      web: {
        bottomLabel: 'Chat Web · Tienda',
        accountType: 'Web Widget',
        headerSubline: 'Menú en línea',
        userGreeting: 'Hola, ¿qué recomiendan?',
        botGreeting: '¡Hola! Todo sale recién hecho. ¿Qué te provoca?',
        userRequest: 'Algo rápido para cenar hoy',
        botResultText: 'Nuestros dos platos más pedidos esta noche.',
        products: [
          { name: 'Burger Brioche', subtitle: 'Cheddar maduro' },
          { name: 'Pizza Margarita', subtitle: 'Masa madre' },
        ],
      },
      discord: {
        bottomLabel: 'Discord · Bot API',
        accountType: 'APP',
        headerSubline: '#tienda-hardware',
        userGreeting: 'Hola, busco setup oscuro',
        botGreeting: '¡Qué tal! ¿Buscas audio o periféricos?',
        userRequest: 'Muéstrame teclado y audífonos',
        botResultText: 'Ambos disponibles con envío inmediato.',
        products: [
          { name: 'Pulse Audio Pro', subtitle: 'Negro mate' },
          { name: 'Teclado 65%', subtitle: 'Aluminio ámbar' },
        ],
      },
      slack: {
        bottomLabel: 'Slack · App B2B',
        accountType: 'Empresa',
        headerSubline: '#compras-oficina',
        userGreeting: 'Hola, renovamos oficina',
        botGreeting: 'Con gusto. ¿Qué equipamiento necesitan cotizar?',
        userRequest: 'Sillas ergonómicas y tazas',
        botResultText: 'Catálogo corporativo listo para pedido.',
        products: [
          { name: 'Silla Mesh Pro', subtitle: 'Aluminio B2B' },
          { name: 'Set Cerámica', subtitle: 'Lote oficina' },
        ],
      },
      line: {
        bottomLabel: 'LINE · Official Account',
        accountType: 'Oficial',
        headerSubline: 'Asistente cosmético',
        userGreeting: 'Hola, busco skincare',
        botGreeting: '¡Hola! ¿Te interesa sérum o fragancia?',
        userRequest: 'Muéstrame ambos por favor',
        botResultText: 'Aquí tienes nuestras fórmulas más buscadas.',
        products: [
          { name: 'Sérum Ámbar', subtitle: 'Uso nocturno' },
          { name: 'Esencia Botánica', subtitle: 'Notas cálidas' },
        ],
      },
    },
  },
  menu: {
    account: 'Cuenta',
    accountCreatedOn: (date) => `Creada el ${date}`,
    accountMenuAria: 'Menú de cuenta',
    accountOptionsAria: 'Opciones de cuenta',
    backToMenuAria: 'Volver al menú',
    backToOrgAria: 'Volver a Organización',
    closeAccountModalAria: 'Cerrar cuenta de Google',
    closeMenuAria: 'Cerrar menú',
    closeOrgAria: 'Cerrar Organización',
    closeStoreAria: 'Cerrar Mi tienda',
    confirmSignOutAria: 'Confirmar cierre de sesión',
    confirmSignOutDescDesktop:
      'Tu organización y servicios guardados permanecerán seguros para cuando vuelvas.',
    confirmSignOutDescMobile:
      'Tu organización y servicios permanecerán guardados.',
    confirmSignOutTitle: '¿Cerrar sesión ahora?',
    createdAtLabel: 'Creación de cuenta',
    dateUnavailable: 'Fecha no disponible',
    googleAccount: 'Cuenta de Google',
    googleAccountDetailsAria: 'Detalles de cuenta de Google',
    googleAccountLabel: 'Correo electrónico',
    language: 'Idioma',
    languageAutoDetectedNote: (countryCode) =>
      countryCode
        ? `Detectado automáticamente según tu ubicación (${countryCode}).`
        : 'Detectado automáticamente según tu navegador.',
    languageLocalStorageHint:
      'Tu elección manual se guarda localmente en este dispositivo.',
    languageManualSavedNote: 'Idioma seleccionado manualmente.',
    languageOptionsAria: 'Idiomas disponibles',
    languageSectionPrompt: 'Elige el idioma de toda la interfaz y de Search Link IA.',
    languagesTitle: 'Idiomas disponibles',
    myStore: 'Mi tienda',
    organization: 'Organización',
    signOut: 'Cerrar sesión',
    signOutError: 'No se pudo cerrar sesión. Intenta de nuevo.',
    usernameLabel: 'Nombre',
    documentation: 'Documentaciones',
    privacyAndUse: 'Políticas de privacidad y uso',
    termsAndConditions: 'Términos y condiciones',
    contentPolicies: 'Políticas de contenido',
    cookiePolicies: 'Políticas de cookies',
    agencyMode: 'Modo Agencia',
    agencyModeGuide: 'Cosas a tener en cuenta en Modo Agencia',
    agencyModeLiability: 'Responsabilidad y propiedad en Modo Agencia',
    intellectualPropertyAndLiability: 'Propiedad intelectual y responsabilidad',
    comingSoon: 'Próximamente',
    connectServer: 'Conecta tu servidor',
    closeConnectServerAria: 'Cerrar Conecta tu servidor',
    goToAdvancedSettings: 'Ir a ajustes avanzados',
    advancedSettings: 'Ajustes avanzados',
    backToGoogleAccountAria: 'Volver a Cuenta de Google',
    closeAdvancedSettingsAria: 'Cerrar Ajustes avanzados',
  },
  auth: {
    acceptTermsLabel: 'Acepto los términos y políticas de privacidad de Search Link.',
    acceptTermsPrefix: 'Acepto los ',
    acceptTermsLinkLabel: 'términos',
    acceptTermsMiddle: ' y ',
    acceptPrivacyLinkLabel: 'políticas de privacidad',
    acceptTermsSuffix: ' de Search Link.',
    bullet1: 'Sesión segura y cifrada con Google',
    bullet2: 'Catálogos y medios sincronizados en la nube',
    bullet3: 'API Keys y endpoints Search Link Core al instante',
    closePanelAria: 'Cerrar panel de cuenta',
    connectingGoogle: 'Conectando con Google…',
    continueWithGoogle: 'Continuar con Google',
    drawerAriaGuest: 'Iniciar sesión en Search Link',
    errProviderNotEnabled:
      'Google OAuth aún no está habilitado en este proyecto de Supabase.',
    errRateLimit: 'Demasiados intentos en poco tiempo. Espera un momento.',
    googleLinkError: 'No pudimos generar el enlace de Google OAuth.',
    googleSignInError: 'Ocurrió un error al iniciar sesión con Google.',
    googleSignedInSuccess: 'Sesión iniciada con Google correctamente.',
    loginHeading: 'Guarda tus catálogos y obtén tu API',
    loginSubtitle:
      'Conecta tu cuenta de Google en un clic para sincronizar productos, endpoints y métricas en tiempo real.',
    openGoogleNewTab: 'Abrir Google en pestaña nueva',
    popupBlockedError:
      'El navegador bloqueó la ventana emergente de Google. Usa el enlace de abajo.',
    supabaseMissingError:
      'La configuración de Supabase no está disponible en este entorno.',
    termsError: 'Acepta los términos para continuar con Google.',
  },
  chat: {
    clearConversation: 'Reiniciar conversación',
    clearShort: 'Nueva conversación',
    closeAria: 'Cerrar chat de prueba',
    dailyLimitNotice:
      'Su límite ha sido alcanzado, pase al plan Plus.',
    dailyLimitPlaceholder: 'Límite diario alcanzado...',
    defaultRequestError: 'No se pudo obtener respuesta de Search Link IA.',
    defaultStreamError: 'Error durante la respuesta en vivo.',
    defaultSuccessReply: 'Consulta completada.',
    inputAria: 'Escribe una consulta para probar el catálogo',
    inputPlaceholder: 'Pregunta por cualquier producto del catálogo...',
    liveProducts: (count) => `${count} producto${count === 1 ? '' : 's'} en vivo`,
    networkError: 'Error de conexión con Search Link IA. Intenta de nuevo.',
    preparingReply: 'Preparando respuesta…',
    queryingCatalog: 'Consultando catálogo en vivo…',
    sendAria: 'Enviar mensaje',
  },
  org: {
    apiHintPrefixDesktop:
      'Por seguridad solo guardamos el prefijo en la nube. Si necesitas la llave completa, puedes regenerarla al instante.',
    apiHintPrefixMobile:
      'Solo almacenamos el prefijo por seguridad. Puedes regenerar la llave cuando quieras.',
    apiHintRaw:
      'Incluye esta llave en Authorization: Bearer <API_KEY> o x-api-key para consultar este servicio.',
    changeLogoAria: 'Cambiar logo de organización',
    changeLogoTitle: 'Cambiar logo',
    closeBoxAria: 'Cerrar ventana',
    companyPlaceholder: 'Nombre de tu empresa o marca',
    congratsBoth:
      'Ya quedaron guardados tu logo y el nombre de tu organización. Todo está listo para administrar tus servicios.',
    congratsLogoOnly:
      'Tu logo quedó guardado correctamente. Puedes agregar o editar el nombre cuando quieras.',
    congratsMobileFallback:
      'Tu organización ya quedó configurada para publicar catálogos y endpoints.',
    congratsNameOnly:
      'El nombre de tu organización ya quedó guardado. También puedes subir un logo más adelante.',
    congratsTitle: '¡Organización configurada!',
    copyCurlDesktop: 'Copiar comando cURL',
    copyCurlMobile: 'Copiar cURL',
    curlCopied: 'cURL copiado',
    helperArrowPrompt:
      'Sube el logo o escribe el nombre de tu negocio para personalizar tus endpoints y tienda.',
    logoUploadError: 'No se pudo subir el logo.',
    myServices: 'Mis servicios',
    newProduct: 'Nuevo producto',
    noServicesAvailable: 'Aún no hay servicios activos',
    noServicesDescDesktop:
      'Procesa una URL o sube tus imágenes desde la pantalla principal para generar tu primer endpoint en vivo.',
    noServicesDescMobile:
      'Procesa una URL o sube imágenes desde el inicio para ver tus servicios aquí.',
    noServicesTitleDesktop: 'Todavía no tienes servicios generados',
    noServicesTitleMobile: 'Aún no hay servicios',
    openStoreAria: 'Abrir tienda del servicio',
    openStoreServicesAria: 'Abrir selector de Mi tienda',
    orgNamePlaceholder: 'Nombre de la organización',
    orgNameShortPlaceholder: 'Nombre de tu marca',
    pasteKeyPlaceholder: 'Pega aquí tu API Key completa para probar...',
    pickStoreAria: 'Seleccionar tienda de servicio',
    productCount: (count) =>
      `${count} producto${count === 1 ? '' : 's'}`,
    productCountShort: (count) => `${count} prod.`,
    regenerateKeyDesktop: 'Regenerar API Key',
    regenerateKeyMobile: 'Regenerar llave',
    renameOrgAria: 'Cambiar nombre de organización',
    renameOrgTitle: 'Cambiar nombre',
    renameServiceAria: (name) => `Renombrar servicio ${name}`,
    renameServiceTitle: 'Renombrar servicio',
    saveOrgNameAria: 'Guardar nombre de organización',
    saveServiceNameAria: 'Guardar nombre del servicio',
    serviceActiveDesktop: 'Servicio activo',
    serviceActiveMobile: 'Activo',
    serviceApiLink: 'Ver API Key',
    serviceEndpointLink: 'Endpoint & Prueba en vivo',
    servicePausedDesktop: 'Servicio pausado',
    servicePausedMobile: 'Pausado',
    testChatAria: (name) => `Probar ${name} con Search Link IA`,
    testChatTitle: 'Probar con Search Link IA',
    testLive: 'Probar en vivo',
    unnamed: 'Sin nombre',
    uploadLogoAria: 'Subir logo de organización',
    uploadLogoTitle: 'Subir logo',
    viewHistoryAria: (name) => `Ver catálogo completo de ${name}`,
    viewHistoryTitle: 'Ver historial del servicio',
    viewStoreOf: 'Abrir Mi tienda de:',
    viewStoreTitle: 'Mi tienda',
    welcomeSubtitle:
      'Centraliza tus catálogos, API Keys y chatbot Search Link IA en un solo lugar.',
    welcomeTitle: 'Bienvenido a tu Organización',
    moreActionsAria: (name) => `Más opciones para ${name}`,
    menuSearchAi: 'Search IA',
    menuViewProcess: 'Ver proceso',
    menuViewSchema: 'Ver esquema',
    schemaTitle: 'Esquema',
    copySchemaAria: 'Copiar esquema',
    downloadSchemaZipAria: 'Descargar esquema en ZIP',
    downloadSchemaZipTitle: 'Descargar ZIP',
    backToOrgSchemaAria: 'Volver a Organización',
  },
  store: {
    emptyDescDesktop:
      'Este servicio todavía no tiene productos guardados para mostrar.',
    emptyDescMobile: 'Este servicio no tiene productos para mostrar.',
    emptyTitle: 'Sin productos en esta tienda',
    noImage: 'Sin imagen',
    tapToCollapse: 'Toca para contraer el nombre',
    tapToExpandFull: (name) => `Toca para ver completo: ${name}`,
    unnamedProduct: 'Producto sin nombre',
  },
  pipeline: {
    backToMappedAria: 'Volver al mapeo JSON',
    benefits: [
      {
        id: 'speed',
        title: 'Listo en segundos',
        description:
          'Optimiza imágenes a WebP y sube directo al CDN sin configuración manual.',
      },
      {
        id: 'clean-urls',
        title: 'URLs limpias para bots',
        description:
          'Enlaces cortos e inmutables listos para WhatsApp, Telegram o cualquier API.',
      },
      {
        id: 'easy-anywhere',
        title: 'Fácil desde el móvil',
        description:
          'Sube fotos desde tu galería o extrae cualquier sitio web al instante.',
      },
      {
        id: 'ready-to-share',
        title: 'Catálogo estructurado',
        description:
          'IA identifica nombres, categorías y descripciones listas en JSON o PDF.',
      },
    ],
    clickToViewTitle: (alt) => `Clic para ampliar: ${alt}`,
    closeEditorBackAria: 'Cerrar editor y volver',
    closeEditorTitle: 'Cerrar editor',
    closeExpandedAria: 'Contraer vista ampliada',
    closeFullscreenAria: 'Cerrar imagen en pantalla completa',
    closeImageAria: 'Cerrar imagen',
    congratsBodyDesktop: (count) =>
      `Tu catálogo con ${count} producto${count === 1 ? '' : 's'} ya está optimizado, mapeado en Search Link Core y listo para conectar a cualquier canal.`,
    congratsBodyMobile: (count) =>
      `${count} producto${count === 1 ? '' : 's'} optimizado${count === 1 ? '' : 's'} y listo${count === 1 ? '' : 's'} para usar en tu chatbot o tienda.`,
    congratsTitleDesktop: '¡Automatización completada!',
    congratsTitleMobile: '¡Todo listo!',
    copyAllJsonAria: 'Copiar todo el JSON del catálogo',
    copyApiAria: 'Copiar API Key',
    copyApiTitle: 'Copiar API Key',
    copyEndpointAria: 'Copiar URL del endpoint',
    copyEndpointTitle: 'Copiar endpoint',
    copyJsonOfAria: (name) => `Copiar JSON de ${name}`,
    copyJsonTitle: 'Copiar JSON',
    copyUrlOfAria: (label) => `Copiar URL de ${label}`,
    copyUrlTitle: 'Copiar URL',
    couldNotMap: 'No se pudo mapear este elemento.',
    couldNotReceive: 'No se pudo obtener la URL final.',
    credentialsReadyHint:
      'Usa esta llave y endpoint en WhatsApp, Telegram o tu servidor backend.',
    credentialsReadyTitle: 'Credenciales en vivo listas',
    doubleClickFullscreen: (alt) => `Doble clic para ver completa: ${alt}`,
    elementsCount: (count) => `${count} elemento${count === 1 ? '' : 's'}`,
    enlargeLeftAria: (alt) => `Ampliar imagen ${alt}`,
    expandedImagesAria: 'Vista ampliada de imágenes',
    expandedMetadataAria: 'Vista ampliada de metadatos',
    generatedApiTitle: 'API Key y Endpoint generados',
    generatedApisLink: 'Ver API Key generada',
    generatedEndpointLink: 'Ver Endpoint en vivo',
    generatingApiKey: 'Generando API Key…',
    generatingEndpoint: 'Generando endpoint…',
    goToLifecycleAria: 'Ver ciclo de vida y credenciales',
    mobileCarouselAria: 'Carrusel de catálogo e IA',
    mobileCompressionAria: 'Progreso de compresión y carga',
    openOriginalImageTitle: (alt) => `Abrir imagen original: ${alt}`,
    pdfActions: {
      json: 'Descargar PDF JSON',
      images: 'Descargar PDF de Imágenes',
      urls: 'Descargar PDF de URLs',
      metadata: 'Descargar PDF de Metadatos',
      all: 'Descargar Catálogo Completo (PDF)',
      openEditor: 'Ver JSON en el editor',
      schema: 'Descargar esquema',
    },
    productJsonLabel: 'JSON del producto',
    readOnlyEditorAria: 'Editor de JSON en solo lectura',
    searchingImages: 'Extrayendo imágenes…',
    showJsonAria: (isExpanded, name) =>
      isExpanded ? `Ocultar JSON de ${name}` : `Ver JSON de ${name}`,
    stageCompressingTitle: 'Comprimiendo imágenes…',
    stageEditorTitle: 'Editor JSON',
    stageImagesTitle: 'Imágenes del catálogo',
    stageLifecycleFullTitle: 'Ciclo de vida · Search Link Core',
    stageLifecycleTitle: 'Ciclo de vida',
    stageMappedDoneTitle: 'Mapeo completado',
    stageMappingTitle: 'Mapeando con IA…',
    stageMetadataTitle: 'URLs limpias',
    stageProductivityTitle: 'Productividad',
    stageReceivingTitle: 'Recibiendo URLs finales…',
    stageUploadingTitle: 'Subiendo a Search Link Cloud…',
    stageViewApiTitle: 'Tu API lista',
    tapBorderToExpand: 'Toca el borde para ampliar',
    useAsBackgroundAria: (alt) => `Usar ${alt} como fondo`,
    viewInBackgroundTitle: (alt) => `Ver ${alt} como fondo`,
    viewProductAria: (name) => `Ver producto ${name}`,
    viewYourOrg: 'Abrir Organización y probar en IA',
    whyUseSearchLink: '¿Por qué usar Search Link?',
    whyUseSearchLinkAria: 'Beneficios de Search Link',
  },
  connectServer: {
    title: 'Conecta tu servidor',
    serverUrlLabel: 'Pega la URL de tu servidor',
    serverUrlPlaceholder: 'https://tu-servidor.com/webhook',
    serverUrlAria: 'URL de tu servidor',
    showUrlAria: 'Ver URL del servidor',
    hideUrlAria: 'Ocultar URL del servidor',
    chooseServiceLabel: 'Escoge tu servicio',
    chooseServicePlaceholder: 'Selecciona un servicio',
    chooseServiceMenuAria: 'Seleccionar servicio para sincronizar',
    allServicesSelected: 'Todos tus servicios',
    syncAllOption: 'Sincronizar todos',
    newServicesSelected: 'Nuevos servicios',
    syncNewServicesOption: 'Nuevos servicios',
    noServicesHint: 'Todavía no tienes servicios creados',
    secretKeyLabel: 'Clave secreta',
    secretKeyAria: 'Clave secreta del servidor',
    showSecretAria: 'Ver clave secreta',
    hideSecretAria: 'Ocultar clave secreta',
    copySecretAria: 'Copiar clave secreta',
    secretHelpTrigger: '¿No sabes qué hacer? Ayuda',
    secretHelpTitle: 'Cómo conectar con tu clave secreta',
    secretHelpCloseAria: 'Cerrar guía de clave secreta',
    secretHelpWhyTitle: '¿Para qué sirve esta clave secreta?',
    secretHelpWhyBody:
      'Es la contraseña privada entre tu cuenta de Search Link y tu servidor propio. Cada vez que Search Link envía tus productos, firma el envío con esta clave para que tu servidor confirme que los datos son auténticos y bloquee peticiones de desconocidos.',
    secretHelpVarRuleTitle: 'Qué debes configurar en tu servidor',
    secretHelpVarRuleBody:
      'En casi cualquier plataforma de servidores el proceso es el mismo: entra a las variables de entorno de tu proyecto, crea la variable con el nombre exacto de abajo y pega como valor la clave secreta que copiaste en Conecta tu servidor.',
    secretHelpVarNameLabel: 'Nombre de la variable:',
    secretHelpExampleValueLabel: 'Ejemplo de clave secreta:',
    secretHelpExampleValue: 'sl_whsec_ejemplo9f4a2c8b1d07e6a3c5b2f8e1a9d4c7b0',
    secretHelpExampleHint:
      '(Solo es un ejemplo de formato; tú debes pegar tu propia clave secreta).',
    secretHelpProvidersTitle: 'Cómo hacerlo en los servidores más populares',
    secretHelpProviders: [
      {
        id: 'render',
        name: 'Render',
        steps: [
          'Abre tu Web Service en Render (puedes subir el código de Rápido y ejecutable).',
          'En Build Command deja npm install o vacío, y en Start Command escribe npm start.',
          'Entra a Environment → Environment Variables → Add Environment Variable.',
          'En Key pon SEARCHLINK_WEBHOOK_SECRET y en Value pega tu clave secreta.',
          'Guarda los cambios y espera a que Render termine el deploy en verde.',
        ],
      },
      {
        id: 'cloudflare',
        name: 'Cloudflare',
        steps: [
          'Abre tu proyecto en Cloudflare Workers o Pages desde el panel principal.',
          'Ve a Settings → Variables and Secrets → Add.',
          'Elige el tipo Secret, pon como nombre SEARCHLINK_WEBHOOK_SECRET y pega tu clave secreta.',
          'Guarda y vuelve a desplegar tu Worker para que tome el secreto activo.',
        ],
      },
      {
        id: 'railway',
        name: 'Railway / Fly.io',
        steps: [
          'Selecciona tu servicio dentro de tu proyecto y abre la pestaña Variables.',
          'Agrega una variable nueva llamada SEARCHLINK_WEBHOOK_SECRET.',
          'Pega tu clave secreta como valor y guarda; el servicio se reiniciará automático.',
        ],
      },
      {
        id: 'vercel',
        name: 'Vercel',
        steps: [
          'Entra a tu proyecto en Vercel y abre Settings → Environment Variables.',
          'En Name escribe SEARCHLINK_WEBHOOK_SECRET y en Value pega tu clave secreta.',
          'Guarda la variable y ejecuta un Redeploy para aplicarla en producción.',
        ],
      },
      {
        id: 'vps',
        name: 'VPS / Servidor propio',
        steps: [
          'En la carpeta del servidor, crea o edita el archivo .env junto a server.mjs.',
          'Agrega la línea SEARCHLINK_WEBHOOK_SECRET=tu_clave_secreta y guarda el archivo.',
          'Ejecuta npm start (o reinicia PM2/Docker) para cargar la variable en memoria.',
        ],
      },
    ],
    secretHelpFinalStepTitle: 'Último paso: pegar la URL y sincronizar',
    secretHelpFinalStepBody:
      'Cuando tu servidor esté encendido con esa variable guardada, copia su enlace webhook (por ejemplo https://tu-servidor.onrender.com/webhook), vuelve aquí, pégalo en el campo de URL, escoge qué servicios enviar y toca Sincronizar.',
    syncAction: 'Sincronizar',
    syncingAction: 'Sincronizando…',
    validationUrlRequired: 'Pega primero la URL de tu servidor.',
    validationUrlInvalid: 'Ingresa una URL válida con http:// o https://.',
    validationServiceRequired: 'Escoge un servicio, "Sincronizar todos" o "Nuevos servicios".',
    noServicesToSync: 'Todavía no tienes servicios para sincronizar.',
    authRequired: 'Inicia sesión nuevamente para sincronizar.',
    syncSuccess: (srv, prod, ms) =>
      `Sincronizado: ${srv} ${srv === 1 ? 'servicio' : 'servicios'} (${prod} ${prod === 1 ? 'producto' : 'productos'}) en ${ms} ms.`,
    syncNewServicesSuccess: (ms) =>
      `Conectado en modo Nuevos servicios en ${ms} ms. Cada nuevo servicio que crees se enviará automáticamente.`,
    syncNetworkError: 'No pudimos conectar con Search Link para enviar la sincronización.',
    syncLiabilityConfirmText:
      'Al aceptar, confirmas que toda la responsabilidad por disponibilidad, caídas, seguridad y clientes atendidos recae únicamente sobre tu servidor bajo cualquier circunstancia.',
    disconnectAction: 'Desconectar',
    disconnectingAction: 'Desconectando…',
    disconnectConfirmPrompt:
      'Al desconectar tu servidor, se detendrán las actualizaciones automáticas y las peticiones de tus APIs volverán a procesarse directamente en Search Link bajo los límites de tu plan actual. Para continuar, escribe:',
    disconnectConfirmPhrase: 'estoy de acuerdo',
    disconnectConfirmPlaceholder: 'estoy de acuerdo',
    disconnectConfirmInputAria: 'Escribe estoy de acuerdo para desconectar tu servidor',
    disconnectSuccess:
      'Servidor desconectado. Las peticiones ahora se procesan nuevamente en Search Link.',
    disconnectNetworkError:
      'No pudimos conectar con Search Link para desconectar tu servidor.',
    quickServerTitle: 'Rápido y ejecutable',
    quickServerFilesAria: 'Archivos del servidor Rápido y ejecutable',
    downloadQuickServerZipAria: 'Descargar servidor Rápido y ejecutable en ZIP',
    downloadQuickServerZipTitle: 'Descargar ZIP',
    copyQuickServerFileAria: 'Copiar código de este archivo',
    swipeHintLabel: 'Desliza',
    swipeToQuickServerAria: 'Desliza para ver el código de Rápido y ejecutable',
    backToConnectServerAria: 'Volver a Conecta tu servidor',
    testRequestAction: 'Hacer petición de prueba',
    testServerTitle: 'Prueba de servidor',
    testConsentPrompt:
      '¿Aceptas que hagamos la evaluación en una petición hacia tu servidor para traer todas las imágenes registradas?',
    testRunningLabel: 'Evaluando respuesta de tu servidor…',
    testEmptyCatalogNote:
      'Tu servidor respondió correctamente, pero todavía no tiene productos ni imágenes almacenadas.',
    testStatusLabel: 'Estado',
    testLatencyLabel: 'Latencia',
    testImagesCountLabel: 'Imágenes',
    testRetryAction: 'Volver a evaluar',
    testCloseAria: 'Cerrar prueba de servidor',
  },
  advancedSettings: {
    title: 'Ajustes avanzados',
    confirmPromptAria: 'Confirmación de acción en ajustes avanzados',
    r2DeleteTitle: 'Borrar todas las imágenes de R2',
    r2DeleteButton: 'Borrar',
    r2DeleteConfirmText:
      'Esta acción eliminará de forma permanente todas las imágenes que publicaste y guardaste en R2. Tus enlaces actuales dejarán de cargar y esta operación se ejecuta bajo tu responsabilidad. ¿Deseas continuar?',
    clearBrowserDataTitle: 'Borrar todos los datos de navegación',
    clearBrowserDataButton: 'Confirmar',
    clearBrowserDataConfirmText:
      'Se eliminarán todos los datos locales de navegación, cookies y caché de Search Link en este dispositivo, cerrando tu sesión actual para que debas iniciar sesión nuevamente con Google. Esta acción se realiza bajo tu responsabilidad.',
    deleteAccountTitle: 'Borrar la cuenta de Google definitivamente',
    deleteAccountButton: 'Confirmar',
    deleteAccountConfirmText:
      'Se eliminará de forma definitiva tu cuenta vinculada a Google junto con tu organización, servicios, claves e imágenes asociadas, sin posibilidad de recuperación. Esta acción se ejecuta bajo tu total responsabilidad.',
    pauseAllApisTitle: 'Pausar todas las APIs activas',
    pauseAllApisButton: 'Confirmar',
    pauseAllApisConfirmText:
      'Se pausarán de inmediato todas las API Keys activas de todos tus servicios y ninguna responderá peticiones hasta que vuelvas a activarlas manualmente. Esta acción se realiza bajo tu responsabilidad.',
    r2PurgeSuccess: (count) =>
      count > 0
        ? `Se eliminaron ${count} ${count === 1 ? 'imagen' : 'imágenes'} de R2 y se limpiaron tus catálogos publicados.`
        : 'Tus catálogos e imágenes en R2 quedaron completamente limpios.',
    r2EmptyError: 'No tienes imágenes en R2.',
    pauseApisSuccess: (count) =>
      count > 0
        ? `Se pausaron ${count} ${count === 1 ? 'servicio' : 'servicios'} y todas sus API Keys activas dejaron de responder.`
        : 'Todas las API Keys activas quedaron pausadas.',
    thingsYouCanDoTitle: 'Cosas que puedes hacer ahora',
    unfreezeApisSubtitle: 'Despausar tus servicios',
    unfreezeApisButton: 'Descongelar',
    unfreezeApisSuccess: (count) =>
      count > 0
        ? `Se descongelaron ${count} ${count === 1 ? 'servicio' : 'servicios'} y todas tus APIs volvieron a funcionar.`
        : 'Todas tus APIs volvieron a funcionar.',
    actionErrorFallback: 'No se pudo completar la operación. Intenta nuevamente.',
  },
};

const EN_DICTIONARY: TranslationDictionary = {
  common: {
    accept: 'Accept',
    cancel: 'Cancel',
    close: 'Close',
    continueBtn: 'Continue',
    copied: 'Copied',
    copiedFem: 'Copied',
    copy: 'Copy',
    edit: 'Edit',
    generalCategory: 'General',
    nextBtn: 'Next',
    productFallback: 'Product',
    skip: 'Skip',
    userFallback: 'User',
  },
  app: {
    uploadImagesAria: 'Upload images from your device',
    uploadImagesTitle: 'Upload images from your device',
    pasteUrlFormAria: 'Paste website URL',
    urlPlaceholder: 'Paste your website URL here...',
    urlInputAria: 'Your website URL',
    extractingAria: 'Extracting images',
    clearUrlAria: 'Clear URL',
    extractEmptyError: 'We could not find any valid images on that web address.',
    extractNetworkError:
      'Could not connect to that webpage. Check the URL and try again.',
    freePlanLimitNotice: (max) =>
      `Free plan: the first ${max} ${max === 1 ? 'image' : 'images'} will be processed.`,
    freeRemainingNotice: (remaining, total) =>
      `Free plan: ${remaining} of ${total} images remaining.`,
    freeImageQuotaExceededError:
      'You have reached the 20-image limit for the free plan.',
    guestExtractOnlyNotice:
      'You are not signed in, you can only test this method.',
    guestIpBlockedError: 'Your IP has been blocked. Sign in.',
    adminExtractOnlyNotice: (count) =>
      `Admin test mode: ${count} image${count === 1 ? '' : 's'} extracted from domain (stopped after extraction, no compression or AI mapping).`,
    domainRightsPromptQuestion:
      'By confirming, you agree that you own these images or hold a valid license and permission to use them, under your sole responsibility and not Search Link’s.',
    domainRightsPromptAccept: 'Accept',
    domainPromptQuestion:
      "If you'd like, you can stop here and upload from storage.",
    domainPromptCancel: 'Cancel',
    domainPromptContinue: 'Continue',
    savedCatalogPromptQuestion: 'Are you sure you want to use the catalog images?',
    savedCatalogPromptAccept: 'Accept',
    noSavedCatalogImagesError: 'No saved images found.',
    savedCatalogAuthRequiredError: 'Sign in with Google to process your catalog.',
    invalidImageFilesError: 'Please select valid image files.',
    uploadImageError: 'Failed to upload image.',
    mapImageError: 'Failed to render and map image with AI.',
    serviceDefaultPrefix: (name) => `${name} Service`,
    coreSavedNotice: 'Service & API saved to Search Link Core.',
    imageFallbackAlt: (index) => `Image ${index}`,
    openAccountMenuAria: (name) => `Open account menu (${name})`,
    openAuthAria: 'Open account sign in',
    openAuthTitle: 'Create account or sign in',
    imageUploadAria: (status, alt) =>
      status === 'pending'
        ? `Queued to save ${alt}`
        : status === 'uploading'
          ? `Saving ${alt} to cloud`
          : status === 'done'
            ? `${alt} saved`
            : `Failed to save ${alt}`,
    receiveStatusAria: (status, alt) =>
      status === 'waiting'
        ? `Receiving URL for ${alt}`
        : status === 'received'
          ? `URL received for ${alt}`
          : `Failed to receive ${alt}`,
    compressionStatusAria: (status, alt) =>
      status === 'rendering'
        ? `Rendering ${alt}`
        : status === 'compressing'
          ? `Compressing ${alt}`
          : status === 'done'
            ? `${alt} compressed`
            : `Failed to compress ${alt}`,
    blockedDomainPolicyError: 'This domain violates our content policies',
  },
  imageBank: {
    openAria: 'Search image bank',
    openTitle: 'Search images',
    brandTitle: 'Search Link Pexels',
    publicBankNotice:
      'This service uses the Pexels and Pixabay public image banks. By using them, you agree they belong to those public banks and neither to you nor Search Link, with permission to use. See:',
    publicBankLinkLabel: 'pexels.com',
    publicBankSecondLinkLabel: 'pixabay.com',
    savedAria: 'View saved images',
    savedTitle: 'Saved',
    savedFullTitle: 'Saved',
    closeSavedAria: 'Close Saved',
    savedEmptyHint: 'Images you save for your catalogs will appear here.',
    placeholder: 'Describe the image you are looking for...',
    inputAria: 'Description of the image you are looking for',
    clearQueryAria: 'Clear search',
    closeAria: 'Close image search',
    panelAria: 'Image search',
    searchingAria: 'Searching images',
    noResultsNotice: 'No images found for that query. Try a different description.',
    searchErrorFallback: 'Unable to complete public image bank search.',
    saveImageAria: (alt) => `Save ${alt}`,
    unsaveImageAria: (alt) => `Remove from Saved: ${alt}`,
    removeSavedAria: (alt) => `Remove from Saved: ${alt}`,
    cooldownNotice: (waitText) =>
      `Do not overload external servers. Wait ${waitText}`,
    generateCardTitle: 'Generate with AI',
    generateCardPlusBadge: 'Plus plan feature',
    generatingAiLabel: 'Generating with AI...',
    plusRequiredNotice: 'You need the Plus plan to generate.',
    generatedAutoSavedBadge: 'Saved',
  },
  examples: {
    sectionAria: 'Automation examples',
    sectionTitle: 'Automation examples',
    sectionSubtitle: 'How Search Link works across different messaging platforms',
    cardAria: (platformLabel) => `${platformLabel} example`,
    visitorName: 'Visitor',
    items: {
      whatsapp: {
        bottomLabel: 'WhatsApp · Chatbots',
        accountType: 'Enterprise',
        headerSubline: 'Automated catalog',
        userGreeting: 'Hi',
        botGreeting: 'Hello! How are you? What are you looking for today?',
        userRequest: 'I want to see the white footwear catalog',
        botResultText: 'Here are the matching items in our catalog.',
        products: [
          { name: 'Veloce Court', subtitle: 'White leather' },
          { name: 'Veloce Runner', subtitle: 'Ivory knit' },
        ],
      },
      telegram: {
        bottomLabel: 'Telegram · Bots',
        accountType: 'Official Bot',
        headerSubline: 'Digital dealership',
        userGreeting: 'Hi, looking for cars',
        botGreeting: 'Welcome! Do you prefer an electric sedan or an SUV?',
        userRequest: 'Show me what is available today',
        botResultText: 'These two models are ready for delivery.',
        products: [
          { name: 'Apex Air EV', subtitle: 'Electric sedan' },
          { name: 'Apex Terra', subtitle: 'Hybrid SUV' },
        ],
      },
      instagram: {
        bottomLabel: 'Instagram · DM Bot',
        accountType: 'Shop',
        headerSubline: 'Automated DM replies',
        userGreeting: 'Hi, loved your reel',
        botGreeting: 'Thanks! Which accessory would you like to check?',
        userRequest: 'Watches and sunglasses for a gift',
        botResultText: 'Here are our seasonal favorites.',
        products: [
          { name: 'Chrono Leather', subtitle: 'Classic edition' },
          { name: 'Tortoise Shades', subtitle: 'UV400 filter' },
        ],
      },
      messenger: {
        bottomLabel: 'Messenger · Meta Bot',
        accountType: 'Home',
        headerSubline: 'Space advisor',
        userGreeting: 'Hi there, saw your ad',
        botGreeting: 'Hello! Which room are you shopping for?',
        userRequest: 'Something minimal for the living room',
        botResultText: 'These two pieces pair effortlessly together.',
        products: [
          { name: 'Oak Chair', subtitle: 'Beige fabric' },
          { name: 'Potted Monstera', subtitle: 'Matte ceramic' },
        ],
      },
      web: {
        bottomLabel: 'Web Chat · Storefront',
        accountType: 'Web Widget',
        headerSubline: 'Online menu',
        userGreeting: 'Hi, what do you recommend?',
        botGreeting: 'Hello! Everything is made fresh. What are you craving?',
        userRequest: 'Something quick for dinner tonight',
        botResultText: 'Our two most popular dishes tonight.',
        products: [
          { name: 'Brioche Burger', subtitle: 'Aged cheddar' },
          { name: 'Margherita Pizza', subtitle: 'Sourdough crust' },
        ],
      },
      discord: {
        bottomLabel: 'Discord · Bot API',
        accountType: 'APP',
        headerSubline: '#hardware-store',
        userGreeting: 'Hi, building a dark setup',
        botGreeting: 'Hey! Looking for audio gear or peripherals?',
        userRequest: 'Show me keyboard and headphones',
        botResultText: 'Both in stock for same-day shipping.',
        products: [
          { name: 'Pulse Audio Pro', subtitle: 'Matte black' },
          { name: '65% Keyboard', subtitle: 'Amber aluminum' },
        ],
      },
      slack: {
        bottomLabel: 'Slack · B2B App',
        accountType: 'Enterprise',
        headerSubline: '#office-procurement',
        userGreeting: 'Hi, refreshing our office',
        botGreeting: 'Happy to help. Which equipment should we quote?',
        userRequest: 'Ergonomic chairs and mugs',
        botResultText: 'Corporate catalog ready for your order.',
        products: [
          { name: 'Mesh Pro Chair', subtitle: 'B2B aluminum' },
          { name: 'Ceramic Set', subtitle: 'Office pack' },
        ],
      },
      line: {
        bottomLabel: 'LINE · Official Account',
        accountType: 'Official',
        headerSubline: 'Skincare assistant',
        userGreeting: 'Hi, looking for skincare',
        botGreeting: 'Hello! Interested in a serum or fragrance?',
        userRequest: 'Show me both please',
        botResultText: 'Here are our top-rated formulas.',
        products: [
          { name: 'Amber Serum', subtitle: 'Night repair' },
          { name: 'Botanical Scent', subtitle: 'Warm notes' },
        ],
      },
    },
  },
  menu: {
    account: 'Account',
    accountCreatedOn: (date) => `Created on ${date}`,
    accountMenuAria: 'Account menu',
    accountOptionsAria: 'Account options',
    backToMenuAria: 'Back to menu',
    backToOrgAria: 'Back to Organization',
    closeAccountModalAria: 'Close Google Account modal',
    closeMenuAria: 'Close menu',
    closeOrgAria: 'Close Organization',
    closeStoreAria: 'Close My store',
    confirmSignOutAria: 'Confirm sign out',
    confirmSignOutDescDesktop:
      'Your organization and saved services will remain safely stored until you return.',
    confirmSignOutDescMobile:
      'Your organization and services will remain safely saved.',
    confirmSignOutTitle: 'Sign out now?',
    createdAtLabel: 'Account created',
    dateUnavailable: 'Date unavailable',
    googleAccount: 'Google Account',
    googleAccountDetailsAria: 'Google Account details',
    googleAccountLabel: 'Email address',
    language: 'Language',
    languageAutoDetectedNote: (countryCode) =>
      countryCode
        ? `Auto-detected from your location (${countryCode}).`
        : 'Auto-detected from your browser settings.',
    languageLocalStorageHint:
      'Your manual selection is saved locally on this device.',
    languageManualSavedNote: 'Language manually selected.',
    languageOptionsAria: 'Available languages',
    languageSectionPrompt:
      'Choose the language for the entire interface and Search Link AI.',
    languagesTitle: 'Available languages',
    myStore: 'My store',
    organization: 'Organization',
    signOut: 'Sign out',
    signOutError: 'Could not sign out. Please try again.',
    usernameLabel: 'Name',
    documentation: 'Documentation',
    privacyAndUse: 'Privacy and Usage Policies',
    termsAndConditions: 'Terms and Conditions',
    contentPolicies: 'Content Policies',
    cookiePolicies: 'Cookie Policies',
    agencyMode: 'Agency Mode',
    agencyModeGuide: 'Things to Keep in Mind in Agency Mode',
    agencyModeLiability: 'Agency Mode Liability and Intellectual Property',
    intellectualPropertyAndLiability: 'Intellectual Property and Liability',
    comingSoon: 'Coming soon',
    connectServer: 'Connect your server',
    closeConnectServerAria: 'Close Connect your server',
    goToAdvancedSettings: 'Go to advanced settings',
    advancedSettings: 'Advanced settings',
    backToGoogleAccountAria: 'Back to Google Account',
    closeAdvancedSettingsAria: 'Close Advanced settings',
  },
  auth: {
    acceptTermsLabel: 'I accept the Search Link terms of service and privacy policy.',
    acceptTermsPrefix: 'I accept the Search Link ',
    acceptTermsLinkLabel: 'terms of service',
    acceptTermsMiddle: ' and ',
    acceptPrivacyLinkLabel: 'privacy policy',
    acceptTermsSuffix: '.',
    bullet1: 'Encrypted Google authentication',
    bullet2: 'Cloud-synced catalogs & optimized media',
    bullet3: 'Instant Search Link Core API Keys & endpoints',
    closePanelAria: 'Close account panel',
    connectingGoogle: 'Connecting with Google…',
    continueWithGoogle: 'Continue with Google',
    drawerAriaGuest: 'Sign in to Search Link',
    errProviderNotEnabled:
      'Google OAuth is not enabled yet on this Supabase project.',
    errRateLimit: 'Too many requests. Please wait a moment.',
    googleLinkError: 'Could not generate the Google OAuth link.',
    googleSignInError: 'An error occurred while signing in with Google.',
    googleSignedInSuccess: 'Signed in with Google successfully.',
    loginHeading: 'Save your catalogs & get your API',
    loginSubtitle:
      'Connect your Google account in one click to sync products, endpoints, and live usage.',
    openGoogleNewTab: 'Open Google in a new tab',
    popupBlockedError:
      'Your browser blocked the Google popup window. Use the link below instead.',
    supabaseMissingError:
      'Supabase configuration is unavailable in this environment.',
    termsError: 'Please accept the terms to continue with Google.',
  },
  chat: {
    clearConversation: 'Reset conversation',
    clearShort: 'New chat',
    closeAria: 'Close test chat',
    dailyLimitNotice:
      'Your limit has been reached, upgrade to the Plus plan.',
    dailyLimitPlaceholder: 'Daily limit reached...',
    defaultRequestError: 'Could not get a response from Search Link AI.',
    defaultStreamError: 'Error during live response stream.',
    defaultSuccessReply: 'Query completed.',
    inputAria: 'Ask a question to test your catalog',
    inputPlaceholder: 'Ask about any product in the catalog...',
    liveProducts: (count) =>
      `${count} live product${count === 1 ? '' : 's'}`,
    networkError: 'Connection error with Search Link AI. Please try again.',
    preparingReply: 'Preparing reply…',
    queryingCatalog: 'Querying live catalog…',
    sendAria: 'Send message',
  },
  org: {
    apiHintPrefixDesktop:
      'For security, only the key prefix is stored in the cloud. You can regenerate a full key anytime.',
    apiHintPrefixMobile:
      'Only the prefix is stored for security. You can regenerate your key anytime.',
    apiHintRaw:
      'Include this key in Authorization: Bearer <API_KEY> or x-api-key to query this service.',
    changeLogoAria: 'Change organization logo',
    changeLogoTitle: 'Change logo',
    closeBoxAria: 'Close dialog',
    companyPlaceholder: 'Your company or brand name',
    congratsBoth:
      'Both your logo and organization name are saved. Everything is ready to manage your services.',
    congratsLogoOnly:
      'Your logo has been saved. You can add or update your organization name anytime.',
    congratsMobileFallback:
      'Your organization is configured and ready to publish catalogs and endpoints.',
    congratsNameOnly:
      'Your organization name is saved. You can also upload a logo later.',
    congratsTitle: 'Organization ready!',
    copyCurlDesktop: 'Copy cURL command',
    copyCurlMobile: 'Copy cURL',
    curlCopied: 'cURL copied',
    helperArrowPrompt:
      'Upload your logo or type your business name to brand your endpoints and storefront.',
    logoUploadError: 'Could not upload the logo.',
    myServices: 'My services',
    newProduct: 'New product',
    noServicesAvailable: 'No active services yet',
    noServicesDescDesktop:
      'Process a URL or upload images from the home screen to generate your first live endpoint.',
    noServicesDescMobile:
      'Process a URL or upload images from home to see your services here.',
    noServicesTitleDesktop: 'You do not have any services yet',
    noServicesTitleMobile: 'No services yet',
    openStoreAria: 'Open service storefront',
    openStoreServicesAria: 'Open My store picker',
    orgNamePlaceholder: 'Organization name',
    orgNameShortPlaceholder: 'Your brand name',
    pasteKeyPlaceholder: 'Paste your full API Key here to test...',
    pickStoreAria: 'Select service store',
    productCount: (count) =>
      `${count} product${count === 1 ? '' : 's'}`,
    productCountShort: (count) => `${count} items`,
    regenerateKeyDesktop: 'Regenerate API Key',
    regenerateKeyMobile: 'Regenerate key',
    renameOrgAria: 'Rename organization',
    renameOrgTitle: 'Rename',
    renameServiceAria: (name) => `Rename service ${name}`,
    renameServiceTitle: 'Rename service',
    saveOrgNameAria: 'Save organization name',
    saveServiceNameAria: 'Save service name',
    serviceActiveDesktop: 'Service active',
    serviceActiveMobile: 'Active',
    serviceApiLink: 'View API Key',
    serviceEndpointLink: 'Endpoint & Live Test',
    servicePausedDesktop: 'Service paused',
    servicePausedMobile: 'Paused',
    testChatAria: (name) => `Test ${name} with Search Link AI`,
    testChatTitle: 'Test with Search Link AI',
    testLive: 'Test live',
    unnamed: 'Unnamed',
    uploadLogoAria: 'Upload organization logo',
    uploadLogoTitle: 'Upload logo',
    viewHistoryAria: (name) => `View full catalog of ${name}`,
    viewHistoryTitle: 'View service history',
    viewStoreOf: 'Open My store for:',
    viewStoreTitle: 'My store',
    welcomeSubtitle:
      'Centralize your catalogs, API Keys, and Search Link AI chatbot in one place.',
    welcomeTitle: 'Welcome to your Organization',
    moreActionsAria: (name) => `More options for ${name}`,
    menuSearchAi: 'Search AI',
    menuViewProcess: 'View process',
    menuViewSchema: 'View schema',
    schemaTitle: 'Schema',
    copySchemaAria: 'Copy schema',
    downloadSchemaZipAria: 'Download schema ZIP',
    downloadSchemaZipTitle: 'Download ZIP',
    backToOrgSchemaAria: 'Back to Organization',
  },
  store: {
    emptyDescDesktop: 'This service does not have any saved products yet.',
    emptyDescMobile: 'This service has no products to display yet.',
    emptyTitle: 'No products in this store',
    noImage: 'No image',
    tapToCollapse: 'Tap to collapse name',
    tapToExpandFull: (name) => `Tap to view full name: ${name}`,
    unnamedProduct: 'Unnamed product',
  },
  pipeline: {
    backToMappedAria: 'Back to JSON mapping',
    benefits: [
      {
        id: 'speed',
        title: 'Ready in seconds',
        description:
          'Optimizes images to WebP and uploads straight to CDN with zero setup.',
      },
      {
        id: 'clean-urls',
        title: 'Clean URLs for bots',
        description:
          'Short, immutable links tailored for WhatsApp, Telegram, or any API.',
      },
      {
        id: 'easy-anywhere',
        title: 'Easy on mobile',
        description:
          'Upload photos from your gallery or extract any website instantly.',
      },
      {
        id: 'ready-to-share',
        title: 'Structured catalog',
        description:
          'AI extracts titles, categories, and descriptions ready in JSON or PDF.',
      },
    ],
    clickToViewTitle: (alt) => `Click to enlarge: ${alt}`,
    closeEditorBackAria: 'Close editor and go back',
    closeEditorTitle: 'Close editor',
    closeExpandedAria: 'Collapse expanded view',
    closeFullscreenAria: 'Close fullscreen image',
    closeImageAria: 'Close image',
    congratsBodyDesktop: (count) =>
      `Your catalog with ${count} product${count === 1 ? '' : 's'} is optimized, mapped in Search Link Core, and ready to connect to any channel.`,
    congratsBodyMobile: (count) =>
      `${count} product${count === 1 ? '' : 's'} optimized and ready to use in your chatbot or store.`,
    congratsTitleDesktop: 'Automation complete!',
    congratsTitleMobile: 'All set!',
    copyAllJsonAria: 'Copy entire catalog JSON',
    copyApiAria: 'Copy API Key',
    copyApiTitle: 'Copy API Key',
    copyEndpointAria: 'Copy endpoint URL',
    copyEndpointTitle: 'Copy endpoint',
    copyJsonOfAria: (name) => `Copy JSON for ${name}`,
    copyJsonTitle: 'Copy JSON',
    copyUrlOfAria: (label) => `Copy URL for ${label}`,
    copyUrlTitle: 'Copy URL',
    couldNotMap: 'Could not map this item.',
    couldNotReceive: 'Could not retrieve the final URL.',
    credentialsReadyHint:
      'Use this key and endpoint in WhatsApp, Telegram, or your backend server.',
    credentialsReadyTitle: 'Live credentials ready',
    doubleClickFullscreen: (alt) => `Double-click for fullscreen: ${alt}`,
    elementsCount: (count) => `${count} item${count === 1 ? '' : 's'}`,
    enlargeLeftAria: (alt) => `Enlarge image ${alt}`,
    expandedImagesAria: 'Expanded images view',
    expandedMetadataAria: 'Expanded metadata view',
    generatedApiTitle: 'Generated API Key & Endpoint',
    generatedApisLink: 'View generated API Key',
    generatedEndpointLink: 'View live Endpoint',
    generatingApiKey: 'Generating API Key…',
    generatingEndpoint: 'Generating endpoint…',
    goToLifecycleAria: 'View lifecycle and credentials',
    mobileCarouselAria: 'Catalog & AI carousel',
    mobileCompressionAria: 'Compression and upload progress',
    openOriginalImageTitle: (alt) => `Open original image: ${alt}`,
    pdfActions: {
      json: 'Download JSON PDF',
      images: 'Download Images PDF',
      urls: 'Download URLs PDF',
      metadata: 'Download Metadata PDF',
      all: 'Download Full Catalog (PDF)',
      openEditor: 'View JSON in editor',
      schema: 'Download schema',
    },
    productJsonLabel: 'Product JSON',
    readOnlyEditorAria: 'Read-only JSON editor',
    searchingImages: 'Extracting images…',
    showJsonAria: (isExpanded, name) =>
      isExpanded ? `Hide JSON for ${name}` : `View JSON for ${name}`,
    stageCompressingTitle: 'Compressing images…',
    stageEditorTitle: 'JSON Editor',
    stageImagesTitle: 'Catalog images',
    stageLifecycleFullTitle: 'Lifecycle · Search Link Core',
    stageLifecycleTitle: 'Lifecycle',
    stageMappedDoneTitle: 'Mapping complete',
    stageMappingTitle: 'Mapping with AI…',
    stageMetadataTitle: 'Clean URLs',
    stageProductivityTitle: 'Productivity',
    stageReceivingTitle: 'Receiving final URLs…',
    stageUploadingTitle: 'Uploading to Search Link Cloud…',
    stageViewApiTitle: 'Your API ready',
    tapBorderToExpand: 'Tap border to expand',
    useAsBackgroundAria: (alt) => `Use ${alt} as background`,
    viewInBackgroundTitle: (alt) => `Preview ${alt} as background`,
    viewProductAria: (name) => `View product ${name}`,
    viewYourOrg: 'Open Organization & test in AI',
    whyUseSearchLink: 'Why use Search Link?',
    whyUseSearchLinkAria: 'Search Link benefits',
  },
  connectServer: {
    title: 'Connect your server',
    serverUrlLabel: 'Paste your server URL',
    serverUrlPlaceholder: 'https://your-server.com/webhook',
    serverUrlAria: 'Your server URL',
    showUrlAria: 'Show server URL',
    hideUrlAria: 'Hide server URL',
    chooseServiceLabel: 'Choose your service',
    chooseServicePlaceholder: 'Select a service',
    chooseServiceMenuAria: 'Select service to sync',
    allServicesSelected: 'All your services',
    syncAllOption: 'Sync all',
    newServicesSelected: 'New services',
    syncNewServicesOption: 'New services',
    noServicesHint: 'You do not have any services yet',
    secretKeyLabel: 'Secret key',
    secretKeyAria: 'Server secret key',
    showSecretAria: 'Show secret key',
    hideSecretAria: 'Hide secret key',
    copySecretAria: 'Copy secret key',
    secretHelpTrigger: "Don't know what to do? Help",
    secretHelpTitle: 'How to connect with your secret key',
    secretHelpCloseAria: 'Close secret key guide',
    secretHelpWhyTitle: 'What is this secret key for?',
    secretHelpWhyBody:
      'It is a private password shared only between Search Link and your server. Every time Search Link sends catalog updates, it signs the request with this key so your server can verify it came from your account and block strangers.',
    secretHelpVarRuleTitle: 'What to set on your server',
    secretHelpVarRuleBody:
      'On almost every server host the setup is identical: open your project environment variables, create the variable with the exact name below, and paste the secret key you copied from Connect your server as its value.',
    secretHelpVarNameLabel: 'Variable name:',
    secretHelpExampleValueLabel: 'Example secret key:',
    secretHelpExampleValue: 'sl_whsec_example9f4a2c8b1d07e6a3c5b2f8e1a9d4c7b0',
    secretHelpExampleHint:
      '(This is just a format example; paste your own secret key there.)',
    secretHelpProvidersTitle: 'How to set it on popular servers',
    secretHelpProviders: [
      {
        id: 'render',
        name: 'Render',
        steps: [
          'Open your Web Service in Render (you can upload the Quick & Runnable code).',
          'Leave Build Command empty or npm install, and set Start Command to npm start.',
          'Go to Environment → Environment Variables → Add Environment Variable.',
          'Set Key to SEARCHLINK_WEBHOOK_SECRET and paste your secret key as Value.',
          'Save changes and wait until Render finishes deploying.',
        ],
      },
      {
        id: 'cloudflare',
        name: 'Cloudflare',
        steps: [
          'Open your project in Cloudflare Workers or Pages from your dashboard.',
          'Go to Settings → Variables and Secrets → Add.',
          'Choose Secret type, name it SEARCHLINK_WEBHOOK_SECRET, and paste your secret key.',
          'Save and redeploy your Worker so the active secret takes effect.',
        ],
      },
      {
        id: 'railway',
        name: 'Railway / Fly.io',
        steps: [
          'Select your service inside the project and open the Variables tab.',
          'Create a new variable named SEARCHLINK_WEBHOOK_SECRET.',
          'Paste your secret key as the value and save; the server restarts automatically.',
        ],
      },
      {
        id: 'vercel',
        name: 'Vercel',
        steps: [
          'Open your Vercel project and go to Settings → Environment Variables.',
          'Enter SEARCHLINK_WEBHOOK_SECRET as Name and paste your secret key in Value.',
          'Save the variable and trigger a Redeploy for production.',
        ],
      },
      {
        id: 'vps',
        name: 'VPS / Self-hosted',
        steps: [
          'Inside your server folder, create or edit the .env file next to server.mjs.',
          'Add SEARCHLINK_WEBHOOK_SECRET=your_secret_key and save the file.',
          'Run npm start (or restart PM2/Docker) so the server loads the variable.',
        ],
      },
    ],
    secretHelpFinalStepTitle: 'Final step: paste your URL and sync',
    secretHelpFinalStepBody:
      'Once your server is live with that variable saved, copy its webhook URL (for example https://your-server.onrender.com/webhook), return here, paste it in the URL box, choose which services to sync, and tap Sync.',
    syncAction: 'Sync',
    syncingAction: 'Syncing…',
    validationUrlRequired: 'Paste your server URL first.',
    validationUrlInvalid: 'Enter a valid URL starting with http:// or https://.',
    validationServiceRequired: 'Choose a service, "Sync all", or "New services".',
    noServicesToSync: 'You do not have any services to sync yet.',
    authRequired: 'Sign in again to sync.',
    syncSuccess: (srv, prod, ms) =>
      `Synced: ${srv} ${srv === 1 ? 'service' : 'services'} (${prod} ${prod === 1 ? 'product' : 'products'}) in ${ms} ms.`,
    syncNewServicesSuccess: (ms) =>
      `Connected in New services mode in ${ms} ms. Any new service you create will sync automatically.`,
    syncNetworkError: 'Could not reach Search Link to run the sync.',
    syncLiabilityConfirmText:
      'By accepting, you confirm that full responsibility for availability, downtime, security, and served clients rests solely with your server under any circumstances.',
    disconnectAction: 'Disconnect',
    disconnectingAction: 'Disconnecting…',
    disconnectConfirmPrompt:
      'Disconnecting your server stops automatic updates and routes your API requests back to Search Link under your current plan limits. To continue, type:',
    disconnectConfirmPhrase: 'I agree',
    disconnectConfirmPlaceholder: 'I agree',
    disconnectConfirmInputAria: 'Type I agree to disconnect your server',
    disconnectSuccess:
      'Server disconnected. Requests are now handled again by Search Link.',
    disconnectNetworkError:
      'Could not reach Search Link to disconnect your server.',
    quickServerTitle: 'Quick & Runnable',
    quickServerFilesAria: 'Quick & Runnable server files',
    downloadQuickServerZipAria: 'Download Quick & Runnable server ZIP',
    downloadQuickServerZipTitle: 'Download ZIP',
    copyQuickServerFileAria: 'Copy file source code',
    swipeHintLabel: 'Swipe',
    swipeToQuickServerAria: 'Swipe to view Quick & Runnable server code',
    backToConnectServerAria: 'Back to Connect your server',
    testRequestAction: 'Run test request',
    testServerTitle: 'Server test',
    testConsentPrompt:
      'Do you agree for us to send an evaluation request to your server to fetch all registered images?',
    testRunningLabel: 'Testing your server response…',
    testEmptyCatalogNote:
      'Your server responded properly, though it does not have any products or images stored yet.',
    testStatusLabel: 'Status',
    testLatencyLabel: 'Latency',
    testImagesCountLabel: 'Images',
    testRetryAction: 'Run again',
    testCloseAria: 'Close server test',
  },
  advancedSettings: {
    title: 'Advanced settings',
    confirmPromptAria: 'Advanced settings action confirmation',
    r2DeleteTitle: 'Delete all images from R2',
    r2DeleteButton: 'Delete',
    r2DeleteConfirmText:
      'This will permanently delete all images you published and stored in R2. Existing image links will stop loading, and this action is carried out under your responsibility. Do you want to continue?',
    clearBrowserDataTitle: 'Clear all browsing data',
    clearBrowserDataButton: 'Confirm',
    clearBrowserDataConfirmText:
      'All local Search Link browsing data, cookies, and cached storage on this device will be cleared, signing you out so you must sign in again with Google. This action is carried out under your responsibility.',
    deleteAccountTitle: 'Permanently delete Google account',
    deleteAccountButton: 'Confirm',
    deleteAccountConfirmText:
      'Your Google-linked account, organization, services, API keys, and associated images will be permanently deleted with no recovery option. This action is carried out under your sole responsibility.',
    pauseAllApisTitle: 'Pause all active APIs',
    pauseAllApisButton: 'Confirm',
    pauseAllApisConfirmText:
      'All active API keys across all of your services will be paused immediately and will reject requests until manually re-enabled. This action is carried out under your responsibility.',
    r2PurgeSuccess: (count) =>
      count > 0
        ? `Deleted ${count} ${count === 1 ? 'image' : 'images'} from R2 and cleared your published catalogs.`
        : 'Your R2 media and published catalogs have been cleared.',
    r2EmptyError: 'You have no images in R2.',
    pauseApisSuccess: (count) =>
      count > 0
        ? `Paused ${count} ${count === 1 ? 'service' : 'services'} and disabled all active API keys.`
        : 'All active API keys have been paused.',
    thingsYouCanDoTitle: 'Things you can do now',
    unfreezeApisSubtitle: 'Unpause your services',
    unfreezeApisButton: 'Unfreeze',
    unfreezeApisSuccess: (count) =>
      count > 0
        ? `Unfroze ${count} ${count === 1 ? 'service' : 'services'} and all your APIs are active again.`
        : 'All your APIs are active again.',
    actionErrorFallback: 'Could not complete the operation. Please try again.',
  },
};

const PT_DICTIONARY: TranslationDictionary = {
  common: {
    accept: 'Aceitar',
    cancel: 'Cancelar',
    close: 'Fechar',
    continueBtn: 'Continuar',
    copied: 'Copiado',
    copiedFem: 'Copiada',
    copy: 'Copiar',
    edit: 'Editar',
    generalCategory: 'Geral',
    nextBtn: 'Próximo',
    productFallback: 'Produto',
    skip: 'Pular',
    userFallback: 'Usuário',
  },
  app: {
    uploadImagesAria: 'Enviar imagens do dispositivo',
    uploadImagesTitle: 'Enviar imagens do seu dispositivo',
    pasteUrlFormAria: 'Colar URL do site',
    urlPlaceholder: 'Cole aqui a URL do seu site...',
    urlInputAria: 'URL do seu site',
    extractingAria: 'Extraindo imagens',
    clearUrlAria: 'Limpar URL',
    extractEmptyError: 'Não encontramos imagens válidas nesse endereço web.',
    extractNetworkError:
      'Não foi possível conectar ao site. Verifique a URL e tente novamente.',
    freePlanLimitNotice: (max) =>
      `Plano gratuito: ${max === 1 ? 'a imagem disponível será processada' : `as primeiras ${max} imagens serão processadas`}.`,
    freeRemainingNotice: (remaining, total) =>
      `Plano gratuito: restam ${remaining} de ${total} imagens disponíveis.`,
    freeImageQuotaExceededError:
      'Você atingiu o limite de 20 imagens do plano gratuito.',
    guestExtractOnlyNotice:
      'Você não iniciou sessão, só pode testar este método.',
    guestIpBlockedError: 'Seu IP foi bloqueado. Inicie sessão.',
    adminExtractOnlyNotice: (count) =>
      `Modo teste admin: ${count} image${count === 1 ? 'm extraída' : 'ns extraídas'} do domínio (parado após a extração, sem compressão nem mapeamento IA).`,
    domainRightsPromptQuestion:
      'Ao confirmar, você concorda que estas imagens são de sua propriedade ou possui licença e permissão de uso, sob sua exclusiva responsabilidade e não do Search Link.',
    domainRightsPromptAccept: 'Aceitar',
    domainPromptQuestion:
      'Se quiser, você pode parar aqui e enviar do armazenamento.',
    domainPromptCancel: 'Cancelar',
    domainPromptContinue: 'Continuar',
    savedCatalogPromptQuestion: 'Tem certeza de que deseja usar as imagens do catálogo?',
    savedCatalogPromptAccept: 'Aceitar',
    noSavedCatalogImagesError: 'Não encontramos imagens salvas.',
    savedCatalogAuthRequiredError: 'Entre com o Google para processar seu catálogo.',
    invalidImageFilesError: 'Por favor, selecione arquivos de imagem válidos.',
    uploadImageError: 'Erro ao enviar a imagem.',
    mapImageError: 'Erro ao renderizar e mapear a imagem com IA.',
    serviceDefaultPrefix: (name) => `Serviço ${name}`,
    coreSavedNotice: 'Serviço e API salvos no Search Link Core.',
    imageFallbackAlt: (index) => `Imagem ${index}`,
    openAccountMenuAria: (name) => `Abrir menu da conta (${name})`,
    openAuthAria: 'Abrir cadastro de conta',
    openAuthTitle: 'Criar conta ou entrar',
    imageUploadAria: (status, alt) =>
      status === 'pending'
        ? `Na fila para salvar ${alt}`
        : status === 'uploading'
          ? `Salvando ${alt} na nuvem`
          : status === 'done'
            ? `${alt} salva`
            : `Erro ao salvar ${alt}`,
    receiveStatusAria: (status, alt) =>
      status === 'waiting'
        ? `Recebendo URL de ${alt}`
        : status === 'received'
          ? `URL recebida para ${alt}`
          : `Erro ao receber ${alt}`,
    compressionStatusAria: (status, alt) =>
      status === 'rendering'
        ? `Renderizando ${alt}`
        : status === 'compressing'
          ? `Comprimindo ${alt}`
          : status === 'done'
            ? `${alt} comprimida`
            : `Erro ao comprimir ${alt}`,
    blockedDomainPolicyError: 'Este domínio viola nossas políticas de conteúdo',
  },
  imageBank: {
    openAria: 'Buscar imagens no banco de imagens',
    openTitle: 'Buscar imagens',
    brandTitle: 'Search Link Pexels',
    publicBankNotice:
      'Este serviço utiliza os bancos públicos do Pexels e Pixabay. Ao usá-las, você aceita que pertencem a esses bancos públicos e não a você nem ao Search Link, com permissão de uso. Veja:',
    publicBankLinkLabel: 'pexels.com',
    publicBankSecondLinkLabel: 'pixabay.com',
    savedAria: 'Ver imagens salvas',
    savedTitle: 'Salvos',
    savedFullTitle: 'Salvos',
    closeSavedAria: 'Fechar Salvos',
    savedEmptyHint: 'Aqui você verá as imagens salvas para os seus catálogos.',
    placeholder: 'Descreva a imagem que procura...',
    inputAria: 'Descrição da imagem que procura',
    clearQueryAria: 'Limpar busca',
    closeAria: 'Fechar buscador de imagens',
    panelAria: 'Buscador de imagens',
    searchingAria: 'Buscando imagens',
    noResultsNotice: 'Nenhuma imagem encontrada para essa busca. Tente outra descrição.',
    searchErrorFallback: 'Não foi possível concluir a busca no banco público.',
    saveImageAria: (alt) => `Salvar ${alt}`,
    unsaveImageAria: (alt) => `Remover de Salvos: ${alt}`,
    removeSavedAria: (alt) => `Remover de Salvos: ${alt}`,
    cooldownNotice: (waitText) =>
      `Proibido sobrecarregar servidores externos. Aguarde ${waitText}`,
    generateCardTitle: 'Gerar com IA',
    generateCardPlusBadge: 'Recurso do plano Plus',
    generatingAiLabel: 'Gerando com IA...',
    plusRequiredNotice: 'Você precisa estar no plano Plus para gerar.',
    generatedAutoSavedBadge: 'Salvo',
  },
  examples: {
    sectionAria: 'Exemplos de automações',
    sectionTitle: 'Exemplos de automações',
    sectionSubtitle: 'Como o Search Link atua em diferentes plataformas',
    cardAria: (platformLabel) => `Exemplo no ${platformLabel}`,
    visitorName: 'Visitante',
    items: {
      whatsapp: {
        bottomLabel: 'WhatsApp · Chatbots',
        accountType: 'Enterprise',
        headerSubline: 'Catálogo automático',
        userGreeting: 'Olá',
        botGreeting: 'Olá! Tudo bem? O que você está procurando hoje?',
        userRequest: 'Quero ver o catálogo de calçados brancos',
        botResultText: 'Aqui estão as opções do nosso catálogo.',
        products: [
          { name: 'Veloce Court', subtitle: 'Couro branco' },
          { name: 'Veloce Runner', subtitle: 'Knit marfim' },
        ],
      },
      telegram: {
        bottomLabel: 'Telegram · Bots',
        accountType: 'Bot Oficial',
        headerSubline: 'Concessionária digital',
        userGreeting: 'Olá, procuro carros',
        botGreeting: 'Bem-vindo! Prefere sedã elétrico ou SUV?',
        userRequest: 'Mostre os disponíveis hoje',
        botResultText: 'Estes dois modelos estão prontos para entrega.',
        products: [
          { name: 'Apex Air EV', subtitle: 'Sedã elétrico' },
          { name: 'Apex Terra', subtitle: 'SUV híbrida' },
        ],
      },
      instagram: {
        bottomLabel: 'Instagram · DM Bot',
        accountType: 'Loja',
        headerSubline: 'Respostas no DM',
        userGreeting: 'Olá, gostei do reel',
        botGreeting: 'Obrigado! Qual acessório você quer conferir?',
        userRequest: 'Relógios e óculos para presente',
        botResultText: 'Aqui estão nossos favoritos da temporada.',
        products: [
          { name: 'Crono Couro', subtitle: 'Edição clássica' },
          { name: 'Óculos Tartaruga', subtitle: 'Filtro UV400' },
        ],
      },
      messenger: {
        bottomLabel: 'Messenger · Meta Bot',
        accountType: 'Casa',
        headerSubline: 'Consultor de espaços',
        userGreeting: 'Oi, vi o anúncio de vocês',
        botGreeting: 'Olá! Para qual ambiente está procurando peças?',
        userRequest: 'Algo minimalista para a sala',
        botResultText: 'Essas duas peças combinam perfeitamente juntas.',
        products: [
          { name: 'Cadeira Carvalho', subtitle: 'Tecido bege' },
          { name: 'Monstera Vaso', subtitle: 'Cerâmica fosca' },
        ],
      },
      web: {
        bottomLabel: 'Chat Web · Loja',
        accountType: 'Web Widget',
        headerSubline: 'Cardápio online',
        userGreeting: 'Olá, o que recomendam?',
        botGreeting: 'Olá! Tudo sai fresquinho. O que você deseja hoje?',
        userRequest: 'Algo rápido para jantar hoje',
        botResultText: 'Nossos dois pratos mais pedidos esta noite.',
        products: [
          { name: 'Burger Brioche', subtitle: 'Cheddar maturado' },
          { name: 'Pizza Margherita', subtitle: 'Fermentação natural' },
        ],
      },
      discord: {
        bottomLabel: 'Discord · Bot API',
        accountType: 'APP',
        headerSubline: '#loja-hardware',
        userGreeting: 'Olá, busco setup escuro',
        botGreeting: 'E aí! Procura áudio ou periféricos?',
        userRequest: 'Mostre teclado e fones de ouvido',
        botResultText: 'Ambos disponíveis com envio imediato.',
        products: [
          { name: 'Pulse Audio Pro', subtitle: 'Preto fosco' },
          { name: 'Teclado 65%', subtitle: 'Alumínio âmbar' },
        ],
      },
      slack: {
        bottomLabel: 'Slack · App B2B',
        accountType: 'Empresa',
        headerSubline: '#compras-escritorio',
        userGreeting: 'Olá, estamos renovando o escritório',
        botGreeting: 'Com certeza. Quais itens precisam cotar?',
        userRequest: 'Cadeiras ergonômicas e canecas',
        botResultText: 'Catálogo corporativo pronto para pedido.',
        products: [
          { name: 'Cadeira Mesh Pro', subtitle: 'Alumínio B2B' },
          { name: 'Kit Cerâmica', subtitle: 'Lote escritório' },
        ],
      },
      line: {
        bottomLabel: 'LINE · Official Account',
        accountType: 'Oficial',
        headerSubline: 'Assistente cosmético',
        userGreeting: 'Olá, procuro skincare',
        botGreeting: 'Olá! Tem interesse em sérum ou fragrância?',
        userRequest: 'Mostre os dois por favor',
        botResultText: 'Aqui estão nossas fórmulas mais procuradas.',
        products: [
          { name: 'Sérum Âmbar', subtitle: 'Uso noturno' },
          { name: 'Essência Botânica', subtitle: 'Notas quentes' },
        ],
      },
    },
  },
  menu: {
    account: 'Conta',
    accountCreatedOn: (date) => `Criada em ${date}`,
    accountMenuAria: 'Menu da conta',
    accountOptionsAria: 'Opções da conta',
    backToMenuAria: 'Voltar ao menu',
    backToOrgAria: 'Voltar para Organização',
    closeAccountModalAria: 'Fechar conta Google',
    closeMenuAria: 'Fechar menu',
    closeOrgAria: 'Fechar Organização',
    closeStoreAria: 'Fechar Minha loja',
    confirmSignOutAria: 'Confirmar saída',
    confirmSignOutDescDesktop:
      'Sua organização e serviços salvos continuarão seguros para quando você voltar.',
    confirmSignOutDescMobile:
      'Sua organização e serviços continuarão salvos.',
    confirmSignOutTitle: 'Sair agora?',
    createdAtLabel: 'Criação da conta',
    dateUnavailable: 'Data indisponível',
    googleAccount: 'Conta Google',
    googleAccountDetailsAria: 'Detalhes da conta Google',
    googleAccountLabel: 'E-mail',
    language: 'Idioma',
    languageAutoDetectedNote: (countryCode) =>
      countryCode
        ? `Detectado automaticamente pela sua localização (${countryCode}).`
        : 'Detectado automaticamente pelo seu navegador.',
    languageLocalStorageHint:
      'Sua escolha manual fica salva localmente neste dispositivo.',
    languageManualSavedNote: 'Idioma selecionado manualmente.',
    languageOptionsAria: 'Idiomas disponíveis',
    languageSectionPrompt:
      'Escolha o idioma de toda a interface e do Search Link IA.',
    languagesTitle: 'Idiomas disponíveis',
    myStore: 'Minha loja',
    organization: 'Organização',
    signOut: 'Sair',
    signOutError: 'Não foi possível sair. Tente novamente.',
    usernameLabel: 'Nome',
    documentation: 'Documentações',
    privacyAndUse: 'Políticas de privacidade e uso',
    termsAndConditions: 'Termos e condições',
    contentPolicies: 'Políticas de conteúdo',
    cookiePolicies: 'Políticas de cookies',
    agencyMode: 'Modo Agência',
    agencyModeGuide: 'O que considerar no Modo Agência',
    agencyModeLiability: 'Responsabilidade e propriedade no Modo Agência',
    intellectualPropertyAndLiability: 'Propriedade intelectual e responsabilidade',
    comingSoon: 'Em breve',
    connectServer: 'Conecte seu servidor',
    closeConnectServerAria: 'Fechar Conecte seu servidor',
    goToAdvancedSettings: 'Ir para configurações avançadas',
    advancedSettings: 'Configurações avançadas',
    backToGoogleAccountAria: 'Voltar para Conta Google',
    closeAdvancedSettingsAria: 'Fechar Configurações avançadas',
  },
  auth: {
    acceptTermsLabel:
      'Aceito os termos de serviço e a política de privacidade do Search Link.',
    acceptTermsPrefix: 'Aceito os ',
    acceptTermsLinkLabel: 'termos de serviço',
    acceptTermsMiddle: ' e a ',
    acceptPrivacyLinkLabel: 'política de privacidade',
    acceptTermsSuffix: ' do Search Link.',
    bullet1: 'Sessão segura e criptografada com Google',
    bullet2: 'Catálogos e mídias sincronizados na nuvem',
    bullet3: 'API Keys e endpoints Search Link Core na hora',
    closePanelAria: 'Fechar painel da conta',
    connectingGoogle: 'Conectando com o Google…',
    continueWithGoogle: 'Continuar com o Google',
    drawerAriaGuest: 'Entrar no Search Link',
    errProviderNotEnabled:
      'O Google OAuth ainda não está ativado neste projeto Supabase.',
    errRateLimit: 'Muitas tentativas seguidas. Aguarde um instante.',
    googleLinkError: 'Não foi possível gerar o link do Google OAuth.',
    googleSignInError: 'Ocorreu um erro ao entrar com o Google.',
    googleSignedInSuccess: 'Login com Google realizado com sucesso.',
    loginHeading: 'Salve seus catálogos e gere sua API',
    loginSubtitle:
      'Conecte sua conta Google em um clique para sincronizar produtos, endpoints e uso em tempo real.',
    openGoogleNewTab: 'Abrir Google em nova aba',
    popupBlockedError:
      'O navegador bloqueou a janela pop-up do Google. Use o link abaixo.',
    supabaseMissingError:
      'A configuração do Supabase não está disponível neste ambiente.',
    termsError: 'Aceite os termos para continuar com o Google.',
  },
  chat: {
    clearConversation: 'Reiniciar conversa',
    clearShort: 'Nova conversa',
    closeAria: 'Fechar chat de teste',
    dailyLimitNotice:
      'Seu limite foi atingido, mude para o plano Plus.',
    dailyLimitPlaceholder: 'Limite diário atingido...',
    defaultRequestError: 'Não foi possível obter resposta do Search Link IA.',
    defaultStreamError: 'Erro durante a resposta ao vivo.',
    defaultSuccessReply: 'Consulta concluída.',
    inputAria: 'Digite uma pergunta para testar o catálogo',
    inputPlaceholder: 'Pergunte sobre qualquer produto do catálogo...',
    liveProducts: (count) =>
      `${count} produto${count === 1 ? '' : 's'} ao vivo`,
    networkError: 'Erro de conexão com o Search Link IA. Tente novamente.',
    preparingReply: 'Preparando resposta…',
    queryingCatalog: 'Consultando catálogo ao vivo…',
    sendAria: 'Enviar mensagem',
  },
  org: {
    apiHintPrefixDesktop:
      'Por segurança, salvamos apenas o prefixo na nuvem. Se precisar da chave completa, você pode regenerá-la na hora.',
    apiHintPrefixMobile:
      'Armazenamos apenas o prefixo por segurança. Você pode regenerar a chave quando quiser.',
    apiHintRaw:
      'Envie esta chave em Authorization: Bearer <API_KEY> ou x-api-key para consultar este serviço.',
    changeLogoAria: 'Alterar logo da organização',
    changeLogoTitle: 'Alterar logo',
    closeBoxAria: 'Fechar janela',
    companyPlaceholder: 'Nome da sua empresa ou marca',
    congratsBoth:
      'Seu logo e o nome da organização foram salvos. Tudo pronto para gerenciar seus serviços.',
    congratsLogoOnly:
      'Seu logo foi salvo com sucesso. Você pode adicionar ou editar o nome quando quiser.',
    congratsMobileFallback:
      'Sua organização está configurada para publicar catálogos e endpoints.',
    congratsNameOnly:
      'O nome da organização foi salvo. Você também pode enviar um logo depois.',
    congratsTitle: 'Organização configurada!',
    copyCurlDesktop: 'Copiar comando cURL',
    copyCurlMobile: 'Copiar cURL',
    curlCopied: 'cURL copiado',
    helperArrowPrompt:
      'Envie o logo ou digite o nome do seu negócio para personalizar seus endpoints e loja.',
    logoUploadError: 'Não foi possível enviar o logo.',
    myServices: 'Meus serviços',
    newProduct: 'Novo produto',
    noServicesAvailable: 'Nenhum serviço ativo ainda',
    noServicesDescDesktop:
      'Processe uma URL ou envie suas imagens pela tela inicial para gerar seu primeiro endpoint ao vivo.',
    noServicesDescMobile:
      'Processe uma URL ou envie imagens no início para ver seus serviços aqui.',
    noServicesTitleDesktop: 'Você ainda não tem serviços gerados',
    noServicesTitleMobile: 'Nenhum serviço ainda',
    openStoreAria: 'Abrir loja do serviço',
    openStoreServicesAria: 'Abrir seletor de Minha loja',
    orgNamePlaceholder: 'Nome da organização',
    orgNameShortPlaceholder: 'Nome da sua marca',
    pasteKeyPlaceholder: 'Cole aqui sua API Key completa para testar...',
    pickStoreAria: 'Selecionar loja de serviço',
    productCount: (count) =>
      `${count} produto${count === 1 ? '' : 's'}`,
    productCountShort: (count) => `${count} itens`,
    regenerateKeyDesktop: 'Regenerar API Key',
    regenerateKeyMobile: 'Regenerar chave',
    renameOrgAria: 'Renomear organização',
    renameOrgTitle: 'Renomear',
    renameServiceAria: (name) => `Renomear serviço ${name}`,
    renameServiceTitle: 'Renomear serviço',
    saveOrgNameAria: 'Salvar nome da organização',
    saveServiceNameAria: 'Salvar nome do serviço',
    serviceActiveDesktop: 'Serviço ativo',
    serviceActiveMobile: 'Ativo',
    serviceApiLink: 'Ver API Key',
    serviceEndpointLink: 'Endpoint & Teste ao vivo',
    servicePausedDesktop: 'Serviço pausado',
    servicePausedMobile: 'Pausado',
    testChatAria: (name) => `Testar ${name} com Search Link IA`,
    testChatTitle: 'Testar com Search Link IA',
    testLive: 'Testar ao vivo',
    unnamed: 'Sem nome',
    uploadLogoAria: 'Enviar logo da organização',
    uploadLogoTitle: 'Enviar logo',
    viewHistoryAria: (name) => `Ver catálogo completo de ${name}`,
    viewHistoryTitle: 'Ver histórico do serviço',
    viewStoreOf: 'Abrir Minha loja de:',
    viewStoreTitle: 'Minha loja',
    welcomeSubtitle:
      'Centralize seus catálogos, API Keys e chatbot Search Link IA em um só lugar.',
    welcomeTitle: 'Bem-vindo à sua Organização',
    moreActionsAria: (name) => `Mais opções para ${name}`,
    menuSearchAi: 'Search IA',
    menuViewProcess: 'Ver processo',
    menuViewSchema: 'Ver esquema',
    schemaTitle: 'Esquema',
    copySchemaAria: 'Copiar esquema',
    downloadSchemaZipAria: 'Baixar esquema em ZIP',
    downloadSchemaZipTitle: 'Baixar ZIP',
    backToOrgSchemaAria: 'Voltar para Organização',
  },
  store: {
    emptyDescDesktop:
      'Este serviço ainda não possui produtos salvos para exibir.',
    emptyDescMobile: 'Este serviço ainda não possui produtos para exibir.',
    emptyTitle: 'Sem produtos nesta loja',
    noImage: 'Sem imagem',
    tapToCollapse: 'Toque para recolher o nome',
    tapToExpandFull: (name) => `Toque para ver completo: ${name}`,
    unnamedProduct: 'Produto sem nome',
  },
  pipeline: {
    backToMappedAria: 'Voltar ao mapeamento JSON',
    benefits: [
      {
        id: 'speed',
        title: 'Pronto em segundos',
        description:
          'Otimiza imagens em WebP e envia direto para a CDN sem configuração manual.',
      },
      {
        id: 'clean-urls',
        title: 'URLs limpas para bots',
        description:
          'Links curtos e imutáveis prontos para WhatsApp, Telegram ou qualquer API.',
      },
      {
        id: 'easy-anywhere',
        title: 'Fácil pelo celular',
        description:
          'Envie fotos da galeria ou extraia qualquer site instantaneamente.',
      },
      {
        id: 'ready-to-share',
        title: 'Catálogo estruturado',
        description:
          'A IA identifica nomes, categorias e descrições prontos em JSON ou PDF.',
      },
    ],
    clickToViewTitle: (alt) => `Clique para ampliar: ${alt}`,
    closeEditorBackAria: 'Fechar editor e voltar',
    closeEditorTitle: 'Fechar editor',
    closeExpandedAria: 'Recolher visualização ampliada',
    closeFullscreenAria: 'Fechar imagem em tela cheia',
    closeImageAria: 'Fechar imagem',
    congratsBodyDesktop: (count) =>
      `Seu catálogo com ${count} produto${count === 1 ? '' : 's'} está otimizado, mapeado no Search Link Core e pronto para conectar a qualquer canal.`,
    congratsBodyMobile: (count) =>
      `${count} produto${count === 1 ? '' : 's'} otimizado${count === 1 ? '' : 's'} e pronto${count === 1 ? '' : 's'} para usar no seu chatbot ou loja.`,
    congratsTitleDesktop: 'Automação concluída!',
    congratsTitleMobile: 'Tudo pronto!',
    copyAllJsonAria: 'Copiar todo o JSON do catálogo',
    copyApiAria: 'Copiar API Key',
    copyApiTitle: 'Copiar API Key',
    copyEndpointAria: 'Copiar URL do endpoint',
    copyEndpointTitle: 'Copiar endpoint',
    copyJsonOfAria: (name) => `Copiar JSON de ${name}`,
    copyJsonTitle: 'Copiar JSON',
    copyUrlOfAria: (label) => `Copiar URL de ${label}`,
    copyUrlTitle: 'Copiar URL',
    couldNotMap: 'Não foi possível mapear este item.',
    couldNotReceive: 'Não foi possível obter a URL final.',
    credentialsReadyHint:
      'Use esta chave e endpoint no WhatsApp, Telegram ou no seu servidor backend.',
    credentialsReadyTitle: 'Credenciais ao vivo prontas',
    doubleClickFullscreen: (alt) => `Clique duplo para tela cheia: ${alt}`,
    elementsCount: (count) => `${count} ite${count === 1 ? 'm' : 'ns'}`,
    enlargeLeftAria: (alt) => `Ampliar imagem ${alt}`,
    expandedImagesAria: 'Visualização ampliada de imagens',
    expandedMetadataAria: 'Visualização ampliada de metadados',
    generatedApiTitle: 'API Key e Endpoint gerados',
    generatedApisLink: 'Ver API Key gerada',
    generatedEndpointLink: 'Ver Endpoint ao vivo',
    generatingApiKey: 'Gerando API Key…',
    generatingEndpoint: 'Gerando endpoint…',
    goToLifecycleAria: 'Ver ciclo de vida e credenciais',
    mobileCarouselAria: 'Carrossel de catálogo e IA',
    mobileCompressionAria: 'Progresso de compressão e envio',
    openOriginalImageTitle: (alt) => `Abrir imagem original: ${alt}`,
    pdfActions: {
      json: 'Baixar PDF JSON',
      images: 'Baixar PDF de Imagens',
      urls: 'Baixar PDF de URLs',
      metadata: 'Baixar PDF de Metadados',
      all: 'Baixar Catálogo Completo (PDF)',
      openEditor: 'Ver JSON no editor',
      schema: 'Baixar esquema',
    },
    productJsonLabel: 'JSON do produto',
    readOnlyEditorAria: 'Editor JSON somente leitura',
    searchingImages: 'Extraindo imagens…',
    showJsonAria: (isExpanded, name) =>
      isExpanded ? `Ocultar JSON de ${name}` : `Ver JSON de ${name}`,
    stageCompressingTitle: 'Comprimindo imagens…',
    stageEditorTitle: 'Editor JSON',
    stageImagesTitle: 'Imagens do catálogo',
    stageLifecycleFullTitle: 'Ciclo de vida · Search Link Core',
    stageLifecycleTitle: 'Ciclo de vida',
    stageMappedDoneTitle: 'Mapeamento concluído',
    stageMappingTitle: 'Mapeando com IA…',
    stageMetadataTitle: 'URLs limpas',
    stageProductivityTitle: 'Produtividade',
    stageReceivingTitle: 'Recebendo URLs finais…',
    stageUploadingTitle: 'Enviando para o Search Link Cloud…',
    stageViewApiTitle: 'Sua API pronta',
    tapBorderToExpand: 'Toque na borda para ampliar',
    useAsBackgroundAria: (alt) => `Usar ${alt} como fundo`,
    viewInBackgroundTitle: (alt) => `Ver ${alt} como fundo`,
    viewProductAria: (name) => `Ver produto ${name}`,
    viewYourOrg: 'Abrir Organização e testar na IA',
    whyUseSearchLink: 'Por que usar o Search Link?',
    whyUseSearchLinkAria: 'Benefícios do Search Link',
  },
  connectServer: {
    title: 'Conecte seu servidor',
    serverUrlLabel: 'Cole a URL do seu servidor',
    serverUrlPlaceholder: 'https://seu-servidor.com/webhook',
    serverUrlAria: 'URL do seu servidor',
    showUrlAria: 'Ver URL do servidor',
    hideUrlAria: 'Ocultar URL do servidor',
    chooseServiceLabel: 'Escolha seu serviço',
    chooseServicePlaceholder: 'Selecione um serviço',
    chooseServiceMenuAria: 'Selecionar serviço para sincronizar',
    allServicesSelected: 'Todos os seus serviços',
    syncAllOption: 'Sincronizar todos',
    newServicesSelected: 'Novos serviços',
    syncNewServicesOption: 'Novos serviços',
    noServicesHint: 'Você ainda não tem serviços criados',
    secretKeyLabel: 'Chave secreta',
    secretKeyAria: 'Chave secreta do servidor',
    showSecretAria: 'Ver chave secreta',
    hideSecretAria: 'Ocultar chave secreta',
    copySecretAria: 'Copiar chave secreta',
    secretHelpTrigger: 'Não sabe o que fazer? Ajuda',
    secretHelpTitle: 'Como conectar com sua chave secreta',
    secretHelpCloseAria: 'Fechar guia da chave secreta',
    secretHelpWhyTitle: 'Para que serve esta chave secreta?',
    secretHelpWhyBody:
      'É a senha privada compartilhada apenas entre o Search Link e o seu servidor. Sempre que o Search Link envia atualizações, ele assina a requisição com essa chave para que o servidor confirme que veio da sua conta e bloqueie desconhecidos.',
    secretHelpVarRuleTitle: 'O que você precisa configurar no servidor',
    secretHelpVarRuleBody:
      'Em quase todos os provedores o processo é igual: abra as variáveis de ambiente do projeto, crie a variável com o nome exato abaixo e cole como valor a chave secreta copiada em Conecte seu servidor.',
    secretHelpVarNameLabel: 'Nome da variável:',
    secretHelpExampleValueLabel: 'Exemplo de chave secreta:',
    secretHelpExampleValue: 'sl_whsec_exemplo9f4a2c8b1d07e6a3c5b2f8e1a9d4c7b0',
    secretHelpExampleHint:
      '(Isto é apenas um exemplo de formato; cole a sua própria chave secreta).',
    secretHelpProvidersTitle: 'Como configurar nos servidores mais usados',
    secretHelpProviders: [
      {
        id: 'render',
        name: 'Render',
        steps: [
          'Abra seu Web Service no Render (você pode usar o código de Rápido e executável).',
          'Deixe Build Command vazio ou npm install, e em Start Command coloque npm start.',
          'Acesse Environment → Environment Variables → Add Environment Variable.',
          'Em Key coloque SEARCHLINK_WEBHOOK_SECRET e em Value cole a sua chave secreta.',
          'Salve as alterações e aguarde o deploy finalizar no Render.',
        ],
      },
      {
        id: 'cloudflare',
        name: 'Cloudflare',
        steps: [
          'Abra seu projeto no Cloudflare Workers ou Pages pelo painel.',
          'Acesse Settings → Variables and Secrets → Add.',
          'Escolha o tipo Secret, nomeie como SEARCHLINK_WEBHOOK_SECRET e cole sua chave secreta.',
          'Salve e faça um novo deploy do Worker para ativar o segredo.',
        ],
      },
      {
        id: 'railway',
        name: 'Railway / Fly.io',
        steps: [
          'Selecione seu serviço no projeto e abra a aba Variables.',
          'Adicione uma nova variável chamada SEARCHLINK_WEBHOOK_SECRET.',
          'Cole a chave secreta como valor e salve; o serviço reinicia automaticamente.',
        ],
      },
      {
        id: 'vercel',
        name: 'Vercel',
        steps: [
          'Abra seu projeto na Vercel e vá em Settings → Environment Variables.',
          'Em Name digite SEARCHLINK_WEBHOOK_SECRET e em Value cole a sua chave secreta.',
          'Salve a variável e faça um Redeploy para aplicar em produção.',
        ],
      },
      {
        id: 'vps',
        name: 'VPS / Servidor próprio',
        steps: [
          'Na pasta do servidor, crie ou edite o arquivo .env ao lado de server.mjs.',
          'Adicione a linha SEARCHLINK_WEBHOOK_SECRET=sua_chave_secreta e salve.',
          'Execute npm start (ou reinicie o PM2/Docker) para carregar a variável.',
        ],
      },
    ],
    secretHelpFinalStepTitle: 'Último passo: colar a URL e sincronizar',
    secretHelpFinalStepBody:
      'Quando o servidor estiver no ar com essa variável salva, copie a URL do webhook (por exemplo https://seu-servidor.onrender.com/webhook), volte aqui, cole no campo URL, escolha quais serviços enviar e toque em Sincronizar.',
    syncAction: 'Sincronizar',
    syncingAction: 'Sincronizando…',
    validationUrlRequired: 'Cole primeiro a URL do seu servidor.',
    validationUrlInvalid: 'Informe uma URL válida com http:// ou https://.',
    validationServiceRequired: 'Escolha um serviço, "Sincronizar todos" ou "Novos serviços".',
    noServicesToSync: 'Você ainda não tem serviços para sincronizar.',
    authRequired: 'Entre novamente para sincronizar.',
    syncSuccess: (srv, prod, ms) =>
      `Sincronizado: ${srv} ${srv === 1 ? 'serviço' : 'serviços'} (${prod} ${prod === 1 ? 'produto' : 'produtos'}) em ${ms} ms.`,
    syncNewServicesSuccess: (ms) =>
      `Conectado no modo Novos serviços em ${ms} ms. Cada novo serviço criado será enviado automaticamente.`,
    syncNetworkError: 'Não foi possível conectar ao Search Link para sincronizar.',
    syncLiabilityConfirmText:
      'Ao aceitar, você confirma que toda a responsabilidade por disponibilidade, quedas, segurança e clientes atendidos recai exclusivamente sobre o seu servidor em qualquer circunstância.',
    disconnectAction: 'Desconectar',
    disconnectingAction: 'Desconectando…',
    disconnectConfirmPrompt:
      'Ao desconectar seu servidor, as atualizações automáticas serão interrompidas e as requisições das suas APIs voltarão a ser processadas diretamente no Search Link dentro dos limites do seu plano atual. Para continuar, digite:',
    disconnectConfirmPhrase: 'estou de acordo',
    disconnectConfirmPlaceholder: 'estou de acordo',
    disconnectConfirmInputAria: 'Digite estou de acordo para desconectar seu servidor',
    disconnectSuccess:
      'Servidor desconectado. As requisições agora voltam a ser processadas pelo Search Link.',
    disconnectNetworkError:
      'Não foi possível conectar ao Search Link para desconectar seu servidor.',
    quickServerTitle: 'Rápido e executável',
    quickServerFilesAria: 'Arquivos do servidor Rápido e executável',
    downloadQuickServerZipAria: 'Baixar servidor Rápido e executável em ZIP',
    downloadQuickServerZipTitle: 'Baixar ZIP',
    copyQuickServerFileAria: 'Copiar código deste arquivo',
    swipeHintLabel: 'Deslize',
    swipeToQuickServerAria: 'Deslize para ver o código de Rápido e executável',
    backToConnectServerAria: 'Voltar para Conecte seu servidor',
    testRequestAction: 'Fazer requisição de teste',
    testServerTitle: 'Teste de servidor',
    testConsentPrompt:
      'Você aceita que façamos a avaliação enviando uma requisição ao seu servidor para trazer todas as imagens registradas?',
    testRunningLabel: 'Avaliando a resposta do seu servidor…',
    testEmptyCatalogNote:
      'Seu servidor respondeu corretamente, mas ainda não possui produtos nem imagens armazenadas.',
    testStatusLabel: 'Status',
    testLatencyLabel: 'Latência',
    testImagesCountLabel: 'Imagens',
    testRetryAction: 'Avaliar novamente',
    testCloseAria: 'Fechar teste de servidor',
  },
  advancedSettings: {
    title: 'Configurações avançadas',
    confirmPromptAria: 'Confirmação de ação nas configurações avançadas',
    r2DeleteTitle: 'Apagar todas as imagens do R2',
    r2DeleteButton: 'Apagar',
    r2DeleteConfirmText:
      'Esta ação apagará permanentemente todas as imagens que você publicou e salvou no R2. Seus links atuais deixarão de carregar e esta operação é executada sob sua responsabilidade. Deseja continuar?',
    clearBrowserDataTitle: 'Limpar todos os dados de navegação',
    clearBrowserDataButton: 'Confirmar',
    clearBrowserDataConfirmText:
      'Todos os dados locais de navegação, cookies e cache do Search Link neste dispositivo serão apagados, encerrando sua sessão para que você precise entrar novamente com o Google. Esta ação é executada sob sua responsabilidade.',
    deleteAccountTitle: 'Excluir conta Google definitivamente',
    deleteAccountButton: 'Confirmar',
    deleteAccountConfirmText:
      'Sua conta vinculada ao Google será excluída definitivamente junto com sua organização, serviços, chaves e imagens associadas, sem possibilidade de recuperação. Esta ação é executada sob sua total responsabilidade.',
    pauseAllApisTitle: 'Pausar todas as APIs ativas',
    pauseAllApisButton: 'Confirmar',
    pauseAllApisConfirmText:
      'Todas as API Keys ativas de todos os seus serviços serão pausadas imediatamente e não responderão requisições até que você as reative manualmente. Esta ação é executada sob sua responsabilidade.',
    r2PurgeSuccess: (count) =>
      count > 0
        ? `${count} ${count === 1 ? 'imagem foi removida' : 'imagens foram removidas'} do R2 e seus catálogos publicados foram limpos.`
        : 'Suas mídias no R2 e catálogos publicados foram limpos.',
    r2EmptyError: 'Você não tem imagens no R2.',
    pauseApisSuccess: (count) =>
      count > 0
        ? `${count} ${count === 1 ? 'serviço foi pausado' : 'serviços foram pausados'} e todas as API Keys ativas foram desativadas.`
        : 'Todas as API Keys ativas foram pausadas.',
    thingsYouCanDoTitle: 'Coisas que você pode fazer agora',
    unfreezeApisSubtitle: 'Despausar seus serviços',
    unfreezeApisButton: 'Descongelar',
    unfreezeApisSuccess: (count) =>
      count > 0
        ? `${count} ${count === 1 ? 'serviço foi descongelado' : 'serviços foram descongelados'} e todas as suas APIs voltaram a funcionar.`
        : 'Todas as suas APIs voltaram a funcionar.',
    actionErrorFallback: 'Não foi possível concluir a operação. Tente novamente.',
  },
};

const DICTIONARIES: Record<SupportedLocale, TranslationDictionary> = {
  es: ES_DICTIONARY,
  en: EN_DICTIONARY,
  pt: PT_DICTIONARY,
};

const LOCALE_STORAGE_KEY = 'searchlink_locale_override';

function normalizeLocale(raw: string | null | undefined): SupportedLocale | null {
  if (!raw) return null;
  const base = raw.trim().toLowerCase().split(/[-_]/)[0];
  if (base === 'es' || base === 'en' || base === 'pt') return base;
  return null;
}

function getDateLocaleTag(locale: SupportedLocale): string {
  if (locale === 'en') return 'en-US';
  if (locale === 'pt') return 'pt-BR';
  return 'es-ES';
}

export function formatCreationDate(
  iso: string | undefined | null,
  locale: SupportedLocale,
  unavailableLabel: string,
): string {
  if (!iso) return unavailableLabel;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return unavailableLabel;
  try {
    return new Intl.DateTimeFormat(getDateLocaleTag(locale), {
      dateStyle: 'long',
    }).format(date);
  } catch {
    return unavailableLabel;
  }
}

interface I18nContextValue {
  locale: SupportedLocale;
  source: LocaleSource;
  countryCode: string | null;
  setManualLocale: (next: SupportedLocale) => void;
  t: TranslationDictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readSavedManualLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function getBrowserFallbackLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return 'es';
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];

  for (const lang of candidates) {
    const matched = normalizeLocale(lang);
    if (matched) return matched;
  }
  return 'es';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const initialManual = readSavedManualLocale();

  const [locale, setLocale] = useState<SupportedLocale>(
    () => initialManual ?? getBrowserFallbackLocale(),
  );
  const [source, setSource] = useState<LocaleSource>(() =>
    initialManual ? 'manual' : 'default',
  );
  const [countryCode, setCountryCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  useEffect(() => {
    if (initialManual) return;

    let active = true;
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch(resolveApiUrl('/api/locale'), {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok || !active) return;

        const data = (await res.json()) as {
          ok?: boolean;
          locale?: string;
          countryCode?: string | null;
          source?: LocaleSource;
        };

        if (!active || readSavedManualLocale()) return;

        const detected = normalizeLocale(data.locale);
        if (detected) {
          setLocale(detected);
        }
        if (typeof data.countryCode === 'string' && data.countryCode.trim()) {
          setCountryCode(data.countryCode.trim().toUpperCase());
        } else {
          setCountryCode(null);
        }
        if (
          data.source === 'geo' ||
          data.source === 'header' ||
          data.source === 'default'
        ) {
          setSource(data.source);
        }
      } catch {
        // Silently keep navigator/default locale if request fails
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [initialManual]);

  const setManualLocale = useCallback((next: SupportedLocale) => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore storage quota errors cleanly
    }
    setLocale(next);
    setSource('manual');
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      source,
      countryCode,
      setManualLocale,
      t: DICTIONARIES[locale] ?? ES_DICTIONARY,
    }),
    [locale, source, countryCode, setManualLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: 'es',
      source: 'default',
      countryCode: null,
      setManualLocale: () => {},
      t: ES_DICTIONARY,
    };
  }
  return ctx;
}
