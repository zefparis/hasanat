import { useState } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { ApiError } from '../lib/api'
import type { LedgerEntry } from '../lib/api'

type Tab = 'main' | 'buy' | 'send' | 'receive' | 'redeem'

const contacts = [
  { name: 'Aisha', initial: 'A' },
  { name: 'Yusuf', initial: 'Y' },
  { name: 'Fatima', initial: 'F' },
  { name: 'Omar', initial: 'O' },
]

const LEDGER_LABELS: Record<string, string> = {
  reserve: 'reserve', settlement: 'settlement', charitable: 'charitable', reward: 'reward', send: 'send',
}

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

function toCSV(entries: LedgerEntry[]): string {
  const rows = [['Date', 'Description', 'Label', 'Amount', 'Unit', 'Receipt'].join(',')]
  for (const e of entries) {
    rows.push([fmtDate(e.ts), `"${e.description}"`, e.label, e.amount, e.unit, e.receiptNo ?? ''].join(','))
  }
  return rows.join('\n')
}

function toPDF(entries: LedgerEntry[]): string {
  const lines = entries.map((e) => `${fmtDate(e.ts)}  ${e.description}  ${e.label}  ${e.amount > 0 ? '+' : ''}${e.amount} ${e.unit}`)
  const text = ['Hasanat - Activity Statement', `Generated ${new Date().toLocaleString('en-GB')}`, '', ...lines].join('\n')
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
  const [tab, setTab] = useState<Tab>('main')
  const [buyAmt, setBuyAmt] = useState('')
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [sendAmt, setSendAmt] = useState('')

  function doBuy() {
    const sar = Number(buyAmt)
    if (!sar || sar <= 0) { toast('Enter a valid amount'); return }
    buy(sar).then(() => { toast(`Bought ${sar} HAS`); setBuyAmt(''); setTab('main') }).catch((e) => toast(e instanceof ApiError ? e.message : 'Buy failed'))
  }

  function doSend() {
    const amt = Number(sendAmt)
    if (!selectedContact) { toast('Choose a contact'); return }
    if (!amt || amt <= 0) { toast('Enter a valid amount'); return }
    if (wallet && amt > wallet.balance) { toast('Insufficient balance'); return }
    send(selectedContact, amt).then(() => { toast(`Sent ${amt} HAS to ${selectedContact}`); setSendAmt(''); setSelectedContact(null); setTab('main') }).catch((e) => toast(e instanceof ApiError ? e.message : 'Send failed'))
  }

  function doReceive() {
    toast('Simulating incoming payment...')
    setTimeout(() => {
      receive(150).then(() => toast('Received 150 HAS (mock)')).catch(() => toast('Receive failed'))
    }, 1500)
  }

  function exportCSV() { downloadFile('hasanat-activity.csv', toCSV(entries), 'text/csv'); toast('CSV exported') }
  function exportPDF() { downloadFile('hasanat-activity.pdf', toPDF(entries), 'application/pdf'); toast('PDF exported') }

  if (!wallet) {
    return <div className="screen"><Header title="Wallet" dark /><div className="pad" style={{ marginTop: 20 }}><p className="muted">Loading wallet...</p></div></div>
  }

  return (
    <div className="screen">
      <div className="whero">
        <Header title="Wallet" dark right={<Shield />} />
        <div className="num">{wallet.balance.toLocaleString()}<small>HAS</small></div>
        <div className="eq">= {wallet.balance.toLocaleString()}.00 SAR{wallet.mockLedger ? ' - pilot mock ledger' : ' - backed 1:1 by reserve'}</div>
        <div className="res"><i /> {wallet.mockLedger ? 'Mock mode - no real backing' : 'Real backing received'}</div>
      </div>

      <div className="wacts">
        <button onClick={() => setTab('buy')}><span>Buy</span></button>
        <button onClick={() => setTab('send')}><span>Send</span></button>
        <button onClick={() => setTab('receive')}><span>Receive</span></button>
        <button onClick={() => setTab('redeem')}><span>Redeem</span></button>
      </div>

      {tab === 'main' && (
        <>
          <div className="pad sec">
            <h3>Points</h3>
            <div className="card">
              <div className="pcard">
                <div className="star ps" style={{ width: 48, height: 48, background: 'var(--accent)' }} />
                <div><b>{wallet.points}</b><span>Recognition only - never cash</span></div>
              </div>
            </div>
          </div>
          <div className="pad sec">
            <h3>Activity <span style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportCSV} style={{ fontSize: 12, color: 'var(--primary-2)', fontWeight: 500 }}>CSV</button>
              <button onClick={exportPDF} style={{ fontSize: 12, color: 'var(--primary-2)', fontWeight: 500 }}>PDF</button>
            </span></h3>
            <div className="card">
              {entries.length === 0 && <p className="muted">No activity yet.</p>}
              {entries.map((e) => (
                <div className="item" key={e.id}>
                  <div className="ic">{e.amount > 0 ? '↙' : '↗'}</div>
                  <div className="tx"><b>{e.description}</b><span>{LEDGER_LABELS[e.label]} · {fmtDate(e.ts)}</span></div>
                  <div className={`amt ${e.amount > 0 ? 'in' : ''}`}>{e.amount > 0 ? '+' : ''}{e.amount}<small>{e.unit}</small></div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'buy' && (
        <div className="pad sec">
          <h3>Buy HAS</h3>
          <div className="card">
            <div className="field">
              <label>Amount in SAR (1 SAR = 1 HAS)</label>
              <input inputMode="decimal" placeholder="100" value={buyAmt} onChange={(e) => setBuyAmt(e.target.value)} />
            </div>
            <button className="btn" style={{ marginTop: 16 }} onClick={doBuy}>Buy {buyAmt || '0'} HAS</button>
            <p className="disc">{wallet.mockLedger ? 'Pilot mock: no real backing moves. The ledger entry is recorded locally for the demo.' : 'Emission is backed 1:1 by real reserve received. Each buy creates a reserve ledger entry.'}</p>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setTab('main')}>Back</button>
          </div>
        </div>
      )}

      {tab === 'send' && (
        <div className="pad sec">
          <h3>Send HAS</h3>
          <div className="card">
            <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--muted)', marginBottom: 8, display: 'block' }}>Choose contact</label>
            <div className="contacts" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 0 8px' }}>
              {contacts.map((c) => (
                <button key={c.name} onClick={() => setSelectedContact(c.name)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 12, minWidth: 64 }}>
                  <div className="cav" style={{ width: 54, height: 54, borderRadius: '50%', background: selectedContact === c.name ? 'var(--accent-soft)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--primary-2)', border: `2px solid ${selectedContact === c.name ? 'var(--accent)' : 'transparent'}` }}>{c.initial}</div>
                  {c.name}
                </button>
              ))}
            </div>
            <div className="field">
              <label>Amount (HAS) - balance: {wallet.balance}</label>
              <input inputMode="decimal" placeholder="50" value={sendAmt} onChange={(e) => setSendAmt(e.target.value)} />
            </div>
            <div className="row" style={{ marginTop: 12, fontSize: 13 }}>
              <span className="muted">Review</span>
              <b>{selectedContact ? `${sendAmt || '0'} HAS -> ${selectedContact}` : 'Select a contact'}</b>
            </div>
            <button className="btn" style={{ marginTop: 12 }} onClick={doSend} disabled={!selectedContact || !sendAmt || (wallet ? Number(sendAmt) > wallet.balance : true)}>Confirm send</button>
            {wallet && sendAmt && Number(sendAmt) > wallet.balance && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>Insufficient balance - review disabled.</p>}
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setTab('main')}>Back</button>
          </div>
        </div>
      )}

      {tab === 'receive' && (
        <div className="pad sec">
          <h3>Receive</h3>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="qrbig" style={{ width: 180, height: 180, margin: '0 auto 14px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(13,1fr)', gap: 2 }}>
              {Array.from({ length: 169 }).map((_, i) => (
                <b key={i} className={Math.random() > 0.5 ? '' : 'o'} style={{ background: Math.random() > 0.5 ? 'var(--ink)' : 'transparent', borderRadius: 1 }} />
              ))}
            </div>
            <b style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>hasanat:ben_8f3a2c</b>
            <p className="muted" style={{ marginTop: 4 }}>Your receive address</p>
            <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => { navigator.clipboard?.writeText('hasanat:ben_8f3a2c'); toast('Payment link copied') }}>Copy payment link</button>
            <button className="btn" style={{ marginTop: 10 }} onClick={doReceive}>Simulate incoming payment</button>
            <p className="disc">The simulate button is an explicit mock - no real payment arrives. It credits 150 HAS after a short delay for the demo.</p>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setTab('main')}>Back</button>
          </div>
        </div>
      )}

      {tab === 'redeem' && (
        <div className="pad sec">
          <h3>Redeem HAS to SAR</h3>
          <div className="card">
            <p className="muted">Redemption converts HAS to SAR via a regulated partner. Settlement typically takes 1-2 business days and requires KYC verification on the partner side.</p>
            <div className="kv" style={{ marginTop: 12 }}><span>Available</span><b>{wallet.balance} HAS</b></div>
            <div className="kv"><span>Rate</span><b>1 HAS = 1 SAR</b></div>
            <div className="kv"><span>Partner</span><b>Regulated (mock)</b></div>
            <button className="btn" style={{ marginTop: 12 }} disabled>Request redemption</button>
            <p className="disc">No real banking integration at this stage. The button is disabled in the pilot.</p>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setTab('main')}>Back</button>
          </div>
        </div>
      )}
    </div>
  )
}
