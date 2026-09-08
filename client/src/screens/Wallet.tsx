import Header from '../components/Header'

export default function Wallet() {
  return (
    <div className="screen">
      <div className="whero">
        <Header title="Wallet" dark />
        <div className="num">1,250<small>HAS</small></div>
        <div className="eq">≈ 1,250.00 SAR · backed 1:1 by reserve</div>
        <div className="res"><i /> Real backing received</div>
      </div>
      <div className="wacts">
        <button><span>Buy</span></button>
        <button><span>Send</span></button>
        <button><span>Receive</span></button>
        <button><span>Redeem</span></button>
      </div>
      <div className="pad sec">
        <h3>Points</h3>
        <div className="card">
          <div className="pcard">
            <div className="star ps" style={{ width: 48, height: 48, background: 'var(--accent)' }} />
            <div><b>320</b><span>Recognition only — never cash</span></div>
          </div>
        </div>
      </div>
      <div className="pad sec">
        <h3>Activity</h3>
        <div className="card">
          <div className="item"><div className="ic">↗</div><div className="tx"><b>Sent to Aisha</b><span>settlement · today</span></div><div className="amt">-50<small>HAS</small></div></div>
          <div className="item"><div className="ic">↙</div><div className="tx"><b>Received</b><span>reserve · today</span></div><div className="amt in">+200<small>HAS</small></div></div>
          <div className="item"><div className="ic">★</div><div className="tx"><b>Fajr presence</b><span>reward · today</span></div><div className="amt in">+10<small>pts</small></div></div>
        </div>
      </div>
    </div>
  )
}
