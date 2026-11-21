const BLOCKED_ADULT_TLDS = new Set(['xxx', 'porn', 'sex', 'adult']);

/**
 * Exact root domains (and all subdomains) known for explicit pornography,
 * live adult cams, explicit escort directories, or extreme shock/gore media.
 */
const BLOCKED_EXACT_ROOT_DOMAINS = new Set([
  // Major tube & pornographic video platforms
  'pornhub.com',
  'pornhub.org',
  'pornhub.net',
  'pornhubpremium.com',
  'xvideos.com',
  'xvideos.es',
  'xvideos-es.com',
  'xvideos2.com',
  'xvideos3.com',
  'xv-videos1.com',
  'xnxx.com',
  'xnxx.es',
  'xnxx2.com',
  'xnxx3.com',
  'xhamster.com',
  'xhamster.desi',
  'xhamster.live',
  'redtube.com',
  'youporn.com',
  'tube8.com',
  'spankbang.com',
  'spankbang.party',
  'eporner.com',
  'hqporner.com',
  'txxx.com',
  'hclips.com',
  'upornia.com',
  'vporn.com',
  'tnaflix.com',
  'empflix.com',
  'drtuber.com',
  'thumbzilla.com',
  'porn.com',
  'porntrex.com',
  'beeg.com',
  'nuvid.com',
  'sunporno.com',
  'fapvid.com',
  'motherless.com',
  'heavy-r.com',
  'efukt.com',
  'xozilla.com',
  'youjizz.com',
  'jizzbunker.com',
  'ixxx.com',
  'fuq.com',
  'alohatube.com',
  'tubegalore.com',
  'tiava.com',
  'fux.com',
  'pornmd.com',
  'nudevista.com',
  'findtubes.com',
  'porndoe.com',
  'yespornplease.com',
  'ok.xxx',
  '4tube.com',
  'pornerbros.com',
  '3movs.com',
  'vikiporn.com',
  'anyporn.com',
  'sexvid.xxx',
  'bravotube.net',
  'stileproject.com',
  'keezmovies.com',
  'extremetube.com',
  'spankwire.com',
  'slutload.com',
  'xtube.com',
  'porn300.com',
  'pornone.com',
  'sxyprn.com',
  'daftsex.com',
  'netfapx.com',
  'pandamovies.pw',
  'goodporn.to',
  'watchporn.to',
  'zbporn.com',
  'hitprn.com',
  'porngo.com',
  'inxxx.com',
  'vipsexvault.com',
  'pornhat.com',
  'hdporn92.com',
  'freeuseporn.com',
  'noodlemagazine.com',
  'thisvid.com',
  'boyfriendtv.com',
  'gaymaletube.com',
  'gaytube.com',
  'myvidster.com',
  'missav.com',
  'javhd.com',
  'javgg.net',
  'supjav.com',
  'javmost.com',
  '18jav.tv',
  'avgle.com',
  'jable.tv',

  // Adult studios & explicit media networks
  'brazzers.com',
  'bangbros.com',
  'realitykings.com',
  'naughtyamerica.com',
  'mofos.com',
  'digitalplayground.com',
  'twistys.com',
  'babes.com',
  'wicked.com',
  'evilangel.com',
  'kink.com',
  'blacked.com',
  'tushy.com',
  'vixen.com',
  'deeper.com',
  'slayed.com',
  'teamskeet.com',
  'nubiles.net',
  'nubilefilms.com',
  'metart.com',
  'joymii.com',
  'femjoy.com',
  'hegre.com',
  'x-art.com',
  'wowgirls.com',
  '21sextury.com',
  'private.com',
  'dorcelclub.com',
  'dorcel.com',
  'julesjordan.com',
  'elegantangel.com',

  // Explicit creator/leak mirrors & adult clip stores
  'onlyfans.com',
  'fansly.com',
  'manyvids.com',
  'clips4sale.com',
  'iwantclips.com',
  'loyaltyfans.com',
  'fapello.com',
  'coomer.su',
  'coomer.party',
  'kemono.su',
  'kemono.party',
  'simpcity.su',
  'erome.com',
  'redgifs.com',

  // Adult live webcam platforms
  'chaturbate.com',
  'stripchat.com',
  'bongacams.com',
  'livejasmin.com',
  'cam4.com',
  'camsoda.com',
  'myfreecams.com',
  'flirt4free.com',
  'imlive.com',
  'jerkmate.com',
  'xcams.com',
  'streamate.com',
  'cams.com',
  'cherry.tv',
  'xlovecam.com',
  'luckycrush.live',
  'fapchat.com',
  'dirtyroulette.com',
  'cameraprive.com',
  'camera-prive.com',

  // Explicit hentai, adult doujinshi & rule34 platforms
  'nhentai.net',
  'hentaihaven.xxx',
  'hanime.tv',
  'hentaifox.com',
  'hitomi.la',
  'e-hentai.org',
  'exhentai.org',
  'rule34.xxx',
  'rule34.paheal.net',
  'tsumino.com',
  'luscious.net',
  'fakku.net',
  'nutaku.net',
  'pururin.to',
  'simply-hentai.com',
  'hentai2read.com',
  'multporn.net',
  '8muses.com',
  'e621.net',

  // Regional ES / LatAm / PT / BR explicit & escort domains
  'cumlouder.com',
  'putalocura.com',
  'sexmex.xxx',
  'fakings.com',
  'torbe.com',
  'cholotube.com',
  'pornolandia.com',
  'vercomicsporno.com',
  'chochox.com',
  'petardas.com',
  'pichacorta.com',
  'pornohd.xxx',
  'pornocaliente.com',
  'sexlatino.com',
  'brasileirinhas.com.br',
  'soufoda.com',
  'sexlog.com',
  'fatalmodel.com',
  'skokka.com',
  'mileroticos.com',
  'adultwork.com',
  'escortdirectory.com',
  'eurogirlsescort.com',
  'slixa.com',
  'eros.com',

  // Shock / extreme gore / lethal violence portals
  'bestgore.fun',
  'kaotic.com',
  'theync.com',
  'crazyshit.com',
  'goregrish.com',
  'seegore.com',
  'documentingreality.com',
  'gorecenter.com',
  'watchpeopledie.tv',
  'deadhouse.org',
  'rotten.com',
  'livegore.com',
  'xgore.net',
  'hoodsite.com',
  'forogore.net',
]);

