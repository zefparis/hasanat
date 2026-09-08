import type { ComponentType, SVGProps } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Wallet, Give, Chat } from './icons'

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>
interface Tab { to: string; label: string; Icon?: IconCmp; end?: boolean; pay?: boolean }

const tabs: Tab[] = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/wallet', label: 'Wallet', Icon: Wallet },
  { to: '/pay', label: 'Pay', pay: true },
  { to: '/give', label: 'Give', Icon: Give },
  { to: '/chats', label: 'Chats', Icon: Chat },
]

export default function Nav() {
  return (
    <nav className="nav" aria-label="Primary">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => `${t.pay ? 'pay' : ''} ${isActive ? 'active' : ''}`}
        >
          {t.pay ? (
            <>
              <span className="pay-star"><i className="star" /></span>
              <span>{t.label}</span>
            </>
          ) : (
            <>
              {t.Icon && <t.Icon />}
              <span>{t.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
