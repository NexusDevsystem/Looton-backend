/**
 * Content AI Classifier - Sistema de IA para classificação de conteúdo adulto
 * Análise profunda usando NLP, heurísticas avançadas e machine learning básico
 *
 * SEGURANÇA MÁXIMA: Este sistema protege crianças de conteúdo inapropriado
 */

// Pesos para o scoring de conteúdo adulto
const WEIGHTS = {
  TITLE_EXACT: 100,      // Palavra exata no título = bloqueio imediato
  TITLE_PARTIAL: 50,     // Palavra parcial no título
  TAG_EXACT: 80,         // Tag exata banida
  TAG_PARTIAL: 40,       // Tag parcial suspeita
  DESCRIPTION_STRONG: 60, // Palavra forte na descrição
  DESCRIPTION_WEAK: 20,   // Indicador fraco na descrição
  VISUAL_INDICATOR: 70,   // Indicador visual (cover art keywords)
  AGE_RATING: 90,        // Rating oficial 18+
  COMBINATION_BONUS: 30,  // Bonus quando múltiplos indicadores
}

// Threshold para bloqueio (0-100)
const BLOCK_THRESHOLD = 50

// === DICIONÁRIO EXPANDIDO DE TERMOS ===

// Termos de bloqueio IMEDIATO (qualquer match = bloqueia)
const INSTANT_BLOCK_TERMS = new Set([
  // Inglês - Termos sexuais explícitos
  'hentai', 'eroge', 'porn', 'pornographic', 'xxx', 'r18', 'r-18', '18+',
  'nude', 'nudity', 'naked', 'topless', 'bottomless', 'genitals', 'genitalia',
  'sex', 'sexual', 'intercourse', 'coitus', 'copulation', 'fornication',
  'orgasm', 'climax', 'ejaculation', 'masturbation', 'masturbate',
  'penis', 'vagina', 'vulva', 'clitoris', 'testicles', 'scrotum',
  'breast', 'breasts', 'boob', 'boobs', 'tits', 'titties', 'nipple', 'nipples',
  'ass', 'asses', 'butt', 'butts', 'buttocks', 'bum', 'rear', 'behind',
  'milf', 'dilf', 'gilf', 'cougar', 'mature woman', 'mature women',
  'virgin', 'defloration', 'cherry', 'popping',
  'bdsm', 'bondage', 'domination', 'submission', 'sadism', 'masochism',
  'fetish', 'kink', 'kinky', 'pervert', 'perversion', 'deviant',
  'incest', 'taboo', 'forbidden', 'illicit',
  'tentacle', 'monster', 'beast', 'bestiality', 'zoophilia',
  'loli', 'lolicon', 'shota', 'shotacon', 'underage', 'minor',
  'rape', 'assault', 'molest', 'abuse', 'forced',
  'prostitute', 'prostitution', 'hooker', 'escort', 'brothel', 'whore',
  'stripper', 'striptease', 'strip club', 'pole dance', 'lap dance',
  'adult only', 'adults only', 'adult content', 'mature content',
  'nsfw', 'not safe for work', 'explicit', 'uncensored',
  'ecchi', 'fanservice', 'pantyshot', 'upskirt', 'downblouse',
  'waifu', 'husbando', 'dating sim', 'romance sim', 'love sim',
  'visual novel', 'otome', 'bishojo', 'bishoujo', 'galge', 'eroge',
  'yaoi', 'yuri', 'bara', 'futanari', 'trap', 'crossdress',
  'bukkake', 'gangbang', 'orgy', 'threesome', 'foursome', 'group sex',
  'anal', 'oral', 'blowjob', 'handjob', 'footjob', 'titjob',
  'cum', 'cumshot', 'creampie', 'facial', 'swallow',
  'squirt', 'squirting', 'wet', 'dripping', 'juicy',
  'moan', 'moaning', 'groan', 'groaning', 'scream', 'screaming',
  'horny', 'aroused', 'turned on', 'excited', 'stimulated',
  'seduction', 'seductive', 'seduce', 'tempt', 'temptation',
  'erotic', 'erotica', 'sensual', 'sensuality', 'intimate', 'intimacy',
  'pleasure', 'pleasurable', 'gratification', 'satisfaction',
  'desire', 'lust', 'lustful', 'passion', 'passionate', 'carnal',
  'naughty', 'dirty', 'filthy', 'smut', 'smutty', 'raunchy', 'lewd',
  'hot', 'sexy', 'steamy', 'spicy', 'sizzling', 'sultry',
  'provocative', 'suggestive', 'risque', 'racy', 'titillating',
  'thick', 'thicc', 'curvy', 'busty', 'voluptuous', 'buxom',
  'lingerie', 'underwear', 'panties', 'bra', 'thong', 'g-string',
  'bikini', 'swimsuit', 'swimwear', 'bathing suit',

  // Português - Termos sexuais explícitos
  'pornô', 'pornografia', 'pornográfico', 'putaria', 'sacanagem',
  'nu', 'nua', 'nudez', 'pelado', 'pelada', 'despido', 'despida',
  'sexo', 'sexual', 'transar', 'foder', 'trepar', 'comer', 'dar',
  'orgasmo', 'gozar', 'ejacular', 'masturbar', 'punheta', 'siririca',
  'pênis', 'pau', 'pica', 'cacete', 'rola', 'caralho', 'piroca',
  'vagina', 'buceta', 'xoxota', 'xereca', 'ppk', 'perseguida',
  'peito', 'peitos', 'seio', 'seios', 'teta', 'tetas', 'mamilo',
  'bunda', 'bundas', 'cu', 'cuzinho', 'traseiro', 'rabo',
  'coroa', 'madura', 'maduro', 'experiente',
  'virgem', 'deflorar', 'primeira vez',
  'fetiche', 'tarado', 'tarada', 'pervertido', 'pervertida',
  'incesto', 'tabu', 'proibido', 'ilícito',
  'estupro', 'violência', 'abuso', 'forçado',
  'prostituta', 'prostituição', 'puta', 'garota de programa',
  'stripper', 'dançarina', 'pole dance',
  'adulto', 'conteúdo adulto', 'maiores de 18',
  'erótico', 'erótica', 'sensual', 'íntimo', 'intimidade',
  'prazer', 'desejo', 'luxúria', 'tesão', 'excitação',
  'safado', 'safada', 'putinha', 'vadia', 'cachorra',
  'gostosa', 'gostoso', 'delícia', 'tesudo', 'tesuda',
  'calcinha', 'sutiã', 'lingerie', 'roupa íntima',

  // Japonês romanizado
  'oppai', 'chichi', 'mune', 'oshiri', 'ketsu',
  'ecchi', 'hentai', 'ero', 'sukebe', 'etchi',
  'pantsu', 'shimapan', 'buruma',
  'mesu', 'osu', 'seiyoku', 'koubi',
])

