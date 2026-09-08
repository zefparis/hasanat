import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import hasanatRoutes from './routes/hasanat'
import prayerRoutes from './routes/prayer'
import walletRoutes from './routes/wallet'
import chatRoutes from './routes/chat'
import giveRoutes from './routes/give'
import presenceRoutes from './routes/presence'
import exploreRoutes from './routes/explore'

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

// Chat — Hasanat AI (deterministic), Scholar ack, community/Family mock.
app.use('/api/chat', chatRoutes)

// Give — Zakat calculator (indicative), Sadaqah, campaigns.
app.use('/api/give', giveRoutes)

// Presence check-in — level 1 (prayer presence, NOT prayer verification)
app.use('/api/presence', presenceRoutes)

// Explore — mosques, businesses, learn
app.use('/api', exploreRoutes)

const port = Number(process.env.PORT) || 8787
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Hasanat server (pilot mock) listening on :${port}`)
})
