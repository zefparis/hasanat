import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Back, Sun, Moon } from './icons'
import { useTheme } from '../lib/theme'
import { useI18n } from '../lib/i18n'

interface HeaderProps {
  title?: string
  subtitle?: string
  dark?: boolean
  back?: boolean
  themeToggle?: boolean
  left?: ReactNode
  right?: ReactNode
}

export default function Header({ title, subtitle, dark, back, themeToggle, left, right }: HeaderProps) {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const { t } = useI18n()
  return (
    <header className={`hdr ${dark ? 'dark' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {left}
        {back && (
          <button className="back" onClick={() => navigate(-1)} aria-label={t('header.back')}>
            <Back />
          </button>
        )}
        {title && (
          <div className="wordmark" style={{ fontSize: 20 }}>
            {title}
            {subtitle && <small>{subtitle}</small>}
          </div>
        )}
      </div>
      <div className="hdr-r">
        {themeToggle && (
          <button className="ibtn" onClick={toggle} aria-label={t('header.toggleDayNight')}>
            {theme === 'day' ? <Moon /> : <Sun />}
          </button>
        )}
        {right}
      </div>
    </header>
  )
}
