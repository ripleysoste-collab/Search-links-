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
    domainPromptQuestion: string;
    domainPromptCancel: string;
    domainPromptContinue: string;
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
  };
  auth: {
    acceptTermsLabel: string;
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
    domainPromptQuestion:
      'Si lo deseas, puedes detenerlo y subir desde almacenamiento.',
    domainPromptCancel: 'Cancelar',
    domainPromptContinue: 'Continuar',
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
  },
  auth: {
    acceptTermsLabel: 'Acepto los términos y políticas de privacidad de Search Link.',
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
    domainPromptQuestion:
      "If you'd like, you can stop here and upload from storage.",
    domainPromptCancel: 'Cancel',
    domainPromptContinue: 'Continue',
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
  },
  auth: {
    acceptTermsLabel: 'I accept the Search Link terms of service and privacy policy.',
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
    domainPromptQuestion:
      'Se quiser, você pode parar aqui e enviar do armazenamento.',
    domainPromptCancel: 'Cancelar',
    domainPromptContinue: 'Continuar',
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
  },
  auth: {
    acceptTermsLabel:
      'Aceito os termos de serviço e a política de privacidade do Search Link.',
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
