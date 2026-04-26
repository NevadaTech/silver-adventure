import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { AgentEvent } from '@/agent/domain/entities/AgentEvent'
import type { Recommendation } from '@/recommendations/domain/entities/Recommendation'

const HIGH_SCORE_THRESHOLD = 0.75
const VALUE_CHAIN_THRESHOLD = 0.65

export interface DetectInput {
  newRecs: Recommendation[]
  previousRecKeys: Set<string>
  newClusterMemberships: Map<string, string[]>
  existingClusterMemberships: Map<string, string[]>
  now: Date
}

@Injectable()
export class OpportunityDetector {
  detect(input: DetectInput): AgentEvent[] {
    const events: AgentEvent[] = []

    for (const rec of input.newRecs) {
      const k = `${rec.sourceCompanyId}|${rec.targetCompanyId}|${rec.relationType}`
      if (input.previousRecKeys.has(k)) continue

      if (rec.score >= HIGH_SCORE_THRESHOLD) {
        events.push(
          AgentEvent.create({
            id: randomUUID(),
            companyId: rec.sourceCompanyId,
            eventType: 'new_high_score_match',
            payload: {
              recommendationId: rec.id,
              targetId: rec.targetCompanyId,
              score: rec.score,
              type: rec.relationType,
            },
            now: input.now,
          }),
        )
      } else if (
        (rec.relationType === 'cliente' || rec.relationType === 'proveedor') &&
        rec.score >= VALUE_CHAIN_THRESHOLD
      ) {
        events.push(
          AgentEvent.create({
            id: randomUUID(),
            companyId: rec.sourceCompanyId,
            eventType: 'new_value_chain_partner',
            payload: {
              recommendationId: rec.id,
              targetId: rec.targetCompanyId,
              type: rec.relationType,
            },
            now: input.now,
          }),
        )
      }
    }

    for (const [clusterId, newMembers] of input.newClusterMemberships) {
      const existingMembers =
        input.existingClusterMemberships.get(clusterId) ?? []
      for (const existing of existingMembers) {
        for (const newMember of newMembers) {
          if (existing === newMember) continue
          events.push(
            AgentEvent.create({
              id: randomUUID(),
              companyId: existing,
              eventType: 'new_cluster_member',
              payload: { clusterId, newCompanyId: newMember },
              now: input.now,
            }),
          )
        }
      }
    }

    return events
  }
}