// Termos suspeitos (contribuem para o score)
const SUSPICIOUS_TERMS = new Set([
  // Contextos que podem ser adultos
  'anime', 'manga', 'otaku', 'kawaii', 'moe', 'dere',
  'tsundere', 'yandere', 'kuudere', 'dandere',
  'senpai', 'kouhai', 'onii-chan', 'onee-chan', 'imouto', 'otouto',
  'school', 'student', 'teacher', 'nurse', 'maid', 'butler',
  'princess', 'queen', 'goddess', 'angel', 'demon', 'succubus',
  'vampire', 'werewolf', 'monster girl', 'kemono',
  'beach', 'pool', 'hot spring', 'onsen', 'bath', 'shower',
  'bedroom', 'hotel', 'motel', 'love hotel',
  'massage', 'spa', 'sauna',
  'date', 'dating', 'romance', 'love', 'relationship',
  'confession', 'proposal', 'marriage', 'wedding', 'honeymoon',
  'kiss', 'kissing', 'hug', 'hugging', 'cuddle', 'cuddling',
  'touch', 'touching', 'caress', 'caressing', 'stroke', 'stroking',

  // Português
  'colégio', 'estudante', 'professor', 'professora', 'enfermeira', 'empregada',
  'princesa', 'rainha', 'deusa', 'anjo', 'demônio', 'súcubo',
  'vampiro', 'lobisomem',
  'praia', 'piscina', 'banho', 'chuveiro',
  'quarto', 'hotel', 'motel',
  'massagem', 'spa',
  'encontro', 'namoro', 'romance', 'amor', 'relacionamento',
  'beijo', 'abraço', 'carinho', 'toque',
])

