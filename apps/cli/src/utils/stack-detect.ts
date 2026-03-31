import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { logger } from './logger.js';
import { AGENT_MAP } from './agent-map.js';
import { collectWorkspaceSignals, formatSignalsForPrompt } from './workspace-signals.js';
import type { WorkspaceSignals } from './workspace-signals.js';

export interface DetectedStack {
  language: string;
  frameworks: string[];
}

export interface AgentProposal {
  agentName: string;
  agentTitle: string;
  stack: string;
  reason?: string;
  confidence?: 'high' | 'medium' | 'low';
}

/** Structured response from AI workspace analysis */
export interface AIAnalysisResult {
  domains: string[];
  agents: Array<{
    name: string;
    title: string;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  summary: string;
}

/** Combined result from workspace analysis (AI + heuristic) */
export interface WorkspaceAnalysisResult {
  stacks: DetectedStack[];
  aiAnalysis: AIAnalysisResult | null;
  proposals: AgentProposal[];
  method: 'ai' | 'heuristic';
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isPackageJson(val: unknown): val is PackageJson {
  // PackageJson has only optional fields; any non-null object satisfies its structure
  return typeof val === 'object' && val !== null;
}

function readFileSafe(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function detectLanguages(cwd: string): string[] {
  const languages: string[] = [];

  const langManifests: Array<[string, string]> = [
    ['package.json', 'nodejs'],
    ['requirements.txt', 'python'],
    ['pyproject.toml', 'python'],
    ['Pipfile', 'python'],
    ['pom.xml', 'java'],
    ['build.gradle', 'java'],
    ['build.gradle.kts', 'java'],
    ['go.mod', 'go'],
    ['Cargo.toml', 'rust'],
    ['Gemfile', 'ruby'],
    ['composer.json', 'php'],
    ['pubspec.yaml', 'dart'],
    ['Package.swift', 'swift'],
  ];

  for (const [manifest, lang] of langManifests) {
    if (existsSync(resolve(cwd, manifest)) && !languages.includes(lang)) {
      languages.push(lang);
    }
  }

  if (existsSync(resolve(cwd, 'tsconfig.json')) && languages.includes('nodejs')) {
    if (!languages.includes('typescript')) {
      languages.push('typescript');
    }
  }

  try {
    const entries = readdirSync(cwd, { withFileTypes: true });
    const hasCsproj = entries.some((e) => e.isFile() && e.name.endsWith('.csproj'));
    if (hasCsproj && !languages.includes('csharp')) {
      languages.push('csharp');
    }
  } catch {
    // ignore
  }

  return languages;
}

function detectNodeFrameworks(cwd: string): string[] {
  const pkgPath = resolve(cwd, 'package.json');
  if (!existsSync(pkgPath)) return [];

  const content = readFileSafe(pkgPath);
  if (content === '') return [];

  let pkg: PackageJson | undefined;
  try {
    const parsedPkg: unknown = JSON.parse(content);
    if (isPackageJson(parsedPkg)) pkg = parsedPkg;
  } catch {
    return [];
  }
  if (pkg === undefined) return [];

  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const frameworks: string[] = [];

  const depMap: Array<[string, string]> = [
    ['next', 'nextjs'],
    ['nuxt', 'nuxt'],
    ['@angular/core', 'angular'],
    ['vue', 'vue'],
    ['svelte', 'svelte'],
    ['react', 'react'],
    ['@nestjs/core', 'nestjs'],
    ['fastify', 'fastify'],
    ['express', 'express'],
    ['electron', 'electron'],
    ['@tauri-apps/api', 'tauri'],
  ];

  for (const [dep, framework] of depMap) {
    if (dep in allDeps) {
      frameworks.push(framework);
    }
  }

  // Conflict resolution: meta-frameworks take priority over their base frameworks
  const metaOverrides: Record<string, string> = {
    nextjs: 'react',
    nuxt: 'vue',
    sveltekit: 'svelte',
  };
  for (const [meta, base] of Object.entries(metaOverrides)) {
    if (frameworks.includes(meta) && frameworks.includes(base)) {
      frameworks.splice(frameworks.indexOf(base), 1);
    }
  }

  return frameworks;
}

function detectPythonFrameworks(cwd: string): string[] {
  const frameworks: string[] = [];
  const files = ['requirements.txt', 'pyproject.toml', 'Pipfile'];

  for (const file of files) {
    const content = readFileSafe(resolve(cwd, file));
    if (content === '') continue;

    const lower = content.toLowerCase();
    if (/\bdjango\b/.test(lower) && !frameworks.includes('django')) frameworks.push('django');
    if (/\bfastapi\b/.test(lower) && !frameworks.includes('fastapi')) frameworks.push('fastapi');
    if (/\bflask\b/.test(lower) && !frameworks.includes('flask')) frameworks.push('flask');
    if ((/\btorch\b/.test(lower) || /\bpytorch\b/.test(lower)) && !frameworks.includes('pytorch')) frameworks.push('pytorch');
    if (/\btensorflow\b/.test(lower) && !frameworks.includes('tensorflow')) frameworks.push('tensorflow');
  }

  return frameworks;
}

function detectGoFrameworks(cwd: string): string[] {
  const content = readFileSafe(resolve(cwd, 'go.mod'));
  if (content === '') return [];

  const frameworks: string[] = [];
  if (content.includes('gin-gonic/gin')) frameworks.push('gin');
  if (content.includes('gofiber/fiber')) frameworks.push('fiber');
  return frameworks;
}

function detectRustFrameworks(cwd: string): string[] {
  const content = readFileSafe(resolve(cwd, 'Cargo.toml'));
  if (content === '') return [];

  const frameworks: string[] = [];
  if (content.includes('actix-web')) frameworks.push('actix');
  if (/\brocket\b/.test(content)) frameworks.push('rocket');
  if (/\btauri\b/.test(content)) frameworks.push('tauri-rust');
  return frameworks;
}

function detectRubyFrameworks(cwd: string): string[] {
  const content = readFileSafe(resolve(cwd, 'Gemfile'));
  if (content === '') return [];

  const frameworks: string[] = [];
  if (/gem\s+['"]rails['"]/.test(content)) frameworks.push('rails');
  if (/gem\s+['"]sinatra['"]/.test(content)) frameworks.push('sinatra');
  return frameworks;
}

function detectPhpFrameworks(cwd: string): string[] {
  const content = readFileSafe(resolve(cwd, 'composer.json'));
  if (content === '') return [];

  const frameworks: string[] = [];
  if (content.includes('laravel/framework')) frameworks.push('laravel');
  if (content.includes('symfony/framework-bundle')) frameworks.push('symfony');
  return frameworks;
}

function detectDartFrameworks(cwd: string): string[] {
  const content = readFileSafe(resolve(cwd, 'pubspec.yaml'));
  if (content === '') return [];

  return content.includes('flutter') ? ['flutter'] : [];
}

/**
 * Detects the tech stack of a project by scanning manifest files.
 */
export function detectStack(cwd: string): DetectedStack[] {
  const languages = detectLanguages(cwd);
  const stacks: DetectedStack[] = [];

  for (const lang of languages) {
    let frameworks: string[] = [];

    switch (lang) {
      case 'nodejs':
      case 'typescript':
        frameworks = detectNodeFrameworks(cwd);
        break;
      case 'python':
        frameworks = detectPythonFrameworks(cwd);
        break;
      case 'go':
        frameworks = detectGoFrameworks(cwd);
        break;
      case 'rust':
        frameworks = detectRustFrameworks(cwd);
        break;
      case 'ruby':
        frameworks = detectRubyFrameworks(cwd);
        break;
      case 'php':
        frameworks = detectPhpFrameworks(cwd);
        break;
      case 'dart':
        frameworks = detectDartFrameworks(cwd);
        break;
      default:
        break;
    }

    stacks.push({ language: lang, frameworks });
  }

  // Deduplicate: if nodejs and typescript both detected, keep typescript with merged frameworks
  const tsIndex = stacks.findIndex((s) => s.language === 'typescript');
  const nodeIndex = stacks.findIndex((s) => s.language === 'nodejs');
  if (tsIndex !== -1 && nodeIndex !== -1) {
    stacks[tsIndex].frameworks = stacks[nodeIndex].frameworks;
    stacks.splice(nodeIndex, 1);
  }

  return stacks;
}

/**
 * Maps detected stacks to agent proposals using heuristic matching.
 */
export function proposeAgents(stacks: DetectedStack[]): AgentProposal[] {
  const proposals: AgentProposal[] = [];
  const seen = new Set<string>();

  for (const stack of stacks) {
    // typescript stacks use nodejs AGENT_MAP entries (frameworks are shared)
    const lookupLangs = stack.language === 'typescript' ? ['typescript', 'nodejs'] : [stack.language];

    if (stack.frameworks.length > 0) {
      for (const fw of stack.frameworks) {
        const match = AGENT_MAP.find(
          (m) => lookupLangs.includes(m.language) && m.framework === fw
        );
        if (match !== undefined && !seen.has(match.agentName)) {
          seen.add(match.agentName);
          proposals.push({
            agentName: match.agentName,
            agentTitle: match.agentTitle,
            stack: `${stack.language} + ${fw}`,
          });
        }
      }
    } else {
      const match = AGENT_MAP.find(
        (m) => lookupLangs.includes(m.language) && m.framework === null
      );
      if (match !== undefined && !seen.has(match.agentName)) {
        seen.add(match.agentName);
        proposals.push({
          agentName: match.agentName,
          agentTitle: match.agentTitle,
          stack: stack.language,
        });
      }
    }
  }

  return proposals;
}

/**
 * Propose agents from presence markers detected by workspace signals.
 * Handles cross-language domains like design, data science, infrastructure.
 */
export function proposeAgentsFromMarkers(markers: string[]): AgentProposal[] {
  const proposals: AgentProposal[] = [];
  const seen = new Set<string>();

  const markerToAgent: Array<{ prefix: string; language: string; framework: string | null; stack: string }> = [
    { prefix: 'design:', language: '_design', framework: null, stack: 'design' },
    { prefix: 'data-science:', language: '_data-science', framework: null, stack: 'data-science' },
    { prefix: 'infrastructure:terraform', language: '_infrastructure', framework: 'terraform', stack: 'infrastructure + terraform' },
    { prefix: 'infrastructure:kubernetes', language: '_infrastructure', framework: 'kubernetes', stack: 'infrastructure + kubernetes' },
    { prefix: 'infrastructure:docker', language: '_infrastructure', framework: 'docker', stack: 'infrastructure + docker' },
    { prefix: 'infrastructure:github-actions', language: '_infrastructure', framework: null, stack: 'infrastructure + github-actions' },
  ];

  for (const rule of markerToAgent) {
    if (markers.some((m) => m.startsWith(rule.prefix))) {
      const match = AGENT_MAP.find(
        (m) => m.language === rule.language && m.framework === rule.framework
      );
      if (match !== undefined && !seen.has(match.agentName)) {
        seen.add(match.agentName);
        proposals.push({
          agentName: match.agentName,
          agentTitle: match.agentTitle,
          stack: rule.stack,
        });
      }
    }
  }

  return proposals;
}

const AI_ANALYSIS_PROMPT = `You are analyzing a software workspace to determine what development domains are present and what specialized developer agents would be helpful.

Analyze the workspace signals below and return a JSON object with this exact structure:
{
  "domains": ["frontend", "backend", "design", "infrastructure", "data-science", ...],
  "agents": [
    {
      "name": "agent-name-kebab-case",
      "title": "Human Readable Title",
      "reason": "Brief explanation of why this agent is needed",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "summary": "One-sentence summary of the workspace"
}

Rules:
- Only propose agents you are confident about based on the evidence
- Use kebab-case for agent names (e.g., "react-developer", "terraform-developer")
- "high" confidence: clear manifest/config evidence
- "medium" confidence: file patterns suggest it but no definitive config
- "low" confidence: possible but uncertain
- Keep the agent list focused — don't propose agents for every possible tool
- Return ONLY the JSON object, no markdown fences, no explanation

Here are the workspace signals:

`;

/**
 * Parse the AI analysis response, validating the expected structure.
 * Returns null if parsing fails.
 */
/** Allowlist for AI-returned agent names: prevents path traversal and shell injection */
const AGENT_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_TITLE_LEN = 100;
const MAX_REASON_LEN = 500;
const MAX_SUMMARY_LEN = 300;

function parseAIAnalysisResponse(responseText: string): AIAnalysisResult | null {
  // Strip markdown code fences if present
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;

  // Validate domains
  const rawDomains = parsed['domains'];
  if (!Array.isArray(rawDomains)) return null;
  const domains = rawDomains.filter((d): d is string => typeof d === 'string');

  // Validate agents
  const rawAgents = parsed['agents'];
  if (!Array.isArray(rawAgents)) return null;
  const agents: AIAnalysisResult['agents'] = [];
  for (const agentEntry of rawAgents) {
    if (!isRecord(agentEntry)) continue;
    if (typeof agentEntry['name'] !== 'string' || typeof agentEntry['title'] !== 'string') continue;
    // Validate name against allowlist — prevents path traversal via AI-returned agent name (HIGH-1)
    if (!AGENT_NAME_RE.test(agentEntry['name'])) continue;
    const name = agentEntry['name'];
    const title = agentEntry['title'].slice(0, MAX_TITLE_LEN);
    // Narrow confidence via equality checks — avoids `as` assertion
    const rawConf = agentEntry['confidence'];
    const confidence: 'high' | 'medium' | 'low' =
      rawConf === 'high' || rawConf === 'medium' || rawConf === 'low' ? rawConf : 'medium';
    const rawReason = agentEntry['reason'];
    const reason = typeof rawReason === 'string' ? rawReason.slice(0, MAX_REASON_LEN) : '';
    agents.push({ name, title, reason, confidence });
  }

  // Validate summary
  const rawSummary = parsed['summary'];
  const summary = typeof rawSummary === 'string' ? rawSummary.slice(0, MAX_SUMMARY_LEN) : '';

  return { domains, agents, summary };
}

/**
 * Run AI-assisted workspace analysis using Claude CLI.
 * Returns the structured analysis result, or null if the AI call fails.
 */
export function runAIAnalysis(signals: WorkspaceSignals): AIAnalysisResult | null {
  const promptContent = AI_ANALYSIS_PROMPT + formatSignalsForPrompt(signals);

  const result = spawnSync('claude', ['-p', promptContent, '--output-format', 'text'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
    maxBuffer: 1024 * 1024,
  });

  if (result.status !== 0 || result.signal !== null) {
    const stderr = result.stderr?.toString().trim() ?? '';
    if (stderr !== '') {
      logger.error(`  AI analysis failed: ${stderr.slice(0, 200)}`);
    }
    return null;
  }

  const stdout = result.stdout?.toString().trim() ?? '';
  if (stdout === '') return null;

  return parseAIAnalysisResponse(stdout);
}

/**
 * Convert AI analysis agent proposals into AgentProposal format.
 * Enriches proposals with AI reasoning and confidence.
 */
function aiAgentsToProposals(aiAgents: AIAnalysisResult['agents']): AgentProposal[] {
  return aiAgents.map((a) => ({
    agentName: a.name,
    agentTitle: a.title,
    stack: 'ai-detected',
    reason: a.reason,
    confidence: a.confidence,
  }));
}

/**
 * Merge heuristic and AI proposals, deduplicating by agent name.
 * AI proposals add reasoning but don't override heuristic matches.
 */
function mergeProposals(heuristic: AgentProposal[], ai: AgentProposal[]): AgentProposal[] {
  const merged = [...heuristic];
  const seen = new Set(heuristic.map((p) => p.agentName));

  for (const aiProposal of ai) {
    if (!seen.has(aiProposal.agentName)) {
      seen.add(aiProposal.agentName);
      merged.push(aiProposal);
    } else {
      // Enrich existing proposal with AI reasoning
      const existing = merged.find((p) => p.agentName === aiProposal.agentName);
      if (existing !== undefined && aiProposal.reason !== undefined && aiProposal.reason !== '') {
        existing.reason = aiProposal.reason;
        existing.confidence = aiProposal.confidence;
      }
    }
  }

  return merged;
}

/**
 * Full workspace analysis: collects signals, runs AI analysis (if available),
 * falls back to heuristic detection.
 *
 * @param cwd - workspace root directory
 * @param claudeAvailable - whether Claude CLI is available
 * @returns Combined analysis result with method indicator
 */
export function analyzeWorkspace(cwd: string, claudeAvailable: boolean): WorkspaceAnalysisResult {
  // Step 1: Always run heuristic detection (fast)
  const stacks = detectStack(cwd);
  const heuristicProposals = proposeAgents(stacks);

  // Step 2: Collect workspace signals for marker-based and AI analysis
  const signals = collectWorkspaceSignals(cwd);
  const markerProposals = proposeAgentsFromMarkers(signals.presenceMarkers);

  // Step 3: Try AI analysis if Claude is available
  let aiAnalysis: AIAnalysisResult | null = null;
  if (claudeAvailable) {
    aiAnalysis = runAIAnalysis(signals);
  }

  if (aiAnalysis !== null) {
    // Merge: heuristic + marker + AI proposals
    const aiProposals = aiAgentsToProposals(aiAnalysis.agents);
    const allProposals = mergeProposals(
      mergeProposals(heuristicProposals, markerProposals),
      aiProposals
    );
    return { stacks, aiAnalysis, proposals: allProposals, method: 'ai' };
  }

  // Fallback: heuristic + marker proposals only
  const fallbackProposals = mergeProposals(heuristicProposals, markerProposals);
  return { stacks, aiAnalysis: null, proposals: fallbackProposals, method: 'heuristic' };
}
