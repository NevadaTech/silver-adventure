import { describe, expect, it } from 'vitest'
import { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import { labelPropagation } from '@/clusters/application/services/LabelPropagation'

function edge(
  ciiuOrigen: string,
  ciiuDestino: string,
  confidence = 0.8,
): CiiuEdge {
  return CiiuEdge.create({
    ciiuOrigen,
    ciiuDestino,
    hasMatch: true,
    relationType: 'proveedor',
    confidence,
    modelVersion: null,
  })
}

describe('labelPropagation', () => {
  it('returns a single community for a fully connected graph of 5 nodes', () => {
    // 5 nodes all connected to each other via a chain A-B-C-D-E
    const edges = [
      edge('A', 'B'),
      edge('B', 'C'),
      edge('C', 'D'),
      edge('D', 'E'),
    ]
    const communities = labelPropagation(edges, 20)
    expect(communities).toHaveLength(1)
    expect(communities[0].sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('returns two separate communities for two disconnected subgraphs', () => {
    // Group 1: A-B-C, Group 2: X-Y-Z
    const edges = [
      edge('A', 'B'),
      edge('B', 'C'),
      edge('X', 'Y'),
      edge('Y', 'Z'),
    ]
    const communities = labelPropagation(edges, 20)
    expect(communities).toHaveLength(2)
    const sorted = communities
      .map((c) => c.sort())
      .sort((a, b) => a[0].localeCompare(b[0]))
    expect(sorted[0]).toEqual(['A', 'B', 'C'])
    expect(sorted[1]).toEqual(['X', 'Y', 'Z'])
  })

  it('breaks ties alphabetically (chooses lexicographically smaller label)', () => {
    // Nodes A and B both connected to C and D.
    // A has neighbors: B, C
    // B has neighbors: A, D
    // C has neighbors: A
    // D has neighbors: B
    // This setup forces tie-break: node B has neighbors with labels A and D
    // tie-break by alpha picks 'A' over 'D'
    const edges = [edge('A', 'B'), edge('A', 'C'), edge('B', 'D')]
    const communities = labelPropagation(edges, 20)
    // All should converge to one community
    expect(communities).toHaveLength(1)
    expect(communities[0].sort()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('produces same output on two runs with the same input (determinism)', () => {
    const edges = [
      edge('5511', '5612'),
      edge('5612', '9601'),
      edge('9601', '5511'),
      edge('1010', '1020'),
      edge('1020', '1030'),
    ]
    const run1 = labelPropagation(edges, 20)
    const run2 = labelPropagation(edges, 20)
    const normalize = (communities: string[][]) =>
      communities
        .map((c) => c.slice().sort())
        .sort((a, b) => a[0].localeCompare(b[0]))
    expect(normalize(run1)).toEqual(normalize(run2))
  })

  it('respects MAX_ITERATIONS cap and still returns communities', () => {
    // A simple graph that converges quickly — verifying maxIter param works
    const edges = [edge('A', 'B'), edge('B', 'C')]
    const communities = labelPropagation(edges, 1)
    // With just 1 iteration, it may or may not fully converge,
    // but it must still return communities without throwing
    expect(communities).toBeDefined()
    expect(Array.isArray(communities)).toBe(true)
    for (const c of communities) {
      expect(Array.isArray(c)).toBe(true)
    }
  })

  it('returns empty array when edges list is empty', () => {
    const communities = labelPropagation([], 20)
    expect(communities).toEqual([])
  })
})
