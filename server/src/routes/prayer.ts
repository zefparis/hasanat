/** Prayer times route — real solar calculation, city-configurable. */
import { Router } from 'express'
import { getSchedule, type CalcMethod, type Madhab } from '../services/prayer'

const router = Router()

const VALID_METHODS: CalcMethod[] = ['MWL', 'ISNA', 'UMM_QURA', 'EGYPTIAN', 'KARACHI']
const VALID_MADHABS: Madhab[] = ['standard', 'hanafi']

router.get('/', (req, res) => {
  const method = VALID_METHODS.includes(req.query.method as CalcMethod)
    ? (req.query.method as CalcMethod)
    : 'MWL'
  const madhab = VALID_MADHABS.includes(req.query.madhab as Madhab)
    ? (req.query.madhab as Madhab)
    : 'standard'
  res.json(getSchedule(method, madhab))
})

export default router
