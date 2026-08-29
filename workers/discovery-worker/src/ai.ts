import { BusinessCandidate, Enrichment, Env } from './types';

export async function enrichCandidate(candidate: BusinessCandidate, env: Env): Promise<Enrichment> {
  const categoryRows = await env.DB.prepare('SELECT slug, name FROM categories ORDER BY display_order, name')
    .all<{ slug: string; name: string }>();
  const categories = categoryRows.results ?? [];
  const prompt = `You enrich local business directory candidates. Use only the supplied evidence. Do not invent contact details, claims, hours, or ratings.

Candidate:
${JSON.stringify(candidate)}

Allowed directory categories:
${JSON.stringify(categories)}

Return JSON only with this exact shape:
{"categorySlug":"one allowed slug","description":"plain factual 40-180 word description","serviceArea":["city, ST"],"keywords":["keyword"],"confidence":0.0,"reasoning":"brief evidence-based explanation"}
Use a low confidence when evidence is thin. The description must say only what the evidence supports.`;

  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    prompt,
    max_tokens: 700,
  }) as { response?: string } | string;
  const parsed = parseJsonResponse(response);
  if (!isEnrichment(parsed)) {
    throw new Error('Workers AI returned an invalid enrichment response');
  }
  if (!categories.some((category) => category.slug === parsed.categorySlug)) {
    throw new Error('Workers AI selected an unknown category');
  }
  return {
    ...parsed,
    confidence: clamp(parsed.confidence),
    description: parsed.description.slice(0, 2000),
    serviceArea: parsed.serviceArea.slice(0, 20),
    keywords: parsed.keywords.slice(0, 20),
  };
}

function parseJsonResponse(response: { response?: string } | string): unknown {
  const text = typeof response === 'string' ? response : response.response ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Workers AI did not return JSON');
  return JSON.parse(match[0]);
}

function isEnrichment(value: unknown): value is Enrichment {
  if (!value || typeof value !== 'object') return false;
  const enrichment = value as Record<string, unknown>;
  return typeof enrichment.categorySlug === 'string' &&
    typeof enrichment.description === 'string' &&
    Array.isArray(enrichment.serviceArea) &&
    Array.isArray(enrichment.keywords) &&
    typeof enrichment.confidence === 'number' &&
    typeof enrichment.reasoning === 'string';
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
