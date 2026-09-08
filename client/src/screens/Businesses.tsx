import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { exploreApi, type Business } from '../lib/api'
import { useI18n } from '../lib/i18n'

type Category = 'All' | 'Food' | 'Retail' | 'Travel' | 'Services'
const CATEGORIES: Category[] = ['All', 'Food', 'Retail', 'Travel', 'Services']
const CATEGORY_KEYS: Record<Category, string> = {
  All: 'businesses.all',
  Food: 'businesses.food',
  Retail: 'businesses.retail',
  Travel: 'businesses.travel',
  Services: 'businesses.services',
}

export default function Businesses() {
  const navigate = useNavigate()
  const { t } = useI18n()
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
          <h3>{t('businesses.merchantPos')}</h3>
          <div className="card">
            <div className="kv"><span>{t('businesses.category')}</span><b>{selected.category}</b></div>
            <div className="kv"><span>{t('businesses.area')}</span><b>{selected.area}</b></div>
            <div className="kv"><span>{t('businesses.acceptsHas')}</span><b style={{ color: selected.acceptsHAS ? 'var(--ok)' : 'var(--muted)' }}>{selected.acceptsHAS ? t('common.yes') : t('businesses.doesNotAccept')}</b></div>
            <div className="kv"><span>{t('businesses.kybStatus')}</span><b style={{ color: selected.pos.kybStatus === 'verified' ? 'var(--ok)' : selected.pos.kybStatus === 'pending' ? 'var(--warn)' : 'var(--muted)' }}>{selected.pos.kybStatus}</b></div>
          </div>
        </div>
        {selected.acceptsHAS && (
          <div className="pad sec">
            <h3>{t('businesses.todaysSales')}</h3>
            <div className="card">
              <div className="kv"><span>{t('businesses.salesToday')}</span><b>{selected.pos.salesToday} HAS</b></div>
              <div className="kv"><span>{t('businesses.transactions')}</span><b>{selected.pos.transactionsToday}</b></div>
              <div className="kv"><span>{t('businesses.settlementPref')}</span><b>{selected.pos.settlementPreference}</b></div>
              <div className="kv"><span>{t('businesses.nextSarSettlement')}</span><b>{selected.pos.nextSettlementSAR} SAR</b></div>
            </div>
            <p className="disc">{t('businesses.posDisc')}</p>
          </div>
        )}
        <div className="pad sec">
          <button className="btn gold" disabled={!selected.acceptsHAS} onClick={() => navigate('/pay')}>
            {selected.acceptsHAS ? t('businesses.payWithHas') : t('businesses.doesNotAccept')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <Header title={t('businesses.title')} right={<Shield />} />
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
            >{t(CATEGORY_KEYS[c])}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="card"><p className="muted">{t('businesses.noBusinesses')}</p></div>
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
                  <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>{t('businesses.hasYes')}</span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('businesses.noHas')}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
