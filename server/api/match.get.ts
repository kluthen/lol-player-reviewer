import { defineRiotHandler } from '../utils/api-handler.ts'
import { matchService } from '../utils/review-service.ts'

// GET /api/match?id=EUW1_7212345678&riotId=Pseudo%23TAG (riotId: player to highlight)
export default defineRiotHandler((query) =>
  matchService.execute({ matchId: query.id, riotId: query.riotId }),
)