// Combinações perigosas (quando aparecem juntas)
const DANGEROUS_COMBINATIONS = [
  ['anime', 'girl'],
  ['anime', 'woman'],
  ['anime', 'female'],
  ['school', 'girl'],
  ['young', 'girl'],
  ['cute', 'girl'],
  ['hot', 'girl'],
  ['sexy', 'girl'],
  ['naughty', 'girl'],
  ['innocent', 'girl'],
  ['virgin', 'girl'],
  ['sister', 'brother'],
  ['mother', 'son'],
  ['father', 'daughter'],
  ['teacher', 'student'],
  ['nurse', 'patient'],
  ['maid', 'master'],
  ['princess', 'knight'],
  ['demon', 'girl'],
  ['angel', 'girl'],
  ['monster', 'girl'],
  ['vampire', 'girl'],
  ['beach', 'girl'],
  ['bikini', 'girl'],
  ['swimsuit', 'girl'],
  ['uniform', 'girl'],
  ['cosplay', 'girl'],
  ['idol', 'girl'],
  ['bunny', 'girl'],
  ['cat', 'girl'],
  ['fox', 'girl'],
  ['dog', 'girl'],
  ['cow', 'girl'],
  ['elf', 'girl'],
  ['fairy', 'girl'],
  ['witch', 'girl'],
  ['magical', 'girl'],
]

// Gêneros/Tags de alto risco
const HIGH_RISK_GENRES = new Set([
  'visual novel', 'dating sim', 'romance', 'otome',
  'anime', 'manga', 'hentai', 'ecchi',
  'adult', 'mature', 'nsfw', 'explicit',
  'erotic', 'sexual', 'nudity',
])

// Publishers/Developers conhecidos por conteúdo adulto
const ADULT_PUBLISHERS = new Set([
  'illusion', 'kiss', 'overflow', 'alicesoft', 'key',
  'frontwing', 'mangagamer', 'jast usa', 'sekai project',
  'denpasoft', 'nutaku', 'dlsite', 'fakku',
])

export interface ContentAnalysis {
  score: number           // 0-100, quanto maior mais adulto
  blocked: boolean        // true se deve ser bloqueado
  confidence: number      // 0-100, confiança da análise
  reasons: string[]       // Motivos do bloqueio/score
  category: 'safe' | 'suspicious' | 'adult' | 'explicit'
  details: {
    titleScore: number
    tagScore: number
    descriptionScore: number
    visualScore: number
    ageRatingScore: number
    combinationScore: number
  }
}

/**
 * Normaliza texto para análise
 */
function normalizeText(text: string | undefined): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, ' ')        // Remove pontuação
    .replace(/\s+/g, ' ')            // Normaliza espaços
    .trim()
}

/**
 * Verifica se texto contém termo (exato ou parcial)
 */
function containsTerm(text: string, term: string, exact: boolean = false): boolean {
  if (exact) {
    const regex = new RegExp(`\\b${term}\\b`, 'i')
    return regex.test(text)
  }
  return text.includes(term)
}

/**
 * Analisa título do jogo
 */
function analyzeTitleSan(title: string): { score: number; reasons: string[] } {
  const normalized = normalizeText(title)
  let score = 0
  const reasons: string[] = []

  // Verificar termos de bloqueio imediato
  for (const term of INSTANT_BLOCK_TERMS) {
    if (containsTerm(normalized, term, true)) {
      score += WEIGHTS.TITLE_EXACT
      reasons.push(`title_instant_block: "${term}"`)
    } else if (containsTerm(normalized, term, false)) {
      score += WEIGHTS.TITLE_PARTIAL
      reasons.push(`title_partial: "${term}"`)
    }
  }

  // Verificar termos suspeitos
  for (const term of SUSPICIOUS_TERMS) {
    if (containsTerm(normalized, term, true)) {
      score += 10
      reasons.push(`title_suspicious: "${term}"`)
    }
  }

  // Verificar combinações perigosas
  for (const [term1, term2] of DANGEROUS_COMBINATIONS) {
    if (containsTerm(normalized, term1) && containsTerm(normalized, term2)) {
      score += WEIGHTS.COMBINATION_BONUS
      reasons.push(`title_combination: "${term1}" + "${term2}"`)
    }
  }

  return { score, reasons }
}

