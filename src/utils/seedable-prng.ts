/**
 * Utilitário de PRNG (Pseudo-Random Number Generator) com seed
 * Implementa o algoritmo mulberry32 que é adequado para embaralhamento determinístico
 */

export function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Função para embaralhar um array usando PRNG com seed
 * Algoritmo Fisher-Yates com PRNG determinístico
 */
export function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const result = [...array];
  const random = mulberry32(seed);
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

/**
 * Função para gerar seed baseada em string (usando cc, l e dayKey)
 */
export function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Converte para inteiro de 32 bits
  }
  return Math.abs(hash); // Retorna um valor positivo
}