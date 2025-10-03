function toHttps(u?: string) {
  return u ? u.replace(/^http:\/\//, 'https://') : undefined;
}

function proxy(u: string, w = 640) {
  return `/thumb?url=${encodeURIComponent(u)}&w=${w}`;
}

/** Constrói array de imagens em ordem de prioridade */
export function pickImageUrls(s: any): string[] {
  const raw: (string | undefined)[] = [
    toHttps(s?.header_image),
    toHttps(s?.capsule_image),
    toHttps(s?.capsule_imagev5),
    toHttps(s?.background_raw),
    ...(Array.isArray(s?.screenshots) ? s.screenshots.map((x: any) => toHttps(x?.path_full)) : []),
    ...(Array.isArray(s?.movies) ? s.movies.map((m: any) => toHttps(m?.thumbnail)) : []),
  ].filter(Boolean) as string[];

  const unique = Array.from(new Set(raw)).filter(Boolean) as string[];
  return unique.map(u => proxy(u, 640));
}