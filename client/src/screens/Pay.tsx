import { useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/auth'

type Stage = 'scan' | 'confirm' | 'receipt'

const MERCHANT = 'Cape Malay Kitchen'
const BILL = 85
const FEE = 1.5

type Settlement = 'retain' | 'convert' | 'split'

export default function Pay() {
  const { pay, state: wallet } = useWallet()
  const { toast } = useToast()
  const { status } = useAuth()
  const [stage, setStage] = useState<Stage>('scan')
  const [cameraOk, setCameraOk] = useState<boolean | null>(null)
  const [settlement, setSettlement] = useState<Settlement>('retain')
  const [receipt, setReceipt] = useState<{ no?: string; merchantReceives: number } | null>(null)
  const [paying, setPaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLineRef = useRef<number | null>(null)

  // Start the real camera for QR scanning.
  useEffect(() => {
    if (stage !== 'scan') return
    let cancelled = false
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
        setCameraOk(true)
      } catch {
        setCameraOk(false)
      }
    }
    void startCamera()
    return () => {
      cancelled = true
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
      if (scanLineRef.current) cancelAnimationFrame(scanLineRef.current)
    }
  }, [stage])

  // Animated scan line (cosmetic only; real QR decode would use a library).
  useEffect(() => {
    if (stage !== 'scan' || !cameraOk) return
    const line = document.getElementById('scanline')
    if (!line) return
    let y = 0
    let dir = 1
    const tick = () => {
      y += dir * 2
      if (y > 100 || y < 0) dir *= -1
      line.style.transform = `translateY(${y}%)`
      scanLineRef.current = requestAnimationFrame(tick)
    }
    scanLineRef.current = requestAnimationFrame(tick)
    return () => { if (scanLineRef.current) cancelAnimationFrame(scanLineRef.current) }
  }, [stage, cameraOk])

  function simulateScan() {
    // For the pilot: no real QR decoder lib. The "simulate scan" button stands in.
    // In production this would be the result of decoding a merchant QR frame.
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    setStage('confirm')
  }

  function merchantReceivesFor(s: Settlement): number {
    if (s === 'retain') return BILL
    if (s === 'convert') return BILL
    return Math.round(BILL * 0.8 * 100) / 100 // split 20-80: merchant gets 80%
  }

  async function confirmPay() {
    if (!wallet || wallet.balance < BILL + FEE) { toast('Insufficient balance'); return }
    setPaying(true)
    try {
      const res = await pay(MERCHANT, BILL, FEE, settlement)
      setReceipt({ no: res.receiptNo, merchantReceives: res.merchantReceives })
      setStage('receipt')
      if (navigator.vibrate) navigator.vibrate([30, 40, 30])
    } catch {
      toast('Payment failed')
    } finally {
      setPaying(false)
    }
  }

  const balanceAfter = wallet ? wallet.balance - BILL - FEE : 0

  return (
    <div className="screen">
      <Header title="Pay" />
      <div style={{ padding: '0 18px' }}>
        <Shield />
      </div>

      {stage === 'scan' && (
        <>
          <div className="scan" style={{ margin: '8px 18px 0', background: 'var(--ink)', borderRadius: 22, aspectRatio: '1 / 1.05', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {cameraOk === null && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Starting camera...</p>}
            {cameraOk === false && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>Camera unavailable or permission denied.</p>
                <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8, opacity: 0.7 }}>You can still simulate a scan for the demo.</p>
              </div>
            )}
            {cameraOk && (
              <>
                <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div className="frame" style={{ width: '64%', aspectRatio: '1', position: 'absolute' }}>
                  <div id="scanline" style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, width: 28, height: 28, borderTop: '3px solid var(--accent)', borderLeft: '3px solid var(--accent)', borderRadius: 4 }} />
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 28, height: 28, borderTop: '3px solid var(--accent)', borderRight: '3px solid var(--accent)', borderRadius: 4 }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: 28, height: 28, borderBottom: '3px solid var(--accent)', borderLeft: '3px solid var(--accent)', borderRadius: 4 }} />
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderBottom: '3px solid var(--accent)', borderRight: '3px solid var(--accent)', borderRadius: 4 }} />
                </div>
              </>
            )}
          </div>
          <div className="pad sec">
            <p className="muted" style={{ textAlign: 'center' }}>Point the camera at a merchant QR code to pay with HAS.</p>
            <button className="btn gold" style={{ marginTop: 16 }} onClick={simulateScan}>Simulate scan</button>
            <p className="disc">The pilot uses a simulate button instead of a real QR decoder. The camera stream is real (requires permission), the decode is not.</p>
          </div>
        </>
      )}

      {stage === 'confirm' && (
        <div className="pad sec">
          <h3>Confirm payment</h3>
          <div className="card">
            <div className="kv"><span>Merchant</span><b>{MERCHANT}</b></div>
            <div className="kv"><span>Bill</span><b>{BILL} HAS</b></div>
            <div className="kv"><span>Fee</span><b>{FEE} HAS</b></div>
            <div className="kv"><span>Balance after</span><b style={{ color: balanceAfter < 0 ? 'var(--danger)' : 'var(--ink)' }}>{balanceAfter} HAS</b></div>
            <div className="kv"><span>Authorisation</span><b>HCS-U7 session{status?.isHuman ? ' (verified)' : ''}</b></div>
            <div className="kv"><span>Device biometrics</span><b>Face ID / Touch ID</b></div>
          </div>
          <div className="sec">
            <h3>Merchant settlement</h3>
            <div className="card">
              <div className="tabs" style={{ marginBottom: 12 }}>
                <button className={settlement === 'retain' ? 'on' : ''} onClick={() => setSettlement('retain')}>Retain HAS</button>
                <button className={settlement === 'convert' ? 'on' : ''} onClick={() => setSettlement('convert')}>Convert SAR</button>
                <button className={settlement === 'split' ? 'on' : ''} onClick={() => setSettlement('split')}>Split 20/80</button>
              </div>
              <div className="kv"><span>Merchant receives</span><b>{merchantReceivesFor(settlement)} {settlement === 'convert' ? 'SAR' : 'HAS'}</b></div>
              {settlement === 'split' && <p className="disc">Split: 80% to merchant in SAR, 20% retained as HAS.</p>}
            </div>
          </div>
          <button className="btn gold" style={{ marginTop: 16 }} onClick={confirmPay} disabled={paying || (wallet ? wallet.balance < BILL + FEE : true)}>
            {paying ? 'Authorising...' : `Pay ${BILL + FEE} HAS`}
          </button>
          {wallet && wallet.balance < BILL + FEE && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>Insufficient balance.</p>}
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setStage('scan')}>Back</button>
        </div>
      )}

      {stage === 'receipt' && receipt && (
        <div className="pad sec">
          <h3>Receipt</h3>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="star" style={{ width: 56, height: 56, background: 'var(--ok)', margin: '0 auto 14px' }} />
            <b style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>Payment recorded</b>
            <p className="muted" style={{ marginTop: 4 }}>{MERCHANT}</p>
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="kv"><span>Receipt no.</span><b>{receipt.no ?? '—'}</b></div>
            <div className="kv"><span>Amount</span><b>{BILL + FEE} HAS</b></div>
            <div className="kv"><span>Settlement</span><b>{settlement}</b></div>
            <div className="kv"><span>Merchant receives</span><b>{receipt.merchantReceives} {settlement === 'convert' ? 'SAR' : 'HAS'}</b></div>
            <div className="kv"><span>Ledger</span><b>settlement</b></div>
          </div>
          <p className="disc">
            {wallet?.mockLedger
              ? 'Pilot mock ledger: the receipt is recorded locally, not on a real chain. No blockchain confirmation is shown because none exists behind this pilot.'
              : 'Receipt recorded on the ledger.'}
          </p>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => setStage('scan')}>Done</button>
        </div>
      )}
    </div>
  )
}
