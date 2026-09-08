import Header from '../components/Header'

export default function Give() {
  return (
    <div className="screen">
      <Header title="Give" themeToggle />
      <div className="pad sec">
        <h3>Zakat calculator</h3>
        <div className="card">
          <div className="kv"><span>Cash & bank</span><b>12,000 SAR</b></div>
          <div className="kv"><span>Gold (value)</span><b>8,500 SAR</b></div>
          <div className="kv"><span>Business assets</span><b>20,000 SAR</b></div>
          <div className="kv"><span>Debts</span><b>-1,500 SAR</b></div>
          <div className="kv"><span>Nisab (85g gold)</span><b>21,000 SAR</b></div>
          <div className="kv"><span>Zakat due (2.5%)</span><b style={{ color: 'var(--primary-2)' }}>1,012.50 SAR</b></div>
        </div>
        <button className="btn" style={{ marginTop: 12 }}>Pay Zakat</button>
      </div>
      <div className="pad sec">
        <h3>Sadaqah</h3>
        <div className="card">
          <div className="chips">
            <button className="chip on">10</button>
            <button className="chip">25</button>
            <button className="chip">50</button>
            <button className="chip">100</button>
          </div>
          <div className="bar"><i className="gold" style={{ width: '62%' }} /></div>
          <p className="muted" style={{ marginTop: 8 }}>Water wells campaign · 62% · amount stays private</p>
          <button className="btn gold" style={{ marginTop: 12 }}>Give 10 HAS</button>
        </div>
      </div>
      <div className="pad sec">
        <h3>Waqf</h3>
        <div className="card">
          <p className="muted">A restricted dedicated account with beneficiary rules. Contributions are held for long-term endowment, not spent.</p>
          <button className="btn ghost" style={{ marginTop: 12 }}>Open Waqf</button>
        </div>
      </div>
    </div>
  )
}
