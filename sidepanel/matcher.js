// Apply Copilot — match engine.
// Runs locally. No posting text leaves the browser.

export const SKILL_LEXICON = [
  // languages & core
  'python', 'javascript', 'typescript', 'php', 'go', 'golang', 'java', 'sql', 'bash',
  // frameworks
  'django', 'django rest framework', 'drf', 'fastapi', 'flask', 'laravel', 'celery',
  'node.js', 'express', 'react', 'next.js', 'vue',
  // genai
  'langchain', 'langgraph', 'llamaindex', 'rag', 'retrieval augmented generation',
  'openai', 'anthropic', 'claude', 'gpt-4', 'llm', 'prompt engineering', 'fine-tuning',
  'embeddings', 'vector database', 'pinecone', 'weaviate', 'chromadb', 'qdrant', 'faiss', 'pgvector',
  'agentic', 'ai agents', 'mcp', 'function calling', 'guardrails', 'evals', 'semantic search',
  'hugging face', 'transformers', 'pytorch', 'tensorflow',
  // cloud & infra
  'aws', 'bedrock', 'sagemaker', 'lambda', 's3', 'ec2', 'ecs', 'azure', 'gcp', 'vertex ai',
  'docker', 'kubernetes', 'terraform', 'ci/cd', 'jenkins', 'github actions',
  // data
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'kafka', 'rabbitmq', 'airflow',
  // practice
  'rest api', 'graphql', 'microservices', 'system design', 'unit testing', 'pytest',
  'git', 'agile', 'scrum', 'code review', 'mentoring', 'tech lead',
];

const ALIAS = {
  postgres: 'postgresql',
  golang: 'go',
  'retrieval augmented generation': 'rag',
  'ai agents': 'agentic',
  drf: 'django rest framework',
};

const norm = (s) => ALIAS[s] || s;

// Skills that are genuinely interchangeable in hiring. Holding one member
// means a posting asking for another shouldn't read as a gap.
const EQUIVALENTS = [
  ['vector database', 'pinecone', 'weaviate', 'chromadb', 'qdrant', 'faiss', 'pgvector'],
  ['openai', 'anthropic', 'claude', 'gpt-4', 'llm'],
  ['langchain', 'langgraph', 'llamaindex'],
  ['ci/cd', 'jenkins', 'github actions'],
  ['pytorch', 'tensorflow'],
  ['rabbitmq', 'kafka', 'celery'],
];

function coveredByEquivalent(term, mine) {
  const group = EQUIVALENTS.find((g) => g.includes(term));
  return !!group && group.some((alt) => alt !== term && mine.has(alt));
}

function present(haystack, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = /^[\w.+#-]+$/.test(term) ? `(?<![\\w-])${escaped}(?![\\w-])` : escaped;
  try {
    return new RegExp(boundary, 'i').test(haystack);
  } catch {
    return haystack.toLowerCase().includes(term);
  }
}

export function extractSkills(text) {
  const found = new Set();
  for (const term of SKILL_LEXICON) {
    if (present(text, term)) found.add(norm(term));
  }
  return [...found];
}

// Requirements that carry more weight when a posting frames them as mandatory.
function requiredTerms(text) {
  const req = new Set();
  const lines = text.split(/\n+/);
  let inRequired = false;
  for (const line of lines) {
    if (/must[- ]have|required skills|requirements|qualifications|you (should |must )?have/i.test(line)) inRequired = true;
    else if (/nice[- ]to[- ]have|good[- ]to[- ]have|bonus|preferred|plus/i.test(line)) inRequired = false;
    if (inRequired) extractSkills(line).forEach((s) => req.add(s));
  }
  return req;
}

export function yearsAsked(text) {
  const m = text.match(/(\d{1,2})\s*(?:\+|plus)?\s*(?:-|to|–)?\s*(\d{1,2})?\s*(?:\+)?\s*year/i);
  if (!m) return null;
  return { min: Number(m[1]), max: m[2] ? Number(m[2]) : null };
}

export function scoreJob(jobText, profile) {
  const text = jobText || '';
  const asked = extractSkills(text);
  const must = requiredTerms(text);
  const mine = new Set((profile.skills || []).map((s) => norm(s.toLowerCase().trim())).filter(Boolean));

  const matched = asked.filter((s) => mine.has(s));
  const covered = asked.filter((s) => !mine.has(s) && coveredByEquivalent(s, mine));
  const missing = asked.filter((s) => !mine.has(s) && !covered.includes(s));
  const criticalGaps = missing.filter((s) => must.has(s));

  const credit = matched.length + covered.length * 0.85;
  let score = asked.length ? Math.round((credit / asked.length) * 100) : 0;
  // A must-have gap costs more than a nice-to-have, but no single posting
  // should be scored to zero on gaps alone.
  score -= Math.min(15, criticalGaps.length * 4);

  const years = yearsAsked(text);
  const myYears = Number(profile.totalExperience) || 0;
  let yearsNote = null;
  if (years && myYears) {
    if (myYears < years.min - 1) {
      score -= 18;
      yearsNote = `Asks ${years.min}+ years, you have ${myYears}. Likely gated.`;
    } else if (myYears < years.min) {
      score -= 6;
      yearsNote = `Asks ${years.min}+ years, you have ${myYears}. Close enough to try.`;
    } else {
      yearsNote = `Asks ${years.min}${years.max ? `\u2013${years.max}` : '+'} years. You're in band.`;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 70 ? 'strong' : score >= 45 ? 'worth a shot' : 'weak';

  return { score, verdict, matched, covered, missing, criticalGaps, yearsNote, askedCount: asked.length };
}