/**
 * Unambiguous major adult/gore brand labels used to catch rotating TLD or numbered mirrors
 * (e.g. `es.xvideos4.com`, `xhamster19.desi`, `pornhub-es.org`) without causing false
 * positives on benign domains.
 */
const UNAMBIGUOUS_BRAND_TOKENS = [
  'pornhub',
  'xvideos',
  'xnxx',
  'xhamster',
  'redtube',
  'youporn',
  'spankbang',
  'eporner',
  'hqporner',
  'porntrex',
  'upornia',
  'tnaflix',
  'empflix',
  'drtuber',
  'thumbzilla',
  'youjizz',
  'jizzbunker',
  'porndoe',
  'pornerbros',
  'vikiporn',
  'pornhat',
  'porn300',
  'pornone',
  'noodlemagazine',
  'chaturbate',
  'stripchat',
  'bongacams',
  'livejasmin',
  'camsoda',
  'myfreecams',
  'flirt4free',
  'jerkmate',
  'xlovecam',
  'cameraprive',
  'brazzers',
  'bangbros',
  'realitykings',
  'naughtyamerica',
  'digitalplayground',
  'teamskeet',
  'evilangel',
  'julesjordan',
  'nhentai',
  'hentaihaven',
  'hentaifox',
  'hanime',
  'rule34',
  'fapello',
  'coomer',
  'erome',
  'redgifs',
  'cumlouder',
  'putalocura',
  'sexmex',
  'fakings',
  'brasileirinhas',
  'fatalmodel',
  'mileroticos',
  'skokka',
  'motherless',
  'bestgore',
  'theync',
  'crazyshit',
  'goregrish',
  'seegore',
  'watchpeopledie',
  'livegore',
  'forogore',
];

export interface DomainPolicyCheckResult {
  blocked: boolean;
  domain?: string;
}

function extractHostnameCandidate(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');
    if (!hostname || !hostname.includes('.')) return null;
    return hostname;
  } catch {
    return null;
  }
}

export function isBlockedPolicyDomain(rawInput: string): DomainPolicyCheckResult {
  const hostname = extractHostnameCandidate(rawInput);
  if (!hostname) {
    return { blocked: false };
  }

  const labels = hostname.split('.').filter(Boolean);
  if (labels.length < 2) {
    return { blocked: false };
  }

  const tld = labels[labels.length - 1];
  if (BLOCKED_ADULT_TLDS.has(tld)) {
    return { blocked: true, domain: hostname };
  }

  // Exact root or any subdomain match (e.g. es.pornhub.com -> pornhub.com)
  for (let i = 0; i <= labels.length - 2; i++) {
    const slice = labels.slice(i).join('.');
    if (BLOCKED_EXACT_ROOT_DOMAINS.has(slice)) {
      return { blocked: true, domain: slice };
    }
  }

  // Catch numbered/hyphenated/regional mirrors of unmistakable adult/gore brands
  // e.g. xvideos5.com, es.xhamster19.desi, pornhub-br.net
  const domainLabels = labels.slice(0, -1);
  for (const label of domainLabels) {
    for (const token of UNAMBIGUOUS_BRAND_TOKENS) {
      if (label === token) {
        return { blocked: true, domain: hostname };
      }
      if (
        label.startsWith(token) &&
        /^[-_\d]*$/.test(label.slice(token.length))
      ) {
        return { blocked: true, domain: hostname };
      }
      if (
        token.length >= 7 &&
        (label.includes(`-${token}`) || label.includes(`${token}-`))
      ) {
        return { blocked: true, domain: hostname };
      }
    }
  }

  return { blocked: false };
}
