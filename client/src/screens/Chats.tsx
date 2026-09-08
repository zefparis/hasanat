import Header from '../components/Header'

const chats = [
  { name: 'Hasanat AI', last: 'How can I help with prayer or giving?', time: 'now', unread: 0, ic: '✦' },
  { name: 'Scholar panel', last: 'A scholar will respond shortly…', time: '2m', unread: 1, ic: '☪' },
  { name: 'Masjid community', last: 'Jumu\'ah reminder at 13:00', time: '1h', unread: 3, ic: '🕌' },
  { name: 'Family', last: 'Barakallahu feek 👍', time: '3h', unread: 0, ic: 'F' },
]

export default function Chats() {
  return (
    <div className="screen">
      <Header title="Chats" themeToggle />
      <div className="pad sec">
        <div className="card">
          {chats.map((c) => (
            <div className="item" key={c.name}>
              <div className="ic">{c.ic}</div>
              <div className="tx"><b>{c.name}</b><span>{c.last}</span></div>
              <div className="amt"><small>{c.time}</small>{c.unread > 0 && <span className="pill green" style={{ marginLeft: 6 }}>{c.unread}</span>}</div>
            </div>
          ))}
        </div>
        <p className="disc">
          Hasanat AI answers on prayer times, balance, Zakat, Hajj, Arabic, payment, giving, Ramadan, duas and
          volunteering. On any ruling it never answers — it escalates privately to the Scholar panel.
        </p>
      </div>
    </div>
  )
}
