import { spawnSync } from 'node:child_process';

export interface MergeResult {
  merged: string;
  conflicts: number;
}

// ---- Diff types ----

type DiffOp =
  | { type: 'eq'; baseIdx: number }
  | { type: 'ins'; content: string }
  | { type: 'del'; baseIdx: number };

interface SideMap {
  deletedLines: Set<number>;
  insertsBefore: Map<number, string[]>; // base index → lines inserted before it
  insertsAtEnd: string[];
}

// ---- LCS-based line diff ----

/**
 * Compute a line-level diff from `base` to `modified` using LCS.
 * Returns a sequence of eq / ins / del operations.
 */
function diffLines(base: string[], modified: string[]): DiffOp[] {
  const m = base.length;
  const n = modified.length;

  // DP table for LCS lengths
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        base[i - 1] === modified[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Trace back
  const ops: DiffOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && base[i - 1] === modified[j - 1]) {
      ops.unshift({ type: 'eq', baseIdx: i - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'ins', content: modified[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'del', baseIdx: i - 1 });
      i--;
    }
  }

  return ops;
}

/**
 * Build a SideMap from a diff, tracking which base lines are deleted
 * and what new lines are inserted before each base line.
 */
function buildSideMap(ops: DiffOp[]): SideMap {
  const map: SideMap = {
    deletedLines: new Set(),
    insertsBefore: new Map(),
    insertsAtEnd: [],
  };

  const pending: string[] = [];

  for (const op of ops) {
    if (op.type === 'ins') {
      pending.push(op.content);
    } else if (op.type === 'del') {
      if (pending.length > 0) {
        const existing = map.insertsBefore.get(op.baseIdx) ?? [];
        map.insertsBefore.set(op.baseIdx, [...pending, ...existing]);
        pending.length = 0;
      }
      map.deletedLines.add(op.baseIdx);
    } else {
      // eq
      if (pending.length > 0) {
        const existing = map.insertsBefore.get(op.baseIdx) ?? [];
        map.insertsBefore.set(op.baseIdx, [...pending, ...existing]);
        pending.length = 0;
      }
    }
  }

  map.insertsAtEnd = [...pending];
  return map;
}

// ---- Three-way merge ----

/**
 * Three-way text merge at line granularity.
 *
 * - base:   last scaffold content applied to the file (merge base)
 * - ours:   user's current version of the file
 * - theirs: new scaffold version
 *
 * Rules:
 * - Only one side changed → take that change (no conflict)
 * - Both sides changed identically → take either (no conflict)
 * - Both sides changed differently → emit conflict markers
 *
 * Returns the merged text and the number of conflict regions.
 */
export function threeWayMerge(base: string, ours: string, theirs: string): MergeResult {
  const baseLines = base.split('\n');
  const oursLines = ours.split('\n');
  const theirsLines = theirs.split('\n');

  const oursDiff = diffLines(baseLines, oursLines);
  const theirsDiff = diffLines(baseLines, theirsLines);

  const oursMap = buildSideMap(oursDiff);
  const theirsMap = buildSideMap(theirsDiff);

  const result: string[] = [];
  let conflicts = 0;

  function emitConflict(oursChunk: string[], theirsChunk: string[]): void {
    conflicts++;
    result.push('<<<<<<< ours');
    result.push(...oursChunk);
    result.push('=======');
    result.push(...theirsChunk);
    result.push('>>>>>>> theirs (scaffold)');
  }

  function mergeInserts(oursIns: string[], theirsIns: string[]): void {
    if (oursIns.length === 0 && theirsIns.length === 0) return;
    if (oursIns.length === 0) {
      result.push(...theirsIns);
    } else if (theirsIns.length === 0) {
      result.push(...oursIns);
    } else if (oursIns.join('\n') === theirsIns.join('\n')) {
      result.push(...oursIns);
    } else {
      emitConflict(oursIns, theirsIns);
    }
  }

  for (let i = 0; i < baseLines.length; i++) {
    // Insertions before line i
    mergeInserts(oursMap.insertsBefore.get(i) ?? [], theirsMap.insertsBefore.get(i) ?? []);

    // The base line itself
    const oursDel = oursMap.deletedLines.has(i);
    const theirsDel = theirsMap.deletedLines.has(i);

    if (!oursDel && !theirsDel) {
      result.push(baseLines[i]);
    }
    // If either or both sides delete → omit (one-sided change takes effect, both-delete is clean)
  }

  // Trailing insertions after last base line
  mergeInserts(oursMap.insertsAtEnd, theirsMap.insertsAtEnd);

  return { merged: result.join('\n'), conflicts };
}

// ---- AI-assisted merge ----

/**
 * Invoke Claude with the three file versions to produce a merged result.
 * Returns the merged content, or null if Claude is unavailable or returns nothing.
 */
export function aiAssistMerge(
  base: string,
  ours: string,
  theirs: string,
  relPath: string,
): string | null {
  const prompt = [
    `You are performing a three-way text merge for a scaffold file update.`,
    `File: ${relPath}`,
    ``,
    `BASE (scaffold content when this file was last applied):`,
    `\`\`\``,
    base,
    `\`\`\``,
    ``,
    `OURS (current file with user customisations):`,
    `\`\`\``,
    ours,
    `\`\`\``,
    ``,
    `THEIRS (new scaffold version to apply):`,
    `\`\`\``,
    theirs,
    `\`\`\``,
    ``,
    `Produce a merged result that:`,
    `1. Preserves user customisations from OURS that do not conflict with structural changes in THEIRS`,
    `2. Applies all improvements from the new scaffold (THEIRS)`,
    `3. For genuine conflicts, prefer THEIRS for framework structure, OURS for project-specific content`,
    ``,
    `Output ONLY the merged file content. No explanation, no preamble, no code fences.`,
  ].join('\n');

  const res = spawnSync('claude', ['--print'], {
    input: prompt,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (res.error !== undefined || res.status !== 0) return null;

  const out = res.stdout?.trim() ?? '';
  return out.length > 0 ? out : null;
}
