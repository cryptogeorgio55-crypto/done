import { db } from "@/lib/db";

export interface KnowledgeHit {
  id: string;
  title: string;
  kind: string;
  snippet: string;
  source: string; // knowledge_document | business_policy
}

/**
 * Retrieve business knowledge relevant to a query. This is deliberately a naive
 * keyword scorer for now (no embeddings) — it combines connected documents with
 * the explicit Business Brain policies. The interface is what matters: swapping
 * in vector retrieval later doesn't change any caller.
 *
 * Crucially: if nothing relevant is found, callers must NOT invent an answer.
 */
export async function searchKnowledge(workspaceId: string, query: string, limit = 5): Promise<KnowledgeHit[]> {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const score = (text: string) => {
    const hay = text.toLowerCase();
    return terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
  };

  const [docs, policies] = await Promise.all([
    db.knowledgeDocument.findMany({ where: { workspaceId }, take: 100 }),
    db.businessPolicy.findMany({ where: { workspaceId }, take: 50 }),
  ]);

  const hits: (KnowledgeHit & { _score: number })[] = [];
  for (const d of docs) {
    const s = score(`${d.title} ${d.content}`);
    if (s > 0) hits.push({ id: d.id, title: d.title, kind: d.kind ?? "doc", snippet: d.content.slice(0, 240), source: "knowledge_document", _score: s });
  }
  for (const p of policies) {
    const s = score(`${p.kind} ${p.content}`);
    if (s > 0) hits.push({ id: p.id, title: `${p.kind} policy`, kind: p.kind, snippet: p.content.slice(0, 240), source: "business_policy", _score: s });
  }
  hits.sort((a, b) => b._score - a._score);
  return hits.slice(0, limit).map(({ _score, ...h }) => { void _score; return h; });
}
