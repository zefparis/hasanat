import Header from '../components/Header'

/** Shared shell for overlay screens reached from Home (back button, no bottom nav). */
export default function Overlay({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="screen overlay">
      <Header title={title} subtitle={subtitle} back themeToggle />
      <div className="pad">{children}</div>
    </div>
  )
}
