import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import hasanatRoutes from './routes/hasanat'
import prayerRoutes from './routes/prayer'
import walletRoutes from './routes/wallet'

const app = express()
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'hasanat-server', version: '0.1.0', mode: 'pilot-mock' })
})

// HCS-U7 auth + session proxy — the ONLY surface the browser calls for identity.
app.use('/api/hasanat', hasanatRoutes)

// Prayer times — real solar calculation, city-configurable.
app.use('/api/prayer', prayerRoutes)

// Wallet / ledger — pilot mock (no real value moves).
app.use('/api/wallet', walletRoutes)

const port = Number(process.env.PORT) || 8787
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Hasanat server (pilot mock) listening on :${port}`)
})
