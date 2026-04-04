import type { AnalysisOverviewDto } from '@lime-novel/application'

export const analysisScoreLabel: Record<keyof AnalysisOverviewDto['averageScores'], string> = {
  hookStrength: '钩子',
  characterHeat: '人物',
  pacingMomentum: '节奏',
  feedbackResonance: '反馈'
}
