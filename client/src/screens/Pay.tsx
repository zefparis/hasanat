import Header from '../components/Header'
import { Scan } from '../components/icons'

export default function Pay() {
  return (
    <div className="screen">
      <Header title="Pay" />
      <div className="scan">
        <div className="frame">
          <Scan style={{ width: 120, height: 120, stroke: '#E8D7B0' }} />
        </div>
      </div>
      <div className="pad sec">
        <p className="muted" style={{ textAlign: 'center' }}>Point the camera at a merchant QR code to pay with HAS.</p>
        <button className="btn gold" style={{ marginTop: 16 }}>Simulate scan</button>
        <p className="disc">
          On confirm you'll see the bill, fees, balance after, HCS-U7 authorization and device biometrics. The receipt
          shows a chain confirmation number and ledger entry. Merchant settlement can retain HAS, convert to SAR, or
          split 20/80.
        </p>
      </div>
    </div>
  )
}
