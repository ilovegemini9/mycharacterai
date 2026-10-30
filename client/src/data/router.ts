import type { Intent, KnowledgeRecord } from "./knowledge";
import { knowledge, searchKnowledge } from "./knowledge";
import { searchTools, type Tool } from "./vorqena";

export type RouteKind = "knowledge" | "tool" | "unknown";
export type RouteConfidence = "high" | "medium" | "low";

export type QuestionRoute = {
  kind: RouteKind;
  intent?: Intent;
  knowledge?: KnowledgeRecord;
  tool?: Tool;
  confidence: RouteConfidence;
};

const intentHints: Record<Intent, string[]> = {
  fix: ["fix", "broken", "not working", "wont", "doesnt", "noise", "problem", "repair", "charge", "drain", "heat"],
  calculate: ["calculate", "how much is", "percent", "percentage", "loan", "mortgage", "age", "total", "average", "discount", "tip"],
  decide: ["can i", "should i", "is it safe", "worth it", "repair or replace", "freeze", "rent or buy"],
  when: ["when", "how long", "how many days", "date", "deadline", "days between", "replace", "change"],
  cost: ["cost", "price", "how much does", "fuel", "electricity", "repair cost", "moving cost"],
};

const genericSearchTerms = new Set(["search", "tool", "tools", "calculator", "calculators", "calculate"]);

function normalize(value: string) {
  return value.toLowerCase().replace(/[’']/g, " ").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function inferIntent(query: string): Intent | undefined {
  const value = normalize(query);
  const scored = (Object.entries(intentHints) as [Intent, string[]][]).map(([intent, hints]) => ({
    intent,
    score: hints.reduce((total, hint) => total + (value.includes(hint) ? (hint.includes(" ") ? 3 : 1) : 0), 0),
  })).sort((a, b) => b.score - a.score);
  if (!scored[0] || scored[0].score === 0) return undefined;
  return scored[0].score > (scored[1]?.score ?? 0) ? scored[0].intent : undefined;
}

export function routeQuestion(query: string): QuestionRoute {
  const value = normalize(query);
  if (!value) return { kind: "unknown", confidence: "low" };
  if (genericSearchTerms.has(value)) {
    return { kind: "unknown", intent: value === "calculate" || value.includes("calculator") ? "calculate" : undefined, confidence: "low" };
  }

  const percentOfValue = /\b\d+(?:\.\d+)?\s*(?:percent|per cent|%)\s+of\s+\d+(?:\.\d+)?\b/.test(value);
  if (percentOfValue) {
    const percentageRecord = knowledge.find(item => item.slug.replace(/^\//, "") === "calculate/percentage");
    if (percentageRecord) return { kind: "knowledge", intent: percentageRecord.intent, knowledge: percentageRecord, confidence: "high" };
  }

  const knowledgeMatches = searchKnowledge(value);
  const top = knowledgeMatches[0];
  const second = knowledgeMatches[1];
  if (top) {
    const exact = normalize(top.title) === value || top.aliases.some(alias => normalize(alias) === value);
    if (exact) return { kind: "knowledge", intent: top.intent, knowledge: top, confidence: "high" };

    const topScore = scoreKnowledgeMatch(value, top);
    const secondScore = second ? scoreKnowledgeMatch(value, second) : 0;
    const margin = topScore - secondScore;
    if (topScore >= 90 && margin >= 20) return { kind: "knowledge", intent: top.intent, knowledge: top, confidence: "high" };
    if (topScore >= 55 && margin >= 12) return { kind: "knowledge", intent: top.intent, knowledge: top, confidence: "medium" };
  }

  const tools = searchTools(value);
  const tool = tools[0];
  if (tool && (!top || top.intent === tool.intent)) {
    return { kind: "tool", intent: tool.intent, tool, confidence: "medium" };
  }

  return { kind: "unknown", intent: inferIntent(value), confidence: "low" };
}

function scoreKnowledgeMatch(query: string, item: KnowledgeRecord) {
  const normalized = normalize(query);
  const phrases = [normalize(item.title), ...item.aliases.map(normalize)];
  const queryTokens = normalized.split(" ").filter(Boolean);
  let score = 0;
  if (phrases.some(phrase => phrase.includes(normalized) || normalized.includes(phrase))) score += 85;
  for (const token of queryTokens) {
    if (phrases.some(phrase => phrase.split(" ").includes(token))) score += 20;
  }
  return score;
}

export function canonicalTopics() {
  return knowledge.filter(item => item.seo.indexable);
}
