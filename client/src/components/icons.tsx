import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({
  width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  ...p,
})

export const Home = (p: P) => (
  <svg {...base(p)}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
)
export const Wallet = (p: P) => (
  <svg {...base(p)}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18" /><circle cx="16.5" cy="14" r="1.2" /></svg>
)
export const Give = (p: P) => (
  <svg {...base(p)}><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" /></svg>
)
export const Chat = (p: P) => (
  <svg {...base(p)}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" /></svg>
)
export const Back = (p: P) => (
  <svg {...base(p)}><path d="M15 18l-6-6 6-6" /></svg>
)
export const Sun = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>
)
export const Moon = (p: P) => (
  <svg {...base(p)}><path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8z" /></svg>
)
export const Scan = (p: P) => (
  <svg {...base(p)}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" /></svg>
)
export const Send = (p: P) => (
  <svg {...base(p)}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
)
export const Book = (p: P) => (
  <svg {...base(p)}><path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" /><path d="M20 4h-3a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h4z" /></svg>
)
export const Compass = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M15 9l-2 5-5 2 2-5 5-2z" /></svg>
)
export const Mosque = (p: P) => (
  <svg {...base(p)}><path d="M4 21V11a8 8 0 0 1 16 0v10" /><path d="M4 21h16M9 21v-4a3 3 0 0 1 6 0v4M12 3v3" /></svg>
)
export const Store = (p: P) => (
  <svg {...base(p)}><path d="M4 9l1-5h14l1 5" /><path d="M4 9v11h16V9" /><path d="M4 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 4 0" /></svg>
)
export const User = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
)
