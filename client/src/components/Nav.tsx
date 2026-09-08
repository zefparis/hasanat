import type { ComponentType, SVGProps } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Wallet, Give, Chat } from './icons'
import { useI18n } from '../lib/i18n'

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>
interface Tab { to: string; labelKey: string; Icon?: IconCmp; end?: boolean; pay?: boolean }

const tabs: Tab[] = [
  { to: '/', labelKey: 'nav.home', Icon: Home, end: true },
  { to: '/wallet', labelKey: 'nav.wallet', Icon: Wallet },
  { to: '/pay', labelKey: 'nav.pay', pay: true },
  { to: '/give', labelKey: 'nav.give', Icon: Give },
  { to: '/chats', labelKey: 'nav.chats', Icon: Chat },
]

export default function Nav() {
  const { t } = useI18n()
  return (
    <nav className="nav" aria-label={t('nav.home')}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `${tab.pay ? 'pay' : ''} ${isActive ? 'active' : ''}`}
        >
          {tab.pay ? (
            <>
              <span className="pay-star"><i className="star" /></span>
              <span>{t(tab.labelKey)}</span>
            </>
          ) : (
            <>
              {tab.Icon && <tab.Icon />}
              <span>{t(tab.labelKey)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