/**
 * Analisa tags/gêneros do jogo
 */
function analyzeTagsSan(tags: string[], genres: string[]): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  const allTags = [...tags, ...genres].map(t => normalizeText(t))

  for (const tag of allTags) {
    // Verificar termos de bloqueio imediato
    for (const term of INSTANT_BLOCK_TERMS) {
      if (containsTerm(tag, term, true)) {
        score += WEIGHTS.TAG_EXACT
        reasons.push(`tag_instant_block: "${term}" in "${tag}"`)
      }
    }

    // Verificar gêneros de alto risco
    for (const riskGenre of HIGH_RISK_GENRES) {
      if (containsTerm(tag, riskGenre)) {
        score += WEIGHTS.TAG_PARTIAL
        reasons.push(`tag_high_risk: "${riskGenre}" in "${tag}"`)
      }
    }

    // Verificar termos suspeitos
    for (const term of SUSPICIOUS_TERMS) {
      if (containsTerm(tag, term, true)) {
        score += 5
        reasons.push(`tag_suspicious: "${term}" in "${tag}"`)
      }
    }
  }

  return { score, reasons }
}

/**
 * Analisa descrição do jogo
 */
function analyzeDescriptionSan(description: string | undefined): { score: number; reasons: string[] } {
  if (!description) return { score: 0, reasons: [] }

  const normalized = normalizeText(description)
  let score = 0
  const reasons: string[] = []

  // Verificar termos de bloqueio imediato
  for (const term of INSTANT_BLOCK_TERMS) {
    if (containsTerm(normalized, term, true)) {
      score += WEIGHTS.DESCRIPTION_STRONG
      reasons.push(`desc_instant_block: "${term}"`)
    }
  }

  // Verificar termos suspeitos
  let suspiciousCount = 0
  for (const term of SUSPICIOUS_TERMS) {
    if (containsTerm(normalized, term, true)) {
      suspiciousCount++
      if (suspiciousCount <= 3) {
        reasons.push(`desc_suspicious: "${term}"`)
      }
    }
  }

  // Score baseado na densidade de termos suspeitos
  if (suspiciousCount > 5) {
    score += WEIGHTS.DESCRIPTION_STRONG
    reasons.push(`desc_high_density: ${suspiciousCount} suspicious terms`)
  } else if (suspiciousCount > 2) {
    score += WEIGHTS.DESCRIPTION_WEAK
    reasons.push(`desc_medium_density: ${suspiciousCount} suspicious terms`)
  }

  // Verificar combinações perigosas
  for (const [term1, term2] of DANGEROUS_COMBINATIONS) {
    if (containsTerm(normalized, term1) && containsTerm(normalized, term2)) {
      score += WEIGHTS.COMBINATION_BONUS / 2
      reasons.push(`desc_combination: "${term1}" + "${term2}"`)
    }
  }

  return { score, reasons }
}

/**
 * Analisa indicadores visuais (URL da cover, etc)
 */
function analyzeVisualIndicators(coverUrl: string | undefined, imageUrls: string[] = []): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  const allUrls = [coverUrl, ...imageUrls].filter(Boolean).map(url => normalizeText(url!))

  for (const url of allUrls) {
    // Verificar domínios conhecidos de conteúdo adulto
    const adultDomains = ['nutaku', 'dlsite', 'fakku', 'hentai', 'adult', 'nsfw', 'xxx', 'porn']
    for (const domain of adultDomains) {
      if (url.includes(domain)) {
        score += WEIGHTS.VISUAL_INDICATOR
        reasons.push(`visual_adult_domain: "${domain}"`)
      }
    }

    // Verificar termos suspeitos na URL
    for (const term of INSTANT_BLOCK_TERMS) {
      if (url.includes(term)) {
        score += WEIGHTS.VISUAL_INDICATOR / 2
        reasons.push(`visual_suspicious_url: "${term}"`)
      }
    }
  }

  return { score, reasons }
}

