/** Businesses directory — pilot mock. POS views are read-only. */

export interface Business {
  id: string
  name: string
  category: 'Food' | 'Retail' | 'Travel' | 'Services'
  area: string
  acceptsHAS: boolean
  pos: {
    salesToday: number
    transactionsToday: number
    settlementPreference: 'retain' | 'convert' | 'split'
    nextSettlementSAR: number
    kybStatus: 'verified' | 'pending' | 'not_started'
  }
}

const businesses: Business[] = [
  { id: 'b1', name: 'Cape Malay Kitchen', category: 'Food', area: 'Fordsburg', acceptsHAS: true, pos: { salesToday: 420, transactionsToday: 8, settlementPreference: 'convert', nextSettlementSAR: 336, kybStatus: 'verified' } },
  { id: 'b2', name: 'Halaal Butchery', category: 'Retail', area: 'Mayfair', acceptsHAS: true, pos: { salesToday: 180, transactionsToday: 4, settlementPreference: 'split', nextSettlementSAR: 144, kybStatus: 'verified' } },
  { id: 'b3', name: 'Safa Travel', category: 'Travel', area: 'Sandton', acceptsHAS: true, pos: { salesToday: 0, transactionsToday: 0, settlementPreference: 'convert', nextSettlementSAR: 0, kybStatus: 'pending' } },
  { id: 'b4', name: 'Al-Madina Books', category: 'Retail', area: 'Fordsburg', acceptsHAS: true, pos: { salesToday: 65, transactionsToday: 3, settlementPreference: 'retain', nextSettlementSAR: 0, kybStatus: 'verified' } },
  { id: 'b5', name: 'Rahma Pharmacy', category: 'Services', area: 'Brixton', acceptsHAS: false, pos: { salesToday: 0, transactionsToday: 0, settlementPreference: 'retain', nextSettlementSAR: 0, kybStatus: 'not_started' } },
  { id: 'b6', name: 'Karibu Restaurant', category: 'Food', area: 'Newtown', acceptsHAS: true, pos: { salesToday: 290, transactionsToday: 6, settlementPreference: 'split', nextSettlementSAR: 232, kybStatus: 'verified' } },
]

export function getBusinesses(): Business[] {
  return businesses.map((b) => ({ ...b, pos: { ...b.pos } }))
}

export function getBusiness(id: string): Business | null {
  const b = businesses.find((x) => x.id === id)
  return b ? { ...b, pos: { ...b.pos } } : null
}
