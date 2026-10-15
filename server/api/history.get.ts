import { defineRiotHandler } from '../utils/api-handler.ts'
import { historyService } from '../utils/review-service.ts'

// GET /api/history?platform=euw1&riotId=Pseudo%23TAG&start=0
export default defineRiotHandler((query) =>
  historyService.execute({ platform: query.platform, riotId: query.riotId, start: query.start }),
)