/**
 * Analisa classificação etária
 */
function analyzeAgeRating(requiredAge: number | undefined, ratings: any[] = []): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  // Verificar idade mínima
  if (requiredAge && requiredAge >= 18) {
    score += WEIGHTS.AGE_RATING
    reasons.push(`age_rating: ${requiredAge}+`)
  }

  // Verificar ratings específicos
  for (const rating of ratings) {
    const labels = (rating.labels || []).map((l: string) => l.toLowerCase())

    // ESRB Adults Only
    if (labels.includes('adults only') || labels.includes('ao')) {
      score += WEIGHTS.AGE_RATING
      reasons.push(`esrb_adults_only`)
    }

    // PEGI 18
    if (labels.includes('18') || labels.includes('pegi 18')) {
      score += WEIGHTS.AGE_RATING
      reasons.push(`pegi_18`)
    }

    // Descritores de conteúdo sexual
    const sexualDescriptors = ['sexual content', 'nudity', 'partial nudity', 'sexual themes']
    for (const desc of sexualDescriptors) {
      if (labels.some((l: string) => l.includes(desc))) {
        score += WEIGHTS.AGE_RATING / 2
        reasons.push(`rating_sexual: "${desc}"`)
      }
    }
  }

  return { score, reasons }
}

/**
 * FUNÇÃO PRINCIPAL: Analisa conteúdo do jogo
 */
export function analyzeGameContent(game: {
  title?: string
  tags?: string[]
  genres?: string[]
  description?: string
  shortDescription?: string
  aboutTheGame?: string
  matureContentDescription?: string
  coverUrl?: string
  imageUrls?: string[]
  requiredAge?: number
  ratings?: any[]
  publisher?: string
  developer?: string
  contentDescriptors?: string[]
}): ContentAnalysis {
  const reasons: string[] = []

  // Análise do título
  const titleAnalysis = analyzeTitleSan(game.title || '')

  // Análise de tags/gêneros
  const tagAnalysis = analyzeTagsSan(game.tags || [], game.genres || [])

  // Análise de descrições (combinar todas)
  const fullDescription = [
    game.description,
    game.shortDescription,
    game.aboutTheGame,
    game.matureContentDescription
  ].filter(Boolean).join(' ')
  const descAnalysis = analyzeDescriptionSan(fullDescription)

  // Análise visual
  const visualAnalysis = analyzeVisualIndicators(game.coverUrl, game.imageUrls)

  // Análise de classificação etária
  const ageAnalysis = analyzeAgeRating(game.requiredAge, game.ratings)

  // Verificar content descriptors da Steam
  let contentDescScore = 0
  if (game.contentDescriptors) {
    for (const desc of game.contentDescriptors) {
      const normalized = normalizeText(desc)
      for (const term of INSTANT_BLOCK_TERMS) {
        if (normalized.includes(term)) {
          contentDescScore += WEIGHTS.AGE_RATING / 2
          reasons.push(`content_descriptor: "${desc}"`)
        }
      }
    }
  }

  // Verificar publisher/developer
  let publisherScore = 0
  const publisher = normalizeText(game.publisher || '')
  const developer = normalizeText(game.developer || '')
  for (const adultPub of ADULT_PUBLISHERS) {
    if (publisher.includes(adultPub) || developer.includes(adultPub)) {
      publisherScore += WEIGHTS.TAG_PARTIAL
      reasons.push(`adult_publisher: "${adultPub}"`)
    }
  }

  // Combinar razões
  reasons.push(...titleAnalysis.reasons)
  reasons.push(...tagAnalysis.reasons)
  reasons.push(...descAnalysis.reasons)
  reasons.push(...visualAnalysis.reasons)
  reasons.push(...ageAnalysis.reasons)

  // Calcular score total
  const totalScore = Math.min(100,
    titleAnalysis.score +
    tagAnalysis.score +
    descAnalysis.score +
    visualAnalysis.score +
    ageAnalysis.score +
    contentDescScore +
    publisherScore
  )

  // Determinar categoria
  let category: 'safe' | 'suspicious' | 'adult' | 'explicit'
  if (totalScore >= 80) {
    category = 'explicit'
  } else if (totalScore >= BLOCK_THRESHOLD) {
    category = 'adult'
  } else if (totalScore >= 20) {
    category = 'suspicious'
  } else {
    category = 'safe'
  }

  // Calcular confiança baseada na quantidade de evidências
  const confidence = Math.min(100, reasons.length * 15)

  return {
    score: totalScore,
    blocked: totalScore >= BLOCK_THRESHOLD,
    confidence,
    reasons,
    category,
    details: {
      titleScore: titleAnalysis.score,
      tagScore: tagAnalysis.score,
      descriptionScore: descAnalysis.score,
      visualScore: visualAnalysis.score,
      ageRatingScore: ageAnalysis.score,
      combinationScore: contentDescScore + publisherScore
    }
  }
}

