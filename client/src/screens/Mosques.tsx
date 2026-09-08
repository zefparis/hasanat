import { useEffect, useState } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { exploreApi, type Mosque } from '../lib/api'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { useI18n } from '../lib/i18n'

export default function Mosques() {
  const { send } = useWallet()
  const { toast } = useToast()
  const { t } = useI18n()
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
      toast(t('mosques.toastDonated', { name: m.name }))
    } catch {
      toast(t('mosques.toastDonationFailed'))
    } finally {
      setDonating(null)
    }
  }

  if (selected) {
    return (
      <div className="screen">
        <Header title={selected.name} left={<button className="ibtn" onClick={() => setSelected(null)}>‹</button>} right={<Shield />} />
        <div className="pad sec">
          <h3>{t('mosques.institutionWallet')}</h3>
          <div className="card">
            <div className="kv"><span>{t('mosques.generalFund')}</span><b>{selected.institutionWallet.general.toLocaleString()} HAS</b></div>
            <div className="kv"><span>{t('mosques.sadaqahFund')}</span><b>{selected.institutionWallet.sadaqah.toLocaleString()} HAS</b></div>
            <div className="kv"><span>{t('mosques.zakatFund')}</span><b>{selected.institutionWallet.zakat.toLocaleString()} HAS</b></div>
            <div className="kv"><span>{t('mosques.pendingApprovals')}</span><b style={{ color: selected.institutionWallet.pendingApprovals > 0 ? 'var(--warn)' : 'var(--ok)' }}>{selected.institutionWallet.pendingApprovals}</b></div>
            <div className="kv"><span>{t('mosques.signatoryThreshold')}</span><b>{selected.institutionWallet.signatoryThreshold}</b></div>
          </div>
          <p className="disc">{t('mosques.readonlyDisc')}</p>
        </div>
        <div className="pad sec">
          <div className="card" style={{ textAlign: 'center' }}>
            <b style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{selected.name}</b>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{selected.area} · {t('mosques.jumuahAt', { time: selected.jumuahTime })}</p>
            <button className="btn gold" style={{ marginTop: 14 }} disabled={donating === selected.id} onClick={() => donate(selected)}>
              {donating === selected.id ? t('mosques.donating') : t('mosques.donate25')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <Header title={t('mosques.title')} right={<Shield />} />
      <div className="pad sec">
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {t('mosques.mosquesCount', { n: mosques.length })}
        </p>
        {mosques.length === 0 ? (
          <div className="card"><p className="muted">{t('common.loading')}</p></div>
        ) : (
          mosques.map((m) => (
            <div className="card" key={m.id} style={{ marginTop: 8, cursor: 'pointer' }} onClick={() => setSelected(m)}>
              <div className="item">
                <div className="ic" style={{ fontSize: 24 }}>🕌</div>
                <div className="tx" style={{ flex: 1 }}>
                  <b style={{ fontSize: 15 }}>{m.name}</b>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{m.area} · {m.distanceKm} km · {t('mosques.jumuahAt', { time: m.jumuahTime })}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn ghost" style={{ fontSize: 12, padding: '6px 12px' }} disabled={donating === m.id} onClick={(e) => { e.stopPropagation(); donate(m) }}>
                    {donating === m.id ? '...' : t('mosques.donate')}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                <span>{t('mosques.general', { amt: m.institutionWallet.general.toLocaleString() })}</span>
                <span>{t('mosques.sadaqah', { amt: m.institutionWallet.sadaqah.toLocaleString() })}</span>
                <span>{t('mosques.zakat', { amt: m.institutionWallet.zakat.toLocaleString() })}</span>
                {m.institutionWallet.pendingApprovals > 0 && <span style={{ color: 'var(--warn)' }}>{t('mosques.pending', { n: m.institutionWallet.pendingApprovals })}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
