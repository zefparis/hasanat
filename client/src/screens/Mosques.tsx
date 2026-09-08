import Overlay from '../components/Overlay'

const mosques = [
  { name: 'Johannesburg Central Masjid', area: 'Fordsburg', dist: '0.8 km' },
  { name: 'Mayfair Jame Masjid', area: 'Mayfair', dist: '1.4 km' },
  { name: 'Brixton Masjid', area: 'Brixton', dist: '2.1 km' },
]

export default function Mosques() {
  return (
    <Overlay title="Mosques" subtitle="Nearby · donate · institution wallet">
      <div className="card">
        {mosques.map((m) => (
          <div className="item" key={m.name}>
            <div className="ic">🕌</div>
            <div className="tx"><b>{m.name}</b><span>{m.area} · {m.dist}</span></div>
            <button className="chip on">Give 25</button>
          </div>
        ))}
      </div>
      <div className="sec">
        <h3>Institution wallet — Johannesburg Central</h3>
        <div className="card">
          <div className="kv"><span>General fund</span><b>4,200 HAS</b></div>
          <div className="kv"><span>Sadaqah</span><b>1,150 HAS</b></div>
          <div className="kv"><span>Zakat (restricted)</span><b>980 HAS</b></div>
          <div className="kv"><span>Approvals pending</span><b>2 of 3</b></div>
          <p className="disc">Signatory threshold 2 of 3 for restricted funds.</p>
        </div>
      </div>
    </Overlay>
  )
}
