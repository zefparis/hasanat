import Header from '../components/Header'
import Shield from '../components/Shield'
import { User, Scan, Send, Book, Compass } from '../components/icons'
import { useTheme } from '../lib/theme'

export default function Home() {
  const { theme, toggle } = useTheme()
  return (
    <div className="screen">
      <Header
        title="Hasanat"
        right={
          <>
            <Shield />
            <button className="ibtn" onClick={toggle} aria-label="Toggle day/night">
              {theme === 'day' ? '☾' : '☀'}
            </button>
            <button className="av-btn" aria-label="Profile" onClick={() => (window.location.hash = '#/profile')}>B</button>
          </>
        }
      />
      <div className="greet">
        <div style={{ fontFamily: 'var(--ar)', fontSize: 22, color: 'var(--accent)' }}>السلام عليكم</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 500, lineHeight: 1.15, marginTop: 2 }}>
          Assalamu alaikum, Ben
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
          Tuesday, 15 Safar 1448 · 8 Sep 2026
        </div>
      </div>

      <div className="pchip">
        <div>
          <b>Next prayer — Dhuhr</b>
          <span>in 1h 12m</span>
        </div>
        <div className="cnt">01:12:34</div>
      </div>

      <div className="balance">
        <div className="star bgstar" style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, background: 'rgba(255,255,255,0.07)' }} />
        <div className="lbl">Hasanat balance</div>
        <div className="num">1,250<small>HAS</small></div>
        <div className="sub">≈ 1,250.00 SAR · backed 1:1 by reserve</div>
        <div className="split">
          <div><b>320</b><span>Points</span></div>
          <div><b>45</b><span>Given this month</span></div>
        </div>
      </div>

      <div className="qa">
        <button><Scan /><span>Pay</span></button>
        <button><Send /><span>Send</span></button>
        <button><Book /><span>Learn</span></button>
        <button><Compass /><span>Prayer</span></button>
      </div>

      <div className="pad sec">
        <h3>Today's actions</h3>
        <div className="card">
          <div className="act"><span className="cb" /> <div className="tx"><b>Fajr presence</b><span>Check-in window open</span></div><div className="pts">+10</div></div>
          <div className="act"><span className="cb" /> <div className="tx"><b>Read 1 page of Qur'an</b><span>Daily habit</span></div><div className="pts">+5</div></div>
          <div className="act"><span className="cb" /> <div className="tx"><b>Voluntary log</b><span>Approved in Hasanat AI</span></div><div className="pts">+40</div></div>
        </div>
      </div>

      <div className="pad sec">
        <h3>Explore</h3>
        <div className="explore">
          <button><User /><b>Hasanat AI</b><span>Ask about prayer, Zakat, giving</span></button>
          <button><Send /><b>Give</b><span>Zakat, Sadaqah, Waqf</span></button>
          <button><Scan /><b>Mosques</b><span>Nearby, donate, institution wallet</span></button>
          <button><Book /><b>Businesses</b><span>Directory, pay, merchant POS</span></button>
        </div>
      </div>
    </div>
  )
}
