import Overlay from '../components/Overlay'
import { Compass } from '../components/icons'

const prayers = [
  { name: 'Fajr', time: '04:42', next: false },
  { name: 'Sunrise', time: '06:04', next: false },
  { name: 'Dhuhr', time: '11:48', next: true },
  { name: 'Asr', time: '15:24', next: false },
  { name: 'Maghrib', time: '17:32', next: false },
  { name: 'Isha', time: '18:54', next: false },
]

export default function Prayer() {
  return (
    <Overlay title="Prayer" subtitle="Hasanat Life">
      <div className="card">
        <div className="row">
          <div><b style={{ fontSize: 16 }}>Next: Dhuhr</b><div className="muted">in 1h 12m</div></div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--primary-2)' }}>01:12:34</div>
        </div>
      </div>

      <div className="sec">
        <h3>Today's times · Johannesburg</h3>
        <div className="card">
          {prayers.map((p) => (
            <div className="kv" key={p.name} style={p.next ? { color: 'var(--primary-2)' } : undefined}>
              <span>{p.name}</span><b>{p.time}{p.next ? '  ↑' : ''}</b>
            </div>
          ))}
          <p className="disc">Fajr/Isha at 18° · Asr standard (Hanafi shown).</p>
        </div>
      </div>

      <div className="sec">
        <h3>Qibla</h3>
        <div className="card" style={{ textAlign: 'center' }}>
          <Compass style={{ width: 64, height: 64, margin: '0 auto', color: 'var(--accent)' }} />
          <b style={{ display: 'block', marginTop: 8 }}>295° NE</b>
          <p className="muted">Follows device compass when available.</p>
        </div>
      </div>

      <div className="sec">
        <h3>Presence — check-in</h3>
        <div className="card">
          <p className="muted">Check-in window open for Fajr. Tap to record your presence.</p>
          <button className="btn" style={{ marginTop: 12 }}>Marquer comme fait</button>
          <p className="disc">
            This records a presence, not a verified prayer. HCS-U7 confirms the acting session is the verified human;
            it never judges the devotional act. One check-in per window, timestamped server-side, no retroactive catch-up.
          </p>
        </div>
      </div>

      <div className="sec">
        <h3>Private journal</h3>
        <div className="card">
          <p className="muted">Saved privately on your device only. Nothing is written to any chain. +10 Points per entry.</p>
        </div>
      </div>
    </Overlay>
  )
}
