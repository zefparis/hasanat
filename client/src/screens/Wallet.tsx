import { useState } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import HoldToVerify from '../components/HoldToVerify'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { ApiError } from '../lib/api'
import type { LedgerEntry } from '../lib/api'

type Tab = 'main' | 'buy' | 'send' | 'receive' | 'redeem'

const contacts = [
  { name: 'Aisha', initial: 'A' },
  { name: 'Yusuf', initial: 'Y' },
  { name: 'Fatima', initial: 'F' },
  { name: 'Omar', initial: 'O' },
]

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type TFunc = (key: string, vars?: Record<string, string | number>) => string

function toCSV(entries: LedgerEntry[], t: TFunc): string {
  const rows = [[t('wallet.csvDate'), t('wallet.csvDesc'), t('wallet.csvLabel'), t('wallet.csvAmount'), t('wallet.csvUnit'), t('wallet.csvReceipt')].join(',')]
  for (const e of entries) {
    rows.push([fmtDate(e.ts), `"${e.description}"`, e.label, e.amount, e.unit, e.receiptNo ?? ''].join(','))
  }
  return rows.join('\n')
}

function toPDF(entries: LedgerEntry[], t: TFunc): string {
  const lines = entries.map((e) => `${fmtDate(e.ts)}  ${e.description}  ${e.label}  ${e.amount > 0 ? '+' : ''}${e.amount} ${e.unit}`)
  const text = [t('wallet.pdfTitle'), t('wallet.pdfGenerated', { date: new Date().toLocaleString('en-GB') }), '', ...lines].join('\n')
  const esc = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const stream = `BT /F1 9 Tf 1 0 0 1 50 760 Tm 14 TL (${esc.split('\n').join(') Tj T* (')}) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
  ]
  let body = ''
  objs.forEach((o, i) => { body += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  const offset = xref.length + body.length
  return `%PDF-1.4\n${body}${xref}${offset} 00000 n \ntrailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`
}

export default function Wallet() {
  const { state: wallet, entries, buy, send, receive } = useWallet()
  const { toast } = useToast()
  const { isStale, signIn } = useAuth()
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('main')
  const [buyAmt, setBuyAmt] = useState('')
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [sendAmt, setSendAmt] = useState('')
  const [gating, setGating] = useState(false)

  const ledgerLabel = (label: string): string => {
    const map: Record<string, string> = {
      reserve: t('wallet.ledgerReserve'),
      settlement: t('wallet.ledgerSettlement'),
      charitable: t('wallet.ledgerCharitable'),
      reward: t('wallet.ledgerReward'),
      send: t('wallet.ledgerSend'),
    }
    return map[label] ?? label
  }

  function doBuy() {
    const sar = Number(buyAmt)
    if (!sar || sar <= 0) { toast(t('wallet.toastValidAmount')); return }
    buy(sar).then(() => { toast(t('wallet.toastBought', { amt: sar })); setBuyAmt(''); setTab('main') }).catch((e) => toast(e instanceof ApiError ? e.message : t('wallet.toastBuyFailed')))
  }

  async function doSend() {
    const amt = Number(sendAmt)
    if (!selectedContact) { toast(t('wallet.toastChooseContact')); return }
    if (!amt || amt <= 0) { toast(t('wallet.toastValidAmount')); return }
    if (wallet && amt > wallet.balance) { toast(t('wallet.toastInsufficient')); return }
    send(selectedContact, amt).then(() => { toast(t('wallet.toastSent', { amt, contact: selectedContact })); setSendAmt(''); setSelectedContact(null); setTab('main') }).catch((e) => toast(e instanceof ApiError ? e.message : t('wallet.toastSendFailed')))
  }

  function confirmSend() {
    if (isStale()) { setGating(true); return }
    void doSend()
  }

  function onReverified(res: Parameters<typeof signIn>[0]) {
    signIn(res)
    setGating(false)
    void doSend()
  }

  function doReceive() {
    toast(t('wallet.toastSimulating'))
    setTimeout(() => {
      receive(150).then(() => toast(t('wallet.toastReceived'))).catch(() => toast(t('wallet.toastReceiveFailed')))
    }, 1500)
  }

  function exportCSV() { downloadFile('hasanat-activity.csv', toCSV(entries, t), 'text/csv'); toast(t('wallet.toastCsvExported')) }
  function exportPDF() { downloadFile('hasanat-activity.pdf', toPDF(entries, t), 'application/pdf'); toast(t('wallet.toastPdfExported')) }

  if (!wallet) {
    return <div className="screen"><Header title={t('wallet.title')} dark /><div className="pad" style={{ marginTop: 20 }}><p className="muted">{t('wallet.loadingWallet')}</p></div></div>
  }

  return (
    <div className="screen">
      <div className="whero">
        <Header title={t('wallet.title')} dark right={<Shield />} />
        <div className="num">{wallet.balance.toLocaleString()}<small>HAS</small></div>
        <div className="eq">= {wallet.balance.toLocaleString()}.00 SAR{wallet.mockLedger ? ` - ${t('wallet.pilotMockLedger')}` : ` - ${t('wallet.backedReserve')}`}</div>
        <div className="res"><i /> {wallet.mockLedger ? t('wallet.mockMode') : t('wallet.realBacking')}</div>
      </div>

      <div className="wacts">
        <button onClick={() => setTab('buy')}><span>{t('wallet.buy')}</span></button>
        <button onClick={() => setTab('send')}><span>{t('wallet.send')}</span></button>
        <button onClick={() => setTab('receive')}><span>{t('wallet.receive')}</span></button>
        <button onClick={() => setTab('redeem')}><span>{t('wallet.redeem')}</span></button>
      </div>

      {tab === 'main' && (
        <>
          <div className="pad sec">
            <h3>{t('common.points')}</h3>
            <div className="card">
              <div className="pcard">
                <div className="star ps" style={{ width: 48, height: 48, background: 'var(--accent)' }} />
                <div><b>{wallet.points}</b><span>{t('wallet.recognitionOnly')}</span></div>
              </div>
            </div>
          </div>
          <div className="pad sec">
            <h3>{t('wallet.activity')} <span style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportCSV} style={{ fontSize: 12, color: 'var(--primary-2)', fontWeight: 500 }}>{t('wallet.csv')}</button>
              <button onClick={exportPDF} style={{ fontSize: 12, color: 'var(--primary-2)', fontWeight: 500 }}>{t('wallet.pdf')}</button>
            </span></h3>
            <div className="card">
              {entries.length === 0 && <p className="muted">{t('wallet.noActivity')}</p>}
              {entries.map((e) => (
                <div className="item" key={e.id}>
                  <div className="ic">{e.amount > 0 ? '↙' : '↗'}</div>
                  <div className="tx"><b>{e.description}</b><span>{ledgerLabel(e.label)} · {fmtDate(e.ts)}</span></div>
                  <div className={`amt ${e.amount > 0 ? 'in' : ''}`}>{e.amount > 0 ? '+' : ''}{e.amount}<small>{e.unit}</small></div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'buy' && (
        <div className="pad sec">
          <h3>{t('wallet.buyTitle')}</h3>
          <div className="card">
            <div className="field">
              <label>{t('wallet.amountSar')}</label>
              <input inputMode="decimal" placeholder={t('wallet.amountPlaceholder')} value={buyAmt} onChange={(e) => setBuyAmt(e.target.value)} />
            </div>
            <button className="btn" style={{ marginTop: 16 }} onClick={doBuy}>{t('wallet.buyButton', { amt: buyAmt || '0' })}</button>
            <p className="disc">{wallet.mockLedger ? t('wallet.buyMockDisc') : t('wallet.buyRealDisc')}</p>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setTab('main')}>{t('common.back')}</button>
          </div>
        </div>
      )}

      {tab === 'send' && (
        <div className="pad sec">
          <h3>{t('wallet.sendTitle')}</h3>
          <div className="card">
            <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--muted)', marginBottom: 8, display: 'block' }}>{t('wallet.chooseContact')}</label>
            <div className="contacts" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 0 8px' }}>
              {contacts.map((c) => (
                <button key={c.name} onClick={() => setSelectedContact(c.name)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 12, minWidth: 64 }}>
                  <div className="cav" style={{ width: 54, height: 54, borderRadius: '50%', background: selectedContact === c.name ? 'var(--accent-soft)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--primary-2)', border: `2px solid ${selectedContact === c.name ? 'var(--accent)' : 'transparent'}` }}>{c.initial}</div>
                  {c.name}
                </button>
              ))}
            </div>
            <div className="field">
              <label>{t('wallet.amountHas', { balance: wallet.balance })}</label>
              <input inputMode="decimal" placeholder={t('wallet.sendPlaceholder')} value={sendAmt} onChange={(e) => setSendAmt(e.target.value)} />
            </div>
            <div className="row" style={{ marginTop: 12, fontSize: 13 }}>
              <span className="muted">{t('wallet.review')}</span>
              <b>{selectedContact ? t('wallet.reviewSummary', { amt: sendAmt || '0', contact: selectedContact }) : t('wallet.selectContact')}</b>
            </div>
            <button className="btn" style={{ marginTop: 12 }} onClick={confirmSend} disabled={!selectedContact || !sendAmt || (wallet ? Number(sendAmt) > wallet.balance : true)}>{t('wallet.confirmSend')}</button>
            {wallet && sendAmt && Number(sendAmt) > wallet.balance && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{t('wallet.insufficientReview')}</p>}
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setTab('main')}>{t('common.back')}</button>
          </div>
        </div>
      )}

      {tab === 'receive' && (
        <div className="pad sec">
          <h3>{t('wallet.receiveTitle')}</h3>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="qrbig" style={{ width: 180, height: 180, margin: '0 auto 14px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(13,1fr)', gap: 2 }}>
              {Array.from({ length: 169 }).map((_, i) => (
                <b key={i} className={Math.random() > 0.5 ? '' : 'o'} style={{ background: Math.random() > 0.5 ? 'var(--ink)' : 'transparent', borderRadius: 1 }} />
              ))}
            </div>
            <b style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{t('wallet.receiveAddress')}</b>
            <p className="muted" style={{ marginTop: 4 }}>{t('wallet.yourAddress')}</p>
            <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => { navigator.clipboard?.writeText('hasanat:ben_8f3a2c'); toast(t('wallet.copyLink')) }}>{t('wallet.copyLink')}</button>
            <button className="btn" style={{ marginTop: 10 }} onClick={doReceive}>{t('wallet.simulate')}</button>
            <p className="disc">{t('wallet.simulateDisc')}</p>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setTab('main')}>{t('common.back')}</button>
          </div>
        </div>
      )}

      {tab === 'redeem' && (
        <div className="pad sec">
          <h3>{t('wallet.redeemTitle')}</h3>
          <div className="card">
            <p className="muted">{t('wallet.redeemDisc')}</p>
            <div className="kv" style={{ marginTop: 12 }}><span>{t('wallet.available')}</span><b>{wallet.balance} HAS</b></div>
            <div className="kv"><span>{t('wallet.rate')}</span><b>{t('wallet.rateValue')}</b></div>
            <div className="kv"><span>{t('wallet.partner')}</span><b>{t('wallet.partnerMock')}</b></div>
            <button className="btn" style={{ marginTop: 12 }} disabled>{t('wallet.requestRedemption')}</button>
            <p className="disc">{t('wallet.redeemDisabledDisc')}</p>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setTab('main')}>{t('common.back')}</button>
          </div>
        </div>
      )}

      {gating && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--bg)', color: 'var(--ink)', borderRadius: '28px 28px 0 0', padding: '22px 20px calc(env(safe-area-inset-bottom) + 28px)', width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '90dvh', overflowY: 'auto' }}>
            <HoldToVerify
              onSuccess={onReverified}
              onCancel={() => setGating(false)}
              title={t('wallet.reverifySendTitle')}
              subtitle={t('wallet.reverifySendSub')}
              cancelLabel={t('wallet.cancelSend')}
            />
          </div>
        </div>
      )}
    </div>
  )
}
