import { useState } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import HoldToVerify from '../components/HoldToVerify'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/auth'
import { giveApi, type ZakatInput, type Campaign } from '../lib/api'
import { ApiError } from '../lib/api'
import { useI18n } from '../lib/i18n'

type Tab = 'main' | 'zakat' | 'sadaqah' | 'waqf'

const ELIGIBLE_CATEGORIES = [
  'give.catPoor',
  'give.catNeedy',
  'give.catCollectors',
  'give.catHearts',
  'give.catCaptives',
  'give.catDebtors',
  'give.catPath',
  'give.catTraveler',
]

const QUICK_AMOUNTS = [10, 25, 50, 100]

export default function Give() {
  const { state: wallet, send } = useWallet()
  const { toast } = useToast()
  const { isStale, signIn } = useAuth()
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('main')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoaded, setCampaignsLoaded] = useState(false)
  const [gating, setGating] = useState(false)

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
    } catch { toast(t('give.toastCalcFailed')) }
  }

  async function doPayZakat() {
    if (!zakatResult || zakatResult.zakatDue <= 0) { toast(t('give.toastCalcFirst')); return }
    if (wallet && zakatResult.zakatDue > wallet.balance) { toast(t('give.toastInsufficient')); return }
    try {
      await giveApi.payZakat(zakatResult.zakatDue)
      // Update local wallet state via the shared provider
      await send('Zakat — eligible recipients', zakatResult.zakatDue)
      toast(t('give.toastZakatPaid', { amt: zakatResult.zakatDue }))
      setZakatResult(null)
      setTab('main')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('give.toastZakatFailed'))
    }
  }

  async function payZakat() {
    if (isStale()) { setGating(true); return }
    void doPayZakat()
  }

  function onReverified(res: Parameters<typeof signIn>[0]) {
    signIn(res)
    setGating(false)
    void doPayZakat()
  }

  async function giveSadaqah(amount: number, campaignId?: string) {
    if (wallet && amount > wallet.balance) { toast(t('give.toastInsufficient')); return }
    try {
      await giveApi.sadaqah(amount, campaignId)
      await send(campaignId ? `Sadaqah — ${campaignId}` : 'Sadaqah', amount)
      toast(t('give.toastSadaqahGiven', { amt: amount }))
      setSadaqahAmt(null)
      // Refresh campaigns to show progress
      if (campaignId) { setCampaignsLoaded(false); void loadCampaigns() }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('give.toastSadaqahFailed'))
    }
  }

  // Load campaigns on mount
  if (!campaignsLoaded) void loadCampaigns()

  return (
    <div className="screen">
      <Header title={t('give.title')} right={<Shield />} />

      <div className="pad sec">
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div className="star" style={{ width: 48, height: 48, background: 'var(--accent)', margin: '0 auto 12px' }} />
          <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{t('give.zakatSadaqah')}</b>
          <p className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>
            {t('give.intro')}
          </p>
        </div>
      </div>

      <div className="wacts" style={{ marginTop: 4 }}>
        <button onClick={() => setTab('zakat')}><span>{t('give.zakat')}</span></button>
        <button onClick={() => setTab('sadaqah')}><span>{t('give.sadaqah')}</span></button>
        <button onClick={() => setTab('waqf')}><span>{t('give.waqf')}</span></button>
      </div>

      {/* ZAKAT */}
      {tab === 'zakat' && (
        <div className="pad sec">
          <h3>{t('give.calculator')}</h3>
          <div className="card">
            <p className="disc" style={{ marginBottom: 12 }}>
              {t('give.calcDisc')}
            </p>
            <div className="field"><label>{t('give.cashBank')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.cash || ''} onChange={(e) => setZakatInput({ ...zakatInput, cash: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>{t('give.goldValue')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.gold || ''} onChange={(e) => setZakatInput({ ...zakatInput, gold: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>{t('give.silverValue')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.silver || ''} onChange={(e) => setZakatInput({ ...zakatInput, silver: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>{t('give.businessAssets')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.businessAssets || ''} onChange={(e) => setZakatInput({ ...zakatInput, businessAssets: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>{t('give.debts')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.debts || ''} onChange={(e) => setZakatInput({ ...zakatInput, debts: Number(e.target.value) || 0 })} /></div>
            <button className="btn" style={{ marginTop: 14 }} onClick={calcZakat}>{t('give.calculate')}</button>
          </div>

          {zakatResult && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="kv"><span>{t('give.netAssets')}</span><b>{zakatResult.netAssetBase.toLocaleString()} SAR</b></div>
              <div className="kv"><span>{t('give.nisab')}</span><b>{zakatResult.nisab.toLocaleString()} SAR</b></div>
              <div className="kv">
                <span>{t('give.status')}</span>
                <b style={{ color: zakatResult.aboveNisab ? 'var(--ok)' : 'var(--muted)' }}>
                  {zakatResult.aboveNisab ? t('give.aboveNisab') : t('give.belowNisab')}
                </b>
              </div>
              <div className="kv" style={{ fontSize: 16, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                <span><b>{t('give.zakatDue')}</b></span>
                <b style={{ color: 'var(--accent)', fontSize: 18 }}>{zakatResult.zakatDue.toLocaleString()} SAR</b>
              </div>
              <p className="disc" style={{ marginTop: 8 }}>{zakatResult.disclaimer}</p>
              {zakatResult.aboveNisab && (
                <button className="btn gold" style={{ marginTop: 12 }} onClick={payZakat} disabled={wallet ? zakatResult.zakatDue > wallet.balance : true}>
                  {t('give.payZakatButton', { amt: zakatResult.zakatDue })}
                </button>
              )}
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('give.eligibleCategories')}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {ELIGIBLE_CATEGORIES.map((c) => (
                  <span key={c} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--muted)' }}>{t(c)}</span>
                ))}
              </div>
            </div>
          )}
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setTab('main')}>{t('common.back')}</button>
        </div>
      )}

      {/* SADAQAH */}
      {tab === 'sadaqah' && (
        <div className="pad sec">
          <h3>{t('give.quickSadaqah')}</h3>
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
              {t('give.giveButton', { amt: sadaqahAmt || 0 })}
            </button>
            <p className="disc">{t('give.sadaqahDisc')}</p>
          </div>

          <h3 style={{ marginTop: 20 }}>{t('give.verifiedCampaigns')}</h3>
          {!campaignsLoaded ? (
            <div className="card"><p className="muted">{t('give.loadingCampaigns')}</p></div>
          ) : (
            campaigns.map((c) => (
              <div className="card" key={c.id} style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <b style={{ fontSize: 15 }}>{c.title}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{c.subtitle}</div>
                  </div>
                  {c.verified && <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>{t('give.verified')}</span>}
                </div>
                <div style={{ marginTop: 10, height: 8, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (c.raised / c.goal) * 100)}%`, height: '100%', background: 'var(--primary-2)', borderRadius: 4, transition: 'width .5s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6, color: 'var(--muted)' }}>
                  <span>{c.raised.toLocaleString()} / {c.goal.toLocaleString()} HAS</span>
                  <span>{t('give.sponsorPool', { amt: c.sponsorPool.toLocaleString() })}</span>
                </div>
                <button className="btn ghost" style={{ marginTop: 10, fontSize: 13, padding: '8px 14px' }} onClick={() => giveSadaqah(25, c.id)}>{t('give.donate25')}</button>
              </div>
            ))
          )}
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setTab('main')}>{t('common.back')}</button>
        </div>
      )}

      {/* WAQF */}
      {tab === 'waqf' && (
        <div className="pad sec">
          <h3>{t('give.waqfTitle')}</h3>
          <div className="card">
            <div className="star" style={{ width: 40, height: 40, background: 'var(--accent)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)' }}>
              {t('give.waqfDisc')}
            </p>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
              {t('give.waqfPilot')}
            </p>
            <button className="btn" style={{ marginTop: 14 }} disabled>{t('give.contributeSoon')}</button>
            <p className="disc">{t('give.waqfDisabled')}</p>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setTab('main')}>{t('common.back')}</button>
          </div>
        </div>
      )}

      {/* MAIN */}
      {tab === 'main' && (
        <div className="pad sec">
          <h3>{t('give.verifiedCampaigns')}</h3>
          {!campaignsLoaded ? (
            <div className="card"><p className="muted">{t('give.loadingCampaigns')}</p></div>
          ) : (
            campaigns.map((c) => (
              <div className="card" key={c.id} style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <b style={{ fontSize: 15 }}>{c.title}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{c.subtitle}</div>
                  </div>
                  {c.verified && <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>{t('give.verified')}</span>}
                </div>
                <div style={{ marginTop: 10, height: 8, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (c.raised / c.goal) * 100)}%`, height: '100%', background: 'var(--primary-2)', borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6, color: 'var(--muted)' }}>
                  <span>{c.raised.toLocaleString()} / {c.goal.toLocaleString()} HAS</span>
                  <span>{t('give.sponsorPool', { amt: c.sponsorPool.toLocaleString() })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {gating && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--bg)', color: 'var(--ink)', borderRadius: '28px 28px 0 0', padding: '22px 20px calc(env(safe-area-inset-bottom) + 28px)', width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '90dvh', overflowY: 'auto' }}>
            <HoldToVerify
              onSuccess={onReverified}
              onCancel={() => setGating(false)}
              title={t('give.reverifyZakatTitle')}
              subtitle={t('give.reverifyZakatSub')}
              cancelLabel={t('common.cancel')}
            />
          </div>
        </div>
      )}
    </div>
  )
}
