interface ItemLike {
  title: string;
  description: string;
  category: string;
  location: string;
  color?: string | null;
  createdAt: Date;
}

const STOP = new Set([
  "a", "an", "the", "my", "is", "was", "near", "at", "in", "on", "of", "and", "with",
  "lost", "found", "black", "blue", "red", "white", "green", "grey", "gray", "silver",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export interface MatchScore {
  confidence: number; // 0..1
  rationale: string;
}

export function scoreMatch(lost: ItemLike, found: ItemLike): MatchScore {
  const reasons: string[] = [];
  let score = 0;

  if (lost.category === found.category) {
    score += 0.34;
    reasons.push(`same category (${lost.category.replace(/_/g, " ")})`);
  }

  const lt = new Set(tokens(`${lost.title} ${lost.description}`));
  const ft = new Set(tokens(`${found.title} ${found.description}`));
  const shared = [...lt].filter((t) => ft.has(t));
  if (lt.size && ft.size) {
    const overlap = shared.length / Math.min(lt.size, ft.size);
    score += overlap * 0.32;
    if (shared.length) reasons.push(`matching terms: ${shared.slice(0, 4).join(", ")}`);
  }

  const ll = tokens(lost.location);
  const fl = tokens(found.location);
  const locShared = ll.filter((t) => fl.includes(t));
  if (locShared.length) {
    score += 0.2;
    reasons.push(`nearby location (${locShared.join(", ")})`);
  }

  if (lost.color && found.color && lost.color.toLowerCase() === found.color.toLowerCase()) {
    score += 0.14;
    reasons.push(`same colour (${lost.color})`);
  }

  const days = Math.abs(lost.createdAt.getTime() - found.createdAt.getTime()) / 8.64e7;
  if (days <= 3) {
    score += 0.08;
    reasons.push("reported within 3 days");
  } else if (days > 14) {
    score -= 0.1;
  }

  const confidence = Math.max(0, Math.min(1, score));
  return {
    confidence: Math.round(confidence * 100) / 100,
    rationale: reasons.length ? reasons.join("; ") : "weak signal — manual review needed",
  };
}
