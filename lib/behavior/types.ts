export type ActivityKind = 'ritual' | 'quest'

export type MomentumBand =
  | 'Dormant'
  | 'Stirring'
  | 'Building'
  | 'Momentum'
  | 'Flow'
  | 'Ascendant'

export type BehavioralTask = {
  id: string
  title: string
  activityKind: ActivityKind
  domainKeys: string[]
  priority: number
  effortMinutes: number
  createdAt: string
  dueAt?: string | null
  completedAt?: string | null
  progressCurrent?: number
  progressTarget?: number
  isToday?: boolean
  mustDo?: boolean
}

export type MotivationalProfile = {
  noveltyPreference: number
  structurePreference: number
  socialMotivation: number
  achievementMotivation: number
  completionSensitivity: number
  competitionPreference: number
  rewardSensitivity: number
  autonomyPreference: number
  challengeTolerance: number
  narrativePreference: number
}

export const DEFAULT_MOTIVATIONAL_PROFILE: MotivationalProfile = {
  noveltyPreference: 0.5,
  structurePreference: 0.5,
  socialMotivation: 0.5,
  achievementMotivation: 0.5,
  completionSensitivity: 0.5,
  competitionPreference: 0.5,
  rewardSensitivity: 0.5,
  autonomyPreference: 0.5,
  challengeTolerance: 0.5,
  narrativePreference: 0.5,
}
