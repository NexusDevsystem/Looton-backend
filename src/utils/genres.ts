// utils/genres.ts
export function normalize(s: string) {
  return s
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().trim();
}

// alias PT-BR → slugs canônicos (ajuste conforme seu catálogo)
const GENRE_ALIASES: Record<string,string> = {
  corrida: 'racing', corridas: 'racing', race: 'racing', racing: 'racing',
  acao: 'action', ação: 'action', action: 'action',
  rpg: 'rpg',
  estrategia: 'strategy', estratégia: 'strategy', strategy: 'strategy',
  esportes: 'sports', esporte: 'sports', sports: 'sports',
  simulacao: 'simulation', simulação: 'simulation', simulation: 'simulation',
  aventura: 'adventure', adventure: 'adventure',
  indie: 'indie',
  tiro: 'shooter', shooter: 'shooter',
  plataforma: 'platformer', platformer: 'platformer',
  puzzle: 'puzzle', quebracabeca: 'puzzle', 'quebra-cabeça': 'puzzle',
  horror: 'horror', terror: 'horror',
  sobrevivencia: 'survival', sobrevivência: 'survival', survival: 'survival',
  mmo: 'mmo', mmorpg: 'mmorpg',
  casual: 'casual',
  educativo: 'educational', educational: 'educational'
};

export function toCanonicalGenre(s: string) {
  const n = normalize(s);
  return GENRE_ALIASES[n] ?? n; // se não tiver alias, usa normalizado
}

export function matchesGenres(gameGenres: string[], wanted: string[]) {
  const gGame = gameGenres.map(normalize);
  const gWanted = wanted.map(toCanonicalGenre);
  // "qualquer um" (interseção não-vazia). Se quiser "todas", troque lógica.
  return gWanted.some(g => gGame.includes(g));
}