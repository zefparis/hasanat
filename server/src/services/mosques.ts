/** Mosques data — pilot mock. Institution wallets are read-only views. */

export interface Mosque {
  id: string
  name: string
  area: string
  distanceKm: number
  jumuahTime: string
  institutionWallet: {
    general: number
    sadaqah: number
    zakat: number
    pendingApprovals: number
    signatoryThreshold: string // e.g. "2 of 3"
  }
}

const mosques: Mosque[] = [
  { id: 'm1', name: 'Masjid Al-Rahma', area: 'Fordsburg', distanceKm: 1.2, jumuahTime: '13:15', institutionWallet: { general: 8400, sadaqah: 3200, zakat: 15600, pendingApprovals: 2, signatoryThreshold: '2 of 3' } },
  { id: 'm2', name: 'Masjid Nur', area: 'Mayfair', distanceKm: 2.8, jumuahTime: '13:00', institutionWallet: { general: 5200, sadaqah: 1800, zakat: 9400, pendingApprovals: 0, signatoryThreshold: '2 of 3' } },
  { id: 'm3', name: 'Masjid Al-Huda', area: 'Brixton', distanceKm: 4.1, jumuahTime: '13:30', institutionWallet: { general: 3100, sadaqah: 900, zakat: 4200, pendingApprovals: 1, signatoryThreshold: '3 of 5' } },
  { id: 'm4', name: 'Masjid Al-Noor', area: 'Lenasia', distanceKm: 18.5, jumuahTime: '13:45', institutionWallet: { general: 12000, sadaqah: 5600, zakat: 28000, pendingApprovals: 3, signatoryThreshold: '2 of 3' } },
]

export function getMosques(): Mosque[] {
  return mosques.map((m) => ({ ...m, institutionWallet: { ...m.institutionWallet } }))
}

export function getMosque(id: string): Mosque | null {
  const m = mosques.find((x) => x.id === id)
  return m ? { ...m, institutionWallet: { ...m.institutionWallet } } : null
}
