import { useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import HoldToVerify from '../components/HoldToVerify'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'

type Stage = 'scan' | 'confirm' | 'receipt'

const MERCHANT = 'Cape Malay Kitchen'
const BILL = 85
const FEE = 1.5

type Settlement = 'retain' | 'convert' | 'split'

export default function Pay() {
  const { pay, state: wallet } = useWallet()
  const { toast } = useToast()
  const { status, isStale, signIn } = useAuth()
  const { t } = useI18n()
  const [stage, setStage] = useState<Stage>('scan')
  const [cameraOk, setCameraOk] = useState<boolean | null>(null)
  const [settlement, setSettlement] = useState<Settlement>('retain')
  const [receipt, setReceipt] = useState<{ no?: string; merchantReceives: number } | null>(null)
  const [paying, setPaying] = useState(false)
  const [gating, setGating] = useState(false)
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

  async function doPay() {
    if (!wallet || wallet.balance < BILL + FEE) { toast(t('pay.toastInsufficient')); return }
    setPaying(true)
    try {
      const res = await pay(MERCHANT, BILL, FEE, settlement)
      setReceipt({ no: res.receiptNo, merchantReceives: res.merchantReceives })
      setStage('receipt')
      if (navigator.vibrate) navigator.vibrate([30, 40, 30])
    } catch {
      toast(t('pay.toastPaymentFailed'))
    } finally {
      setPaying(false)
    }
  }

  async function confirmPay() {
    // Re-verify hold-to-verify if the last verification is stale.
    if (isStale()) { setGating(true); return }
    void doPay()
  }

  function onReverified(res: Parameters<typeof signIn>[0]) {
    signIn(res)
    setGating(false)
    void doPay()
  }

  const balanceAfter = wallet ? wallet.balance - BILL - FEE : 0

  return (
    <div className="screen">
      <Header title={t('pay.title')} />
      <div style={{ padding: '0 18px' }}>
        <Shield />
      </div>

      {stage === 'scan' && (
        <>
          <div className="scan" style={{ margin: '8px 18px 0', background: '#0B1410', borderRadius: 22, aspectRatio: '1 / 1.05', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {cameraOk === null && <p style={{ color: 'var(--muted)', fontSize: 13 }}>{t('pay.startingCamera')}</p>}
            {cameraOk === false && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>{t('pay.cameraDenied')}</p>
                <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8, opacity: 0.7 }}>{t('pay.cameraSimulate')}</p>
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
            <p className="muted" style={{ textAlign: 'center' }}>{t('pay.pointCamera')}</p>
            <button className="btn gold" style={{ marginTop: 16 }} onClick={simulateScan}>{t('pay.simulateScan')}</button>
            <p className="disc">{t('pay.simulateDisc')}</p>
          </div>
        </>
      )}

      {stage === 'confirm' && (
        <div className="pad sec">
          <h3>{t('pay.confirmPayment')}</h3>
          <div className="card">
            <div className="kv"><span>{t('pay.merchant')}</span><b>{MERCHANT}</b></div>
            <div className="kv"><span>{t('pay.bill')}</span><b>{BILL} HAS</b></div>
            <div className="kv"><span>{t('pay.fee')}</span><b>{FEE} HAS</b></div>
            <div className="kv"><span>{t('pay.balanceAfter')}</span><b style={{ color: balanceAfter < 0 ? 'var(--danger)' : 'var(--ink)' }}>{balanceAfter} HAS</b></div>
            <div className="kv"><span>{t('pay.hcsSession')}</span><b>{t('pay.hcsSession')}{status?.isHuman ? ` ${t('pay.verified')}` : ''}</b></div>
            <div className="kv"><span>{t('pay.deviceBiometrics')}</span><b>{t('pay.faceId')}</b></div>
          </div>
          <div className="sec">
            <h3>{t('pay.merchantSettlement')}</h3>
            <div className="card">
              <div className="tabs" style={{ marginBottom: 12 }}>
                <button className={settlement === 'retain' ? 'on' : ''} onClick={() => setSettlement('retain')}>{t('pay.retainHas')}</button>
                <button className={settlement === 'convert' ? 'on' : ''} onClick={() => setSettlement('convert')}>{t('pay.convertSar')}</button>
                <button className={settlement === 'split' ? 'on' : ''} onClick={() => setSettlement('split')}>{t('pay.split')}</button>
              </div>
              <div className="kv"><span>{t('pay.merchantReceives')}</span><b>{merchantReceivesFor(settlement)} {settlement === 'convert' ? 'SAR' : 'HAS'}</b></div>
              {settlement === 'split' && <p className="disc">{t('pay.splitDisc')}</p>}
            </div>
          </div>
          <button className="btn gold" style={{ marginTop: 16 }} onClick={confirmPay} disabled={paying || (wallet ? wallet.balance < BILL + FEE : true)}>
            {paying ? t('pay.authorising') : t('pay.payButton', { amt: BILL + FEE })}
          </button>
          {wallet && wallet.balance < BILL + FEE && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{t('pay.insufficient')}</p>}
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setStage('scan')}>{t('common.back')}</button>
        </div>
      )}

      {stage === 'receipt' && receipt && (
        <div className="pad sec">
          <h3>{t('pay.receipt')}</h3>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="star" style={{ width: 56, height: 56, background: 'var(--ok)', margin: '0 auto 14px' }} />
            <b style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>{t('pay.paymentRecorded')}</b>
            <p className="muted" style={{ marginTop: 4 }}>{MERCHANT}</p>
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="kv"><span>{t('pay.receiptNo')}</span><b>{receipt.no ?? '—'}</b></div>
            <div className="kv"><span>{t('pay.amount')}</span><b>{BILL + FEE} HAS</b></div>
            <div className="kv"><span>{t('pay.settlement')}</span><b>{settlement}</b></div>
            <div className="kv"><span>{t('pay.merchantReceives')}</span><b>{receipt.merchantReceives} {settlement === 'convert' ? 'SAR' : 'HAS'}</b></div>
            <div className="kv"><span>{t('pay.ledger')}</span><b>settlement</b></div>
          </div>
          <p className="disc">
            {wallet?.mockLedger
              ? t('pay.mockReceiptDisc')
              : t('pay.realReceiptDisc')}
          </p>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => setStage('scan')}>{t('common.done')}</button>
        </div>
      )}

      {gating && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--bg)', color: 'var(--ink)', borderRadius: '28px 28px 0 0', padding: '22px 20px calc(env(safe-area-inset-bottom) + 28px)', width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '90dvh', overflowY: 'auto' }}>
            <HoldToVerify
              onSuccess={onReverified}
              onCancel={() => setGating(false)}
              title={t('pay.reverifyPayTitle')}
              subtitle={t('pay.reverifyPaySub')}
              cancelLabel={t('pay.cancelPayment')}
            />
          </div>
        </div>
      )}
    </div>
  )
}