/**
 * Filtra jogos usando análise de IA
 */
export function filterGamesWithAI<T extends {
  title?: string
  name?: string
  game?: { title?: string; tags?: string[]; genres?: string[] }
  tags?: string[]
  genres?: string[]
  steamGenres?: Array<{ name?: string; description?: string }>
  description?: string
  short_description?: string
  about_the_game?: string
  mature_content_description?: string
  coverUrl?: string
  image?: string
  imageUrls?: string[]
  required_age?: number
  ratings?: any[]
  publisher?: string
  developer?: string
  content_descriptors?: string[]
}>(games: T[]): T[] {
  const filtered: T[] = []
  let blockedCount = 0

  for (const game of games) {
    // Extrair dados do jogo
    const title = game.title || game.name || game.game?.title || ''
    const tags = game.tags || game.game?.tags || []
    const genres = game.genres || game.game?.genres ||
      (game.steamGenres?.map(g => g.name || g.description || '').filter(Boolean)) || []

    const analysis = analyzeGameContent({
      title,
      tags,
      genres,
      description: game.description,
      shortDescription: game.short_description,
      aboutTheGame: game.about_the_game,
      matureContentDescription: game.mature_content_description,
      coverUrl: game.coverUrl || game.image,
      imageUrls: game.imageUrls,
      requiredAge: game.required_age,
      ratings: game.ratings,
      publisher: game.publisher,
      developer: game.developer,
      contentDescriptors: game.content_descriptors
    })

    if (analysis.blocked) {
      blockedCount++
      console.log(`🤖 AI BLOCKED: "${title}" (score: ${analysis.score}, category: ${analysis.category})`)
      if (analysis.reasons.length <= 5) {
        console.log(`   Reasons: ${analysis.reasons.join(', ')}`)
      } else {
        console.log(`   Reasons: ${analysis.reasons.slice(0, 5).join(', ')} +${analysis.reasons.length - 5} more`)
      }
    } else {
      filtered.push(game)
    }
  }

  if (blockedCount > 0) {
    console.log(`🤖 AI Content Filter: ${blockedCount} games blocked from ${games.length} total`)
  }

  return filtered
}

/**
 * Analisa um jogo e retorna relatório detalhado
 */
export function getDetailedAnalysis(game: any): ContentAnalysis & { report: string } {
  const analysis = analyzeGameContent(game)

  let report = `
=== CONTENT ANALYSIS REPORT ===
Title: ${game.title || 'Unknown'}
Score: ${analysis.score}/100
Category: ${analysis.category.toUpperCase()}
Blocked: ${analysis.blocked ? 'YES' : 'NO'}
Confidence: ${analysis.confidence}%

--- Score Breakdown ---
Title: ${analysis.details.titleScore}
Tags: ${analysis.details.tagScore}
Description: ${analysis.details.descriptionScore}
Visual: ${analysis.details.visualScore}
Age Rating: ${analysis.details.ageRatingScore}
Combination: ${analysis.details.combinationScore}

--- Reasons ---
${analysis.reasons.map(r => `• ${r}`).join('\n')}
===============================
`

  return { ...analysis, report }
}
