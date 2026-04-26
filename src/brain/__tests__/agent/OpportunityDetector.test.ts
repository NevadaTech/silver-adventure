import { describe, expect, it } from 'vitest'
import { OpportunityDetector } from '@/agent/application/services/OpportunityDetector'
import {
  Recommendation,
  type CreateRecommendationInput,
} from '@/recommendations/domain/entities/Recommendation'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'

const T = new Date('2026-04-26T10:00:00Z')

const makeRec = (
  overrides: Partial<CreateRecommendationInput> = {},
): Recommendation =>
  Recommendation.create({
    id: 'rec-1',
    sourceCompanyId: 'a',
    targetCompanyId: 'b',
    relationType: 'cliente',
    score: 0.5,
    reasons: Reasons.empty(),
    source: 'rule',
    ...overrides,
  })

const key = (s: string, t: string, type: string): string => `${s}|${t}|${type}`

describe('OpportunityDetector', () => {
  describe('new_high_score_match', () => {
    it('emits when a new rec has score >= 0.75', () => {
      const detector = new OpportunityDetector()
      const rec = makeRec({
        id: 'r1',
        sourceCompanyId: 'a',
        targetCompanyId: 'b',
        relationType: 'aliado',
        score: 0.85,
      })

      const events = detector.detect({
        newRecs: [rec],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map(),
        existingClusterMemberships: new Map(),
        now: T,
      })

      expect(events).toHaveLength(1)
      expect(events[0]!.eventType).toBe('new_high_score_match')
      expect(events[0]!.companyId).toBe('a')
      expect(events[0]!.payload).toEqual({
        recommendationId: 'r1',
        targetId: 'b',
        score: 0.85,
        type: 'aliado',
      })
      expect(events[0]!.createdAt).toEqual(T)
    })

    it('does not emit when the rec key already existed in previous scan', () => {
      const detector = new OpportunityDetector()
      const rec = makeRec({
        id: 'r1',
        sourceCompanyId: 'a',
        targetCompanyId: 'b',
        relationType: 'cliente',
        score: 0.9,
      })

      const events = detector.detect({
        newRecs: [rec],
        previousRecKeys: new Set([key('a', 'b', 'cliente')]),
        newClusterMemberships: new Map(),
        existingClusterMemberships: new Map(),
        now: T,
      })

      expect(events).toHaveLength(0)
    })

    it('emits exactly one event per recommendation (high_score wins over value_chain)', () => {
      const detector = new OpportunityDetector()
      const rec = makeRec({
        id: 'r1',
        sourceCompanyId: 'a',
        targetCompanyId: 'b',
        relationType: 'cliente',
        score: 0.9, // crosses both thresholds
      })

      const events = detector.detect({
        newRecs: [rec],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map(),
        existingClusterMemberships: new Map(),
        now: T,
      })

      expect(events).toHaveLength(1)
      expect(events[0]!.eventType).toBe('new_high_score_match')
    })
  })

  describe('new_value_chain_partner', () => {
    it('emits for cliente with score >= 0.65 and < 0.75', () => {
      const detector = new OpportunityDetector()
      const rec = makeRec({
        id: 'r1',
        sourceCompanyId: 'a',
        targetCompanyId: 'b',
        relationType: 'cliente',
        score: 0.7,
      })

      const events = detector.detect({
        newRecs: [rec],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map(),
        existingClusterMemberships: new Map(),
        now: T,
      })

      expect(events).toHaveLength(1)
      expect(events[0]!.eventType).toBe('new_value_chain_partner')
      expect(events[0]!.payload).toEqual({
        recommendationId: 'r1',
        targetId: 'b',
        type: 'cliente',
      })
    })

    it('emits for proveedor with score >= 0.65', () => {
      const detector = new OpportunityDetector()
      const rec = makeRec({
        id: 'r1',
        sourceCompanyId: 'a',
        targetCompanyId: 'b',
        relationType: 'proveedor',
        score: 0.65,
      })

      const events = detector.detect({
        newRecs: [rec],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map(),
        existingClusterMemberships: new Map(),
        now: T,
      })

      expect(events).toHaveLength(1)
      expect(events[0]!.eventType).toBe('new_value_chain_partner')
    })

    it('does NOT emit for aliado or referente even with score >= 0.65', () => {
      const detector = new OpportunityDetector()
      const events = detector.detect({
        newRecs: [
          makeRec({
            id: 'r1',
            relationType: 'aliado',
            targetCompanyId: 'b',
            score: 0.7,
          }),
          makeRec({
            id: 'r2',
            relationType: 'referente',
            targetCompanyId: 'c',
            score: 0.7,
          }),
        ],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map(),
        existingClusterMemberships: new Map(),
        now: T,
      })

      expect(events).toHaveLength(0)
    })

    it('does not emit when score < 0.65', () => {
      const detector = new OpportunityDetector()
      const rec = makeRec({
        id: 'r1',
        relationType: 'cliente',
        score: 0.6,
      })

      const events = detector.detect({
        newRecs: [rec],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map(),
        existingClusterMemberships: new Map(),
        now: T,
      })

      expect(events).toHaveLength(0)
    })

    it('does not emit when key already existed', () => {
      const detector = new OpportunityDetector()
      const rec = makeRec({
        id: 'r1',
        sourceCompanyId: 'a',
        targetCompanyId: 'b',
        relationType: 'cliente',
        score: 0.7,
      })

      const events = detector.detect({
        newRecs: [rec],
        previousRecKeys: new Set([key('a', 'b', 'cliente')]),
        newClusterMemberships: new Map(),
        existingClusterMemberships: new Map(),
        now: T,
      })

      expect(events).toHaveLength(0)
    })
  })

  describe('new_cluster_member', () => {
    it('notifies existing members AND emits a joined_new_cluster for the newcomer', () => {
      const detector = new OpportunityDetector()
      const events = detector.detect({
        newRecs: [],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map([['cluster-1', ['c-new']]]),
        existingClusterMemberships: new Map([
          ['cluster-1', ['c-existing-1', 'c-existing-2']],
        ]),
        now: T,
      })

      const memberEvents = events.filter(
        (e) => e.eventType === 'new_cluster_member',
      )
      expect(memberEvents).toHaveLength(2)
      expect(memberEvents.map((e) => e.companyId).sort()).toEqual([
        'c-existing-1',
        'c-existing-2',
      ])
      expect(memberEvents[0]!.payload).toMatchObject({
        clusterId: 'cluster-1',
        newCompanyId: 'c-new',
      })

      const joinedEvents = events.filter(
        (e) => e.eventType === 'joined_new_cluster',
      )
      expect(joinedEvents).toHaveLength(1)
      expect(joinedEvents[0]!.companyId).toBe('c-new')
      expect(joinedEvents[0]!.payload).toEqual({
        clusterId: 'cluster-1',
        similarMembersCount: 2,
      })
    })

    it('emits the right number of events when multiple new members join a cluster with multiple existing members', () => {
      const detector = new OpportunityDetector()
      const events = detector.detect({
        newRecs: [],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map([['cluster-1', ['c-new-1', 'c-new-2']]]),
        existingClusterMemberships: new Map([['cluster-1', ['c-existing']]]),
        now: T,
      })

      const memberEvents = events.filter(
        (e) => e.eventType === 'new_cluster_member',
      )
      expect(memberEvents).toHaveLength(2)
      expect(memberEvents.every((e) => e.companyId === 'c-existing')).toBe(true)

      const joinedEvents = events.filter(
        (e) => e.eventType === 'joined_new_cluster',
      )
      expect(joinedEvents.map((e) => e.companyId).sort()).toEqual([
        'c-new-1',
        'c-new-2',
      ])
    })

    it('does not notify a company about itself joining', () => {
      const detector = new OpportunityDetector()
      const events = detector.detect({
        newRecs: [],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map([['cluster-1', ['c-1']]]),
        existingClusterMemberships: new Map([['cluster-1', ['c-1']]]),
        now: T,
      })

      // No `new_cluster_member` because c-1 was already there. The mirror
      // `joined_new_cluster` STILL fires because the newMembers Map says
      // c-1 was added. That's OK — it carries the history of "you joined
      // this cluster" and is idempotent (events are deduped by (id) anyway).
      const memberEvents = events.filter(
        (e) => e.eventType === 'new_cluster_member',
      )
      expect(memberEvents).toEqual([])
    })

    it('still emits the joined_new_cluster mirror when the cluster had no prior members', () => {
      const detector = new OpportunityDetector()
      const events = detector.detect({
        newRecs: [],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map([['cluster-1', ['c-1', 'c-2']]]),
        existingClusterMemberships: new Map(),
        now: T,
      })

      const memberEvents = events.filter(
        (e) => e.eventType === 'new_cluster_member',
      )
      expect(memberEvents).toEqual([])

      const joinedEvents = events.filter(
        (e) => e.eventType === 'joined_new_cluster',
      )
      expect(joinedEvents.map((e) => e.companyId).sort()).toEqual([
        'c-1',
        'c-2',
      ])
      expect(joinedEvents[0]!.payload).toMatchObject({
        clusterId: 'cluster-1',
        similarMembersCount: 0,
      })
    })
  })

  describe('combined detection', () => {
    it('emits a mix of rec and cluster events in a single pass', () => {
      const detector = new OpportunityDetector()
      const events = detector.detect({
        newRecs: [
          makeRec({
            id: 'r1',
            sourceCompanyId: 'a',
            targetCompanyId: 'b',
            relationType: 'cliente',
            score: 0.9,
          }),
          makeRec({
            id: 'r2',
            sourceCompanyId: 'a',
            targetCompanyId: 'c',
            relationType: 'proveedor',
            score: 0.7,
          }),
        ],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map([['cluster-1', ['c-new']]]),
        existingClusterMemberships: new Map([['cluster-1', ['c-existing']]]),
        now: T,
      })

      expect(events).toHaveLength(4)
      const types = events.map((e) => e.eventType).sort()
      expect(types).toEqual([
        'joined_new_cluster',
        'new_cluster_member',
        'new_high_score_match',
        'new_value_chain_partner',
      ])
    })

    it('every emitted event has a non-empty id and the provided createdAt', () => {
      const detector = new OpportunityDetector()
      const events = detector.detect({
        newRecs: [
          makeRec({
            id: 'r1',
            sourceCompanyId: 'a',
            targetCompanyId: 'b',
            relationType: 'cliente',
            score: 0.9,
          }),
        ],
        previousRecKeys: new Set(),
        newClusterMemberships: new Map(),
        existingClusterMemberships: new Map(),
        now: T,
      })

      expect(events[0]!.id.length).toBeGreaterThan(0)
      expect(events[0]!.createdAt).toEqual(T)
    })
  })
})
