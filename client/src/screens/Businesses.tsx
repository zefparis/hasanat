import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { exploreApi, type Business } from '../lib/api'

type Category = 'All' | 'Food' | 'Retail' | 'Travel' | 'Services'
const CATEGORIES: Category[] = ['All', 'Food', 'Retail', 'Travel', 'Services']

export default function Businesses() {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [filter, setFilter] = useState<Category>('All')
  const [selected, setSelected] = useState<Business | null>(null)

  useEffect(() => {
    exploreApi.businesses().then((b) => setBusinesses(b.businesses)).catch(() => {})
  }, [])

  const filtered = filter === 'All' ? businesses : businesses.filter((b) => b.category === filter)

  if (selected) {
    return (
      <div className="screen">
        <Header title={selected.name} left={<button className="ibtn" onClick={() => setSelected(null)}>‹</button>} right={<Shield />} />
        <div className="pad sec">
          <h3>Merchant POS</h3>
          <div className="card">
            <div className="kv"><span>Category</span><b>{selected.category}</b></div>
            <div className="kv"><span>Area</span><b>{selected.area}</b></div>
            <div className="kv"><span>Accepts HAS</span><b style={{ color: selected.acceptsHAS ? 'var(--ok)' : 'var(--muted)' }}>{selected.acceptsHAS ? 'Yes' : 'Not yet'}</b></div>
            <div className="kv"><span>KYB status</span><b style={{ color: selected.pos.kybStatus === 'verified' ? 'var(--ok)' : selected.pos.kybStatus === 'pending' ? 'var(--warn)' : 'var(--muted)' }}>{selected.pos.kybStatus}</b></div>
          </div>
        </div>
        {selected.acceptsHAS && (
          <div className="pad sec">
            <h3>Today's sales</h3>
            <div className="card">
              <div className="kv"><span>Sales today</span><b>{selected.pos.salesToday} HAS</b></div>
              <div className="kv"><span>Transactions</span><b>{selected.pos.transactionsToday}</b></div>
              <div className="kv"><span>Settlement preference</span><b>{selected.pos.settlementPreference}</b></div>
              <div className="kv"><span>Next SAR settlement</span><b>{selected.pos.nextSettlementSAR} SAR</b></div>
            </div>
            <p className="disc">Pilot mock POS data — no real merchant processing behind this view.</p>
          </div>
        )}
        <div className="pad sec">
          <button className="btn gold" disabled={!selected.acceptsHAS} onClick={() => navigate('/pay')}>
            {selected.acceptsHAS ? 'Pay with HAS' : 'Does not accept HAS yet'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <Header title="Businesses" right={<Shield />} />
      <div className="pad sec">
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto' }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{
                fontSize: 13, padding: '8px 16px', borderRadius: 20, whiteSpace: 'nowrap',
                border: '1.5px solid', borderColor: filter === c ? 'var(--primary-2)' : 'var(--line)',
                background: filter === c ? 'var(--primary)' : 'var(--surface)', color: filter === c ? '#fff' : 'var(--ink)',
                fontWeight: 500, cursor: 'pointer',
              }}
            >{c}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="card"><p className="muted">No businesses in this category.</p></div>
        ) : (
          filtered.map((b) => (
            <div className="card" key={b.id} style={{ marginTop: 8, cursor: 'pointer' }} onClick={() => setSelected(b)}>
              <div className="item">
                <div className="ic" style={{ fontSize: 22 }}>{b.category === 'Food' ? '🍽' : b.category === 'Retail' ? '🛍' : b.category === 'Travel' ? '✈' : '🔧'}</div>
                <div className="tx" style={{ flex: 1 }}>
                  <b style={{ fontSize: 15 }}>{b.name}</b>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{b.category} · {b.area}</span>
                </div>
                {b.acceptsHAS ? (
                  <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>HAS ✓</span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>No HAS</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
