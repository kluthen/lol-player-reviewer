// Ranked Solo/Duo and Ranked Flex: the only queues the profile counts.
export const RANKED_QUEUES: ReadonlySet<number> = new Set([420, 440])
export const ARENA_QUEUES: ReadonlySet<number> = new Set([1700, 1710])

const QUEUES: Record<number, string> = {
  400: 'Normal Draft',
  420: 'Classée Solo/Duo',
  430: 'Normal',
  440: 'Classée Flex',
  450: 'ARAM',
  480: 'Partie rapide',
  490: 'Partie rapide',
  700: 'Clash',
  720: 'Clash ARAM',
  830: 'Coop vs IA',
  840: 'Coop vs IA',
  850: 'Coop vs IA',
  900: 'URF',
  1020: 'Un pour tous',
  1700: 'Arena',
  1710: 'Arena',
  1900: 'URF',
}

export const queueLabel = (queueId: number) => QUEUES[queueId] ?? `Autre mode (${queueId})`
