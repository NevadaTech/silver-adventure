import { createHash } from 'crypto'
import type { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'

/**
 * Converts a string to a URL-friendly slug using lowercase and dashes.
 * NOTE: This is distinct from the `slug()` function in HeuristicClusterer
 * which uses UPPERCASE with underscores. Do NOT reuse or modify that one.
 */
export function slugLower(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

/**
 * Builds a deterministic ecosystem cluster ID from a sorted set of CIIUs
 * and a municipio name.
 * Format: eco-{sha1(sortedCiius.join('-')).slice(0,8)}-{slugLower(municipio)}
 */
export function buildEcosystemClusterId(
  ciius: string[],
  municipio: string,
): string {
  const sorted = ciius.slice().sort()
  const joined = sorted.join('-')
  const hash8 = createHash('sha1').update(joined).digest('hex').slice(0, 8)
  return `eco-${hash8}-${slugLower(municipio)}`
}

/**
 * Splits a community that exceeds MAX_SIZE into sub-communities of at most
 * MAX_SIZE nodes each. Nodes are sorted alphabetically before splitting
 * for determinism.
 */
export function splitIfTooLarge(
  community: string[],
  maxSize: number,
): string[][] {
  if (community.length <= maxSize) return [community]
  const sorted = community.slice().sort()
  const result: string[][] = []
  for (let i = 0; i < sorted.length; i += maxSize) {
    result.push(sorted.slice(i, i + maxSize))
  }
  return result
}

/**
 * Label Propagation algorithm for community detection on a CIIU graph.
 * Processes nodes in deterministic alphabetical order.
 * Tie-breaking on most frequent label is resolved alphabetically (ASC).
 *
 * @param edges    Graph edges. Wildcards ('*') must be excluded before calling.
 * @param maxIterations  Maximum iterations before stopping (default 20).
 * @returns Array of communities, each being an array of CIIU codes.
 */
export function labelPropagation(
  edges: CiiuEdge[],
  maxIterations: number,
): string[][] {
  if (edges.length === 0) return []

  // Build adjacency map (undirected — each edge is treated bidirectionally)
  const adjacency = new Map<string, Set<string>>()

  for (const e of edges) {
    if (!adjacency.has(e.ciiuOrigen)) adjacency.set(e.ciiuOrigen, new Set())
    if (!adjacency.has(e.ciiuDestino)) adjacency.set(e.ciiuDestino, new Set())
    adjacency.get(e.ciiuOrigen)!.add(e.ciiuDestino)
    adjacency.get(e.ciiuDestino)!.add(e.ciiuOrigen)
  }

  // All nodes, sorted alphabetically for deterministic processing
  const sortedNodes = Array.from(adjacency.keys()).sort()

  // Initialize: each node is its own label
  const labels = new Map<string, string>()
  for (const node of sortedNodes) {
    labels.set(node, node)
  }

  // Iterate
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false

    for (const node of sortedNodes) {
      const neighbors = adjacency.get(node)!
      if (neighbors.size === 0) continue

      // Count frequencies of neighbor labels
      const counts = new Map<string, number>()
      for (const neighbor of neighbors) {
        const label = labels.get(neighbor)!
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }

      // Pick label with highest frequency; tie-break by alphabetical order ASC
      let bestLabel: string | null = null
      let bestCount = -1
      for (const [label, count] of counts) {
        if (
          count > bestCount ||
          (count === bestCount && bestLabel !== null && label < bestLabel)
        ) {
          bestLabel = label
          bestCount = count
        }
      }

      if (bestLabel !== null && bestLabel !== labels.get(node)) {
        labels.set(node, bestLabel)
        changed = true
      }
    }

    if (!changed) break
  }

  // Group nodes by their final label
  const byLabel = new Map<string, string[]>()
  for (const node of sortedNodes) {
    const label = labels.get(node)!
    if (!byLabel.has(label)) byLabel.set(label, [])
    byLabel.get(label)!.push(node)
  }

  return Array.from(byLabel.values())
}
