import { useState } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import HoldToVerify from '../components/HoldToVerify'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/auth'
import { giveApi, type ZakatInput, type ZakatResult, type ZakatMadhab, type NisabType, type Campaign } from '../lib/api'
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

const MADHABS: ZakatMadhab[] = ['hanafi', 'shafi', 'maliki', 'hanbali']

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function zakatReceiptPDF(r: ZakatResult, t: (k: string, v?: Record<string, string | number>) => string): string {
  const date = new Date().toLocaleString('en-GB')
  const lines = [
    t('give.pdfTitle'),
    `${t('give.pdfDate')}: ${date}`,
    '',
    `${t('give.pdfMadhab')}: ${r.madhab}`,
    `${t('give.pdfNisabType')}: ${r.nisabType} (${r.nisabMetalPrice} SAR/g)`,
    `${t('give.pdfNisabSource')}: ${r.nisabPriceSource}`,
    '',
    `${t('give.netAssets')}: ${r.netAssetBase.toLocaleString()} SAR`,
    `${t('give.pdfGoldIncluded')}: ${r.goldIncluded.toLocaleString()} SAR`,
    `${t('give.pdfDeductibleDebts')}: ${r.deductibleDebts.toLocaleString()} SAR`,
    `${t('give.nisab')}: ${r.nisab.toLocaleString()} SAR`,
    `${t('give.status')}: ${r.aboveNisab ? t('give.aboveNisab') : t('give.belowNisab')}`,
    '',
    `${t('give.zakatDue')}: ${r.zakatDue.toLocaleString()} SAR`,
    '',
    r.disclaimer,
  ]
  if (r.hawl.firstAboveNisabAt) {
    lines.push('', `${t('give.pdfHawlStart')}: ${new Date(r.hawl.firstAboveNisabAt).toLocaleDateString('en-GB')}`)
    if (r.hawl.daysRemaining !== null) {
      lines.push(`${t('give.pdfHawlRemaining')}: ${r.hawl.daysRemaining} ${t('give.pdfDays')}`)
    }
  }
  const text = lines.join('\n')
  const esc = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const stream = `BT /F1 9 Tf 1 0 0 1 50 760 Tm 14 TL (${esc.split('\n').join(') Tj T* (')}) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
  ]
  const pdf = `%PDF-1.4\n${objs.map((o, i) => `${i + 1} 0 obj\n${o}\nendobj`).join('\n')}\nxref\n0 ${objs.length + 1}\n0000000000 65535 f \n${objs.map((_, i) => `${String((i + 1) * 50).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${(objs.length + 1) * 50}\n%%EOF`
  return pdf
}

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
  const [zakatInput, setZakatInput] = useState<ZakatInput>({
    cash: 0, gold: 0, silver: 0, businessAssets: 0,
    receivables: 0, shortTermDebts: 0, longTermDebts: 0,
    madhab: 'hanafi', nisabType: 'silver',
  })
  const [zakatResult, setZakatResult] = useState<ZakatResult | null>(null)
  const [calculating, setCalculating] = useState(false)

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
    setCalculating(true)
    try {
      const res = await giveApi.zakat(zakatInput)
      setZakatResult(res)
    } catch { toast(t('give.toastCalcFailed')) }
    finally { setCalculating(false) }
  }

  async function doPayZakat() {
    if (!zakatResult || zakatResult.zakatDue <= 0) { toast(t('give.toastCalcFirst')); return }
    if (wallet && zakatResult.zakatDue > wallet.balance) { toast(t('give.toastInsufficient')); return }
    try {
      await giveApi.payZakat(zakatResult.zakatDue)
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
      if (campaignId) { setCampaignsLoaded(false); void loadCampaigns() }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('give.toastSadaqahFailed'))
    }
  }

  function exportZakatPDF() {
    if (!zakatResult) return
    downloadFile('hasanat-zakat-receipt.pdf', zakatReceiptPDF(zakatResult, t), 'application/pdf')
    toast(t('give.toastPdfExported'))
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

            {/* Madhab selector */}
            <div className="field">
              <label>{t('give.madhabLabel')}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MADHABS.map((m) => (
                  <button key={m} onClick={() => setZakatInput({ ...zakatInput, madhab: m })}
                    style={{
                      flex: '1 1 auto', padding: '8px 6px', borderRadius: 10, fontSize: 12.5, fontWeight: 500,
                      border: '1.5px solid', borderColor: zakatInput.madhab === m ? 'var(--accent)' : 'var(--line)',
                      background: zakatInput.madhab === m ? 'var(--accent-soft)' : 'var(--surface)',
                    }}>{t(`give.madhab_${m}`)}</button>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                {zakatInput.madhab === 'hanafi'
                  ? t('give.madhabGoldHanafi')
                  : t('give.madhabGoldMajority')}
                {' '}
                {zakatInput.madhab === 'shafi'
                  ? t('give.madhabDebtShafi')
                  : t('give.madhabDebtMajority')}
              </p>
            </div>

            {/* Nisab type selector */}
            <div className="field">
              <label>{t('give.nisabTypeLabel')}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['silver', 'gold'] as NisabType[]).map((n) => (
                  <button key={n} onClick={() => setZakatInput({ ...zakatInput, nisabType: n })}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12.5, fontWeight: 500,
                      border: '1.5px solid', borderColor: zakatInput.nisabType === n ? 'var(--accent)' : 'var(--line)',
                      background: zakatInput.nisabType === n ? 'var(--accent-soft)' : 'var(--surface)',
                    }}>{t(`give.nisab_${n}`)}</button>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t('give.nisabTypeDisc')}</p>
            </div>

            <div className="field"><label>{t('give.cashBank')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.cash || ''} onChange={(e) => setZakatInput({ ...zakatInput, cash: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>{t('give.goldValue')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.gold || ''} onChange={(e) => setZakatInput({ ...zakatInput, gold: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>{t('give.silverValue')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.silver || ''} onChange={(e) => setZakatInput({ ...zakatInput, silver: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>{t('give.businessAssets')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.businessAssets || ''} onChange={(e) => setZakatInput({ ...zakatInput, businessAssets: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>{t('give.receivables')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.receivables || ''} onChange={(e) => setZakatInput({ ...zakatInput, receivables: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>{t('give.shortTermDebts')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.shortTermDebts || ''} onChange={(e) => setZakatInput({ ...zakatInput, shortTermDebts: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>{t('give.longTermDebts')}</label><input inputMode="decimal" placeholder={t('give.placeholder')} value={zakatInput.longTermDebts || ''} onChange={(e) => setZakatInput({ ...zakatInput, longTermDebts: Number(e.target.value) || 0 })} /></div>
            <p className="muted" style={{ fontSize: 11, marginTop: 2 }}>{t('give.debtsDisc')}</p>
            <button className="btn" style={{ marginTop: 14 }} onClick={calcZakat} disabled={calculating}>
              {calculating ? t('give.calculating') : t('give.calculate')}
            </button>
          </div>

          {zakatResult && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="kv"><span>{t('give.netAssets')}</span><b>{zakatResult.netAssetBase.toLocaleString()} SAR</b></div>
              <div className="kv"><span>{t('give.nisab')}</span><b>{zakatResult.nisab.toLocaleString()} SAR</b></div>
              <div className="kv"><span>{t('give.nisabTypeLabel')}</span><b>{t(`give.nisab_${zakatResult.nisabType}`)} ({zakatResult.nisabMetalPrice} SAR/g)</b></div>
              <div className="kv"><span>{t('give.nisabPrice')}</span><b style={{ fontSize: 12, color: zakatResult.nisabPriceSource === 'live' ? 'var(--ok)' : 'var(--warn)' }}>{zakatResult.nisabPriceSource === 'live' ? t('give.priceLive') : t('give.priceFallback')}</b></div>
              <div className="kv">
                <span>{t('give.status')}</span>
                <b style={{ color: zakatResult.aboveNisab ? 'var(--ok)' : 'var(--muted)' }}>
                  {zakatResult.aboveNisab ? t('give.aboveNisab') : t('give.belowNisab')}
                </b>
              </div>

              {/* Hawl tracking */}
              {zakatResult.hawl.firstAboveNisabAt && (
                <div className="kv" style={{ fontSize: 12.5 }}>
                  <span>{t('give.hawl')}</span>
                  <b style={{ color: zakatResult.hawl.isComplete ? 'var(--ok)' : 'var(--ink)' }}>
                    {zakatResult.hawl.isComplete
                      ? t('give.hawlComplete')
                      : t('give.hawlDaysLeft', { days: zakatResult.hawl.daysRemaining ?? 0 })}
                  </b>
                </div>
              )}
              {!zakatResult.hawl.firstAboveNisabAt && zakatResult.aboveNisab && (
                <div className="kv" style={{ fontSize: 12.5 }}>
                  <span>{t('give.hawl')}</span>
                  <b style={{ color: 'var(--muted)' }}>{t('give.hawlStarted')}</b>
                </div>
              )}

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
              <button className="btn ghost" style={{ marginTop: 8, fontSize: 13 }} onClick={exportZakatPDF}>
                {t('give.exportPdf')}
              </button>
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
