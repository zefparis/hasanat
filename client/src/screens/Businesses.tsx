import Overlay from '../components/Overlay'

const cats = ['All', 'Food', 'Retail', 'Travel', 'Services']
const merchants = [
  { name: 'Cape Malay Kitchen', cat: 'Food', status: 'KYB verified' },
  { name: 'Desert Threads', cat: 'Retail', status: 'KYB verified' },
  { name: 'Hajj & Umrah Travel', cat: 'Travel', status: 'KYB pending' },
]

export default function Businesses() {
  return (
    <Overlay title="Businesses" subtitle="Directory · pay · merchant POS">
      <div className="chips">
        {cats.map((c, i) => (
          <button key={c} className={`chip ${i === 0 ? 'on' : ''}`}>{c}</button>
        ))}
      </div>
      <div className="sec">
        <div className="card">
          {merchants.map((m) => (
            <div className="item" key={m.name}>
              <div className="ic">🏪</div>
              <div className="tx"><b>{m.name}</b><span>{m.cat} · {m.status}</span></div>
              <button className="chip on">Pay</button>
            </div>
          ))}
        </div>
      </div>
      <div className="sec">
        <h3>Merchant POS — Cape Malay Kitchen</h3>
        <div className="card">
          <div className="kv"><span>Sales today</span><b>1,840 HAS</b></div>
          <div className="kv"><span>Transactions</span><b>34</b></div>
          <div className="kv"><span>Settlement preference</span><b>Split 20/80</b></div>
          <div className="kv"><span>Next SAR settlement</span><b>Fri 12 Sep</b></div>
          <div className="kv"><span>KYB status</span><b style={{ color: 'var(--ok)' }}>Verified</b></div>
        </div>
      </div>
    </Overlay>
  )
}
