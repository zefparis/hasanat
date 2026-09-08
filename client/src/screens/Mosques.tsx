import { useEffect, useState } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { exploreApi, type Mosque } from '../lib/api'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'

export default function Mosques() {
  const { send } = useWallet()
  const { toast } = useToast()
  const [mosques, setMosques] = useState<Mosque[]>([])
  const [selected, setSelected] = useState<Mosque | null>(null)
  const [donating, setDonating] = useState<string | null>(null)

  useEffect(() => {
    exploreApi.mosques().then((m) => setMosques(m.mosques)).catch(() => {})
  }, [])

  async function donate(m: Mosque) {
    setDonating(m.id)
    try {
      await exploreApi.donateMosque(m.id, 25)
      await send(`Donation — ${m.name}`, 25)
      toast(`Donated 25 HAS to ${m.name}`)
    } catch {
      toast('Donation failed — check balance')
    } finally {
      setDonating(null)
    }
  }

  if (selected) {
    return (
      <div className="screen">
        <Header title={selected.name} left={<button className="ibtn" onClick={() => setSelected(null)}>‹</button>} right={<Shield />} />
        <div className="pad sec">
          <h3>Institution wallet</h3>
          <div className="card">
            <div className="kv"><span>General fund</span><b>{selected.institutionWallet.general.toLocaleString()} HAS</b></div>
            <div className="kv"><span>Sadaqah fund</span><b>{selected.institutionWallet.sadaqah.toLocaleString()} HAS</b></div>
            <div className="kv"><span>Zakat fund</span><b>{selected.institutionWallet.zakat.toLocaleString()} HAS</b></div>
            <div className="kv"><span>Pending approvals</span><b style={{ color: selected.institutionWallet.pendingApprovals > 0 ? 'var(--warn)' : 'var(--ok)' }}>{selected.institutionWallet.pendingApprovals}</b></div>
            <div className="kv"><span>Signatory threshold</span><b>{selected.institutionWallet.signatoryThreshold}</b></div>
          </div>
          <p className="disc">Read-only view. Institution wallets require multi-signatory approval for disbursement.</p>
        </div>
        <div className="pad sec">
          <div className="card" style={{ textAlign: 'center' }}>
            <b style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{selected.name}</b>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{selected.area} · Jumu'ah at {selected.jumuahTime}</p>
            <button className="btn gold" style={{ marginTop: 14 }} disabled={donating === selected.id} onClick={() => donate(selected)}>
              {donating === selected.id ? 'Donating...' : 'Donate 25 HAS'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <Header title="Mosques" right={<Shield />} />
      <div className="pad sec">
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {mosques.length} mosques · sorted by proximity
        </p>
        {mosques.length === 0 ? (
          <div className="card"><p className="muted">Loading...</p></div>
        ) : (
          mosques.map((m) => (
            <div className="card" key={m.id} style={{ marginTop: 8, cursor: 'pointer' }} onClick={() => setSelected(m)}>
              <div className="item">
                <div className="ic" style={{ fontSize: 24 }}>🕌</div>
                <div className="tx" style={{ flex: 1 }}>
                  <b style={{ fontSize: 15 }}>{m.name}</b>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{m.area} · {m.distanceKm} km · Jumu'ah {m.jumuahTime}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn ghost" style={{ fontSize: 12, padding: '6px 12px' }} disabled={donating === m.id} onClick={(e) => { e.stopPropagation(); donate(m) }}>
                    {donating === m.id ? '...' : 'Donate'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                <span>General: {m.institutionWallet.general.toLocaleString()}</span>
                <span>Sadaqah: {m.institutionWallet.sadaqah.toLocaleString()}</span>
                <span>Zakat: {m.institutionWallet.zakat.toLocaleString()}</span>
                {m.institutionWallet.pendingApprovals > 0 && <span style={{ color: 'var(--warn)' }}>{m.institutionWallet.pendingApprovals} pending</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
