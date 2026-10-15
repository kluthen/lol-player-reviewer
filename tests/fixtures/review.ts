import type { PlayerReview, ReviewMatch } from '../../shared/types/review.ts'
import { summarizeMatches } from '../../shared/domain/review.ts'

// Synthetic data for automated tests only. Never imported by the application.
const samples = [
  ['Nami', 267, true, 4, 2, 18, 420, 'UTILITY'],
  ['Thresh', 412, false, 1, 7, 12, 420, 'UTILITY'],
  ['Ahri', 103, true, 12, 5, 14, 450, null],
  ['Nautilus', 111, false, 0, 6, 8, 420, 'UTILITY'],
  ['Lulu', 117, true, 2, 3, 16, 440, 'UTILITY'],
  ['Nami', 267, true, 5, 4, 12, 420, 'UTILITY'],
  ['Thresh', 412, false, 3, 8, 8, 420, 'UTILITY'],
  ['Nami', 267, true, 10, 2, 9, 420, 'UTILITY'],
  ['Lulu', 117, false, 4, 5, 10, 420, 'UTILITY'],
  ['Nami', 267, true, 11, 3, 12, 420, 'UTILITY'],
] as const

export function makeMatch(overrides: Partial<ReviewMatch> = {}): ReviewMatch {
  return {
    id: 'EUW1_1000',
    championId: 267,
    championKey: 'Nami',
    championName: 'Nami',
    queueId: 420,
    mode: 'Classée Solo/Duo',
    role: 'UTILITY',
    win: true,
    kills: 4,
    deaths: 2,
    assists: 18,
    startedAt: Date.UTC(2026, 9, 14, 18),
    duration: 1800,
    vision: 42,
    cs: 31,
    gold: 10250,
    damage: 8460,
    items: [],
    ...overrides,
  }
}

export function makeReview(): PlayerReview {
  const matches = samples.map(
    ([champion, championId, win, kills, deaths, assists, queueId, role], index) =>
      makeMatch({
        id: `EUW1_${1000 + index}`,
        championId,
        championKey: champion,
        championName: champion,
        win,
        kills,
        deaths,
        assists,
        queueId,
        role,
        startedAt: Date.UTC(2026, 9, 14 - index, 18),
        mode: queueId === 450 ? 'ARAM' : queueId === 440 ? 'Classée Flex' : 'Classée Solo/Duo',
      }),
  )
  return {
    player: { gameName: 'NamiMain', tagLine: 'MDS', region: 'EUW' },
    matches,
    summary: summarizeMatches(matches),
    sample: { requested: 20, found: 10, unavailable: 0, excluded: 0 },
    assetVersion: '16.20.1',
    updatedAt: Date.UTC(2026, 9, 15),
  }
}
