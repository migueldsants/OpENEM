/**
 * oEmbed público do YouTube (issue #37): título e thumbnail sem API key.
 * Fetch com timeout curto e fallback silencioso — falha de rede não pode
 * impedir o usuário de salvar o vídeo.
 */
export interface OEmbedMetadata {
  title: string | null;
  thumbnail: string | null;
}

/** Extrai o ID do YouTube de qualquer formato de URL/ID. */
export function extractYouTubeId(raw: string): string | null {
  const input = raw.trim();
  // ID puro (11 chars).
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function fetchYouTubeMetadata(
  youtubeId: string,
): Promise<OEmbedMetadata> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${youtubeId}`,
  )}&format=json`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`oEmbed ${res.status}`);
    const json = (await res.json()) as {
      title?: string;
      thumbnail_url?: string;
    };
    return {
      title: json.title ?? null,
      thumbnail: json.thumbnail_url ?? null,
    };
  } catch {
    // Sem rede / vídeo privado / timeout: salva com o ID como título.
    return { title: null, thumbnail: null };
  }
}
