import { useState } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { giveApi, type ZakatInput, type Campaign } from '../lib/api'
import { ApiError } from '../lib/api'

type Tab = 'main' | 'zakat' | 'sadaqah' | 'waqf'

const ELIGIBLE_CATEGORIES = [
  'The poor (Fuqara)',
  'The needy (Masakin)',
  'Zakat collectors',
  'To reconcile hearts',
  'To free captives',
  'Debtors',
  "In Allah's path (Fi Sabilillah)",
  'The stranded traveler (Ibn al-Sabil)',
]

const QUICK_AMOUNTS = [10, 25, 50, 100]

export default function Give() {
  const { state: wallet, send } = useWallet()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('main')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoaded, setCampaignsLoaded] = useState(false)

  // Zakat form
  const [zakatInput, setZakatInput] = useState<ZakatInput>({ cash: 0, gold: 0, silver: 0, businessAssets: 0, debts: 0 })
  const [zakatResult, setZakatResult] = useState<{ zakatDue: number; netAssetBase: number; nisab: number; aboveNisab: boolean; disclaimer: string } | null>(null)

  // Sadaqah
  const [sadaqahAmt, setSadaqahAmt] = useState<number | null>(null)

  async function loadCampaigns() {
    if (campaignsLoaded) return
    try {
      const res = await giveApi.campaigns()
      setCampaigns(res.campaigns)
      setCampaignsLoaded(true)
    } catch { /* keep empty */ }
  }

  async function calcZakat() {
    try {
      const res = await giveApi.zakat(zakatInput)
      setZakatResult(res)
    } catch { toast('Calculation failed') }
  }

  async function payZakat() {
    if (!zakatResult || zakatResult.zakatDue <= 0) { toast('Calculate your Zakat first'); return }
    if (wallet && zakatResult.zakatDue > wallet.balance) { toast('Insufficient balance'); return }
    try {
      await giveApi.payZakat(zakatResult.zakatDue)
      // Update local wallet state via the shared provider
      await send('Zakat — eligible recipients', zakatResult.zakatDue)
      toast(`Zakat paid: ${zakatResult.zakatDue} HAS`)
      setZakatResult(null)
      setTab('main')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Zakat payment failed')
    }
  }

  async function giveSadaqah(amount: number, campaignId?: string) {
    if (wallet && amount > wallet.balance) { toast('Insufficient balance'); return }
    try {
      await giveApi.sadaqah(amount, campaignId)
      await send(campaignId ? `Sadaqah — ${campaignId}` : 'Sadaqah', amount)
      toast(`Sadaqah given: ${amount} HAS`)
      setSadaqahAmt(null)
      // Refresh campaigns to show progress
      if (campaignId) { setCampaignsLoaded(false); void loadCampaigns() }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Sadaqah failed')
    }
  }

  // Load campaigns on mount
  if (!campaignsLoaded) void loadCampaigns()

  return (
    <div className="screen">
      <Header title="Give" right={<Shield />} />

      <div className="pad sec">
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div className="star" style={{ width: 48, height: 48, background: 'var(--accent)', margin: '0 auto 12px' }} />
          <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>Zakat & Sadaqah</b>
          <p className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>
            Give with intention. Zakat is calculated indicatively — for a definitive ruling, consult the Scholar panel.
          </p>
        </div>
      </div>

      <div className="wacts" style={{ marginTop: 4 }}>
        <button onClick={() => setTab('zakat')}><span>Zakat</span></button>
        <button onClick={() => setTab('sadaqah')}><span>Sadaqah</span></button>
        <button onClick={() => setTab('waqf')}><span>Waqf</span></button>
      </div>

      {/* ZAKAT */}
      {tab === 'zakat' && (
        <div className="pad sec">
          <h3>Zakat calculator</h3>
          <div className="card">
            <p className="disc" style={{ marginBottom: 12 }}>
              Indicative calculation at 2.5% on net qualifying assets. The nisab shown is illustrative — not a religious ruling.
            </p>
            <div className="field"><label>Cash & bank (SAR)</label><input inputMode="decimal" placeholder="0" value={zakatInput.cash || ''} onChange={(e) => setZakatInput({ ...zakatInput, cash: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>Gold value (SAR)</label><input inputMode="decimal" placeholder="0" value={zakatInput.gold || ''} onChange={(e) => setZakatInput({ ...zakatInput, gold: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>Silver value (SAR)</label><input inputMode="decimal" placeholder="0" value={zakatInput.silver || ''} onChange={(e) => setZakatInput({ ...zakatInput, silver: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>Business assets (SAR)</label><input inputMode="decimal" placeholder="0" value={zakatInput.businessAssets || ''} onChange={(e) => setZakatInput({ ...zakatInput, businessAssets: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>Debts & liabilities (SAR)</label><input inputMode="decimal" placeholder="0" value={zakatInput.debts || ''} onChange={(e) => setZakatInput({ ...zakatInput, debts: Number(e.target.value) || 0 })} /></div>
            <button className="btn" style={{ marginTop: 14 }} onClick={calcZakat}>Calculate</button>
          </div>

          {zakatResult && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="kv"><span>Net asset base</span><b>{zakatResult.netAssetBase.toLocaleString()} SAR</b></div>
              <div className="kv"><span>Illustrative nisab</span><b>{zakatResult.nisab.toLocaleString()} SAR</b></div>
              <div className="kv">
                <span>Status</span>
                <b style={{ color: zakatResult.aboveNisab ? 'var(--ok)' : 'var(--muted)' }}>
                  {zakatResult.aboveNisab ? 'Above nisab' : 'Below nisab'}
                </b>
              </div>
              <div className="kv" style={{ fontSize: 16, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                <span><b>Zakat due (2.5%)</b></span>
                <b style={{ color: 'var(--accent)', fontSize: 18 }}>{zakatResult.zakatDue.toLocaleString()} SAR</b>
              </div>
              <p className="disc" style={{ marginTop: 8 }}>{zakatResult.disclaimer}</p>
              {zakatResult.aboveNisab && (
                <button className="btn gold" style={{ marginTop: 12 }} onClick={payZakat} disabled={wallet ? zakatResult.zakatDue > wallet.balance : true}>
                  Pay {zakatResult.zakatDue} HAS as Zakat
                </button>
              )}
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Eligible categories (informational):</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {ELIGIBLE_CATEGORIES.map((c) => (
                  <span key={c} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--muted)' }}>{c}</span>
                ))}
              </div>
            </div>
          )}
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setTab('main')}>Back</button>
        </div>
      )}

      {/* SADAQAH */}
      {tab === 'sadaqah' && (
        <div className="pad sec">
          <h3>Quick Sadaqah</h3>
          <div className="card">
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {QUICK_AMOUNTS.map((amt) => (
                <button key={amt} className={sadaqahAmt === amt ? 'on' : ''} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid',
                  borderColor: sadaqahAmt === amt ? 'var(--accent)' : 'var(--line)',
                  background: sadaqahAmt === amt ? 'var(--accent-soft)' : 'var(--surface)',
                  fontWeight: 500, fontSize: 15,
                }} onClick={() => setSadaqahAmt(amt)}>{amt} HAS</button>
              ))}
            </div>
            <button className="btn gold" disabled={!sadaqahAmt || (wallet ? sadaqahAmt > wallet.balance : true)} onClick={() => sadaqahAmt && giveSadaqah(sadaqahAmt)}>
              Give {sadaqahAmt || 0} HAS
            </button>
            <p className="disc">Your donation amount is private — it is not shown in any shared feed.</p>
          </div>

          <h3 style={{ marginTop: 20 }}>Verified campaigns</h3>
          {!campaignsLoaded ? (
            <div className="card"><p className="muted">Loading campaigns...</p></div>
          ) : (
            campaigns.map((c) => (
              <div className="card" key={c.id} style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <b style={{ fontSize: 15 }}>{c.title}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{c.subtitle}</div>
                  </div>
                  {c.verified && <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>✓ Verified</span>}
                </div>
                <div style={{ marginTop: 10, height: 8, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (c.raised / c.goal) * 100)}%`, height: '100%', background: 'var(--primary-2)', borderRadius: 4, transition: 'width .5s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6, color: 'var(--muted)' }}>
                  <span>{c.raised.toLocaleString()} / {c.goal.toLocaleString()} HAS</span>
                  <span>Sponsor pool: +{c.sponsorPool.toLocaleString()} HAS</span>
                </div>
                <button className="btn ghost" style={{ marginTop: 10, fontSize: 13, padding: '8px 14px' }} onClick={() => giveSadaqah(25, c.id)}>Give 25 HAS</button>
              </div>
            ))
          )}
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setTab('main')}>Back</button>
        </div>
      )}

      {/* WAQF */}
      {tab === 'waqf' && (
        <div className="pad sec">
          <h3>Waqf</h3>
          <div className="card">
            <div className="star" style={{ width: 40, height: 40, background: 'var(--accent)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)' }}>
              A Waqf is a restricted, dedicated account with rules for its beneficiaries. The principal is preserved
              and only the yield is distributed according to the Waqf terms.
            </p>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
              In the pilot, Waqf contribution is informational. No real restricted account is created — this will be
              available when the full ledger and beneficiary rules are in place.
            </p>
            <button className="btn" style={{ marginTop: 14 }} disabled>Contribute (coming soon)</button>
            <p className="disc">Disabled in the pilot — consistent with Redeem, which also requires the full regulated partner integration.</p>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setTab('main')}>Back</button>
          </div>
        </div>
      )}

      {/* MAIN */}
      {tab === 'main' && (
        <div className="pad sec">
          <h3>Verified campaigns</h3>
          {!campaignsLoaded ? (
            <div className="card"><p className="muted">Loading campaigns...</p></div>
          ) : (
            campaigns.map((c) => (
              <div className="card" key={c.id} style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <b style={{ fontSize: 15 }}>{c.title}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{c.subtitle}</div>
                  </div>
                  {c.verified && <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>✓ Verified</span>}
                </div>
                <div style={{ marginTop: 10, height: 8, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (c.raised / c.goal) * 100)}%`, height: '100%', background: 'var(--primary-2)', borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6, color: 'var(--muted)' }}>
                  <span>{c.raised.toLocaleString()} / {c.goal.toLocaleString()} HAS</span>
                  <span>Sponsor pool: +{c.sponsorPool.toLocaleString()} HAS</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
