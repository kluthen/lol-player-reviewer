import { defineRiotHandler } from '../utils/api-handler.ts'
import { profileService } from '../utils/review-service.ts'

// GET /api/profile?platform=euw1&riotId=Pseudo%23TAG&period=20-30
export default defineRiotHandler((query) =>
  profileService.execute({ platform: query.platform, riotId: query.riotId, period: query.period }),
)
