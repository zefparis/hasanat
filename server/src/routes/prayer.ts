/** Prayer times route — real solar calculation, city-configurable. */
import { Router } from 'express'
import { getSchedule } from '../services/prayer'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getSchedule())
})

export default router
