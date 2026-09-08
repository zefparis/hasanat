import Overlay from '../components/Overlay'

export default function Learn() {
  return (
    <Overlay title="Learn" subtitle="Qur'an, courses, badges">
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="star" style={{ width: 90, height: 90, background: 'var(--accent)', margin: '0 auto 14px' }} />
        <b style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>Qur'an progress</b>
        <p className="muted" style={{ marginTop: 4 }}>Read-only tracking · Juz 5 of 30</p>
        <div className="bar"><i style={{ width: '17%' }} /></div>
      </div>
      <div className="sec">
        <h3>Courses</h3>
        <div className="card">
          <div className="kv"><span>Foundations of Salah</span><b>40%</b></div>
          <div className="bar"><i style={{ width: '40%' }} /></div>
          <div className="kv" style={{ marginTop: 12 }}><span>Zakat in practice</span><b>100%</b></div>
          <div className="bar"><i style={{ width: '100%' }} /></div>
        </div>
      </div>
      <div className="sec">
        <h3>Badges</h3>
        <div className="chips">
          <span className="pill green">First Sadaqah</span>
          <span className="pill">7-day streak</span>
          <span className="pill grey">Hajj guide 🔒</span>
        </div>
      </div>
      <p className="disc">
        Points are recognition only. They never represent a divine reward or ranking.
      </p>
    </Overlay>
  )
}
