import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { chatApi, type ChatAction } from '../lib/api'
import { useToast } from '../lib/toast'

type ChatId = 'ai' | 'scholar' | 'community' | 'family'

interface Msg {
  id: string
  from: 'me' | 'them'
  text: string
  actions?: ChatAction[]
  ts: number
  /** voice note bubble */
  voice?: { duration: number; waveform: number[]; mock: boolean }
  /** pending scholar escalation */
  pending?: boolean
}

interface ChatMeta {
  id: ChatId
  name: string
  sub: string
  avatar: string
  unread: number
  lastMsg: string
  lastTs: number
}

const QUICK_REPLIES = [
  'What time is next prayer?',
  'What is my balance?',
  'How do I calculate Zakat?',
  'Where can I pay with HAS?',
  'How do I send money?',
  'Tell me about Ramadan',
]

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function genWaveform(): number[] {
  return Array.from({ length: 32 }, () => Math.random() * 0.7 + 0.3)
}

export default function Chats() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [openChat, setOpenChat] = useState<ChatId | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [messages, setMessages] = useState<Record<ChatId, Msg[]>>({
    ai: [{ id: 'init-ai', from: 'them', text: "Assalamu alaikum! I'm Hasanat AI. I can help with prayer times, your wallet, Zakat, giving, learning, and merchants. I never issue religious rulings — those go to the Scholar panel. How can I help?", ts: Date.now() - 60000 }],
    scholar: [{ id: 'init-scholar', from: 'them', text: 'The Scholar panel is here for your religious questions. Send a message and a scholar will respond.', ts: Date.now() - 120000 }],
    community: [
      { id: 'init-com1', from: 'them', text: 'Yusuf: Wa alaikum salam! Don\'t forget jumu\'ah at 13:15.', ts: Date.now() - 90000 },
      { id: 'init-com2', from: 'them', text: 'Aisha: Jazak Allah khairan for the reminder!', ts: Date.now() - 80000 },
    ],
    family: [
      { id: 'init-fam1', from: 'them', text: 'Fatima: Are we still on for iftar tonight?', ts: Date.now() - 70000 },
    ],
  })
  const [unread, setUnread] = useState<Record<ChatId, number>>({ ai: 0, scholar: 0, community: 2, family: 1 })
  const [lastMsg, setLastMsg] = useState<Record<ChatId, string>>({
    ai: "How can I help?",
    scholar: 'Send a message and a scholar will respond.',
    community: 'Jazak Allah khairan for the reminder!',
    family: 'Are we still on for iftar tonight?',
  })
  const [lastTs, setLastTs] = useState<Record<ChatId, number>>({
    ai: Date.now() - 60000, scholar: Date.now() - 120000, community: Date.now() - 80000, family: Date.now() - 70000,
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, openChat])

  function addMsg(chat: ChatId, msg: Msg) {
    setMessages((prev) => ({ ...prev, [chat]: [...prev[chat], msg] }))
    setLastMsg((prev) => ({ ...prev, [chat]: msg.text }))
    setLastTs((prev) => ({ ...prev, [chat]: msg.ts }))
  }

  async function sendText(chat: ChatId, text: string) {
    if (!text.trim() || sending) return
    setInput('')
    setSending(true)
    addMsg(chat, { id: `m_${Date.now()}`, from: 'me', text, ts: Date.now() })

    try {
      if (chat === 'ai') {
        const reply = await chatApi.ai(text)
        addMsg('ai', { id: `r_${Date.now()}`, from: 'them', text: reply.text, actions: reply.actions, ts: Date.now() })
        // If the AI escalated to the Scholar panel, send the scholar ack a few seconds later
        if (reply.escalateToScholar) {
          // Also add the question to the Scholar chat
          addMsg('scholar', { id: `sch_q_${Date.now()}`, from: 'me', text, ts: Date.now() })
          setUnread((prev) => ({ ...prev, scholar: prev.scholar + 1 }))
          // Scholar ack arrives after a delay
          setTimeout(async () => {
            const ack = await chatApi.scholar()
            addMsg('scholar', { id: `sch_a_${Date.now()}`, from: 'them', text: ack.text, ts: Date.now() })
            setLastMsg((prev) => ({ ...prev, scholar: ack.text }))
            setUnread((prev) => ({ ...prev, scholar: prev.scholar + 1 }))
            toast('Scholar panel responded')
          }, 3000)
        }
      } else if (chat === 'scholar') {
        // Scholar panel — static ack, no AI
        const ack = await chatApi.scholar()
        addMsg('scholar', { id: `sch_r_${Date.now()}`, from: 'them', text: ack.text, ts: Date.now() })
      } else if (chat === 'community') {
        const res = await chatApi.community('Ben')
        addMsg('community', { id: `com_r_${Date.now()}`, from: 'them', text: res.text, ts: Date.now() })
      } else if (chat === 'family') {
        const res = await chatApi.family('Ben')
        addMsg('family', { id: `fam_r_${Date.now()}`, from: 'them', text: res.text, ts: Date.now() })
      }
    } catch {
      addMsg(chat, { id: `err_${Date.now()}`, from: 'them', text: 'Message could not be delivered. Try again.', ts: Date.now() })
    } finally {
      setSending(false)
    }
  }

  async function sendVoice(chat: ChatId) {
    if (!recording) return
    setRecording(false)
    setSending(true)
    const duration = 3 + Math.floor(Math.random() * 7)
    const waveform = genWaveform()
    addMsg(chat, { id: `v_${Date.now()}`, from: 'me', text: '', voice: { duration, waveform, mock: true }, ts: Date.now() })

    try {
      // Transcribe (explicit mock in pilot)
      const res = await chatApi.transcribe('')
      // Log the activity — this connects to the "Voluntary log" from Home (prompt 3)
      // In a full implementation, this would mark the voluntary log as "approved"
      toast(`Activity logged · pending approval`)

      if (chat === 'ai') {
        // AI responds to the transcribed text (mock transcription)
        const reply = await chatApi.ai(res.text)
        addMsg('ai', { id: `vr_${Date.now()}`, from: 'them', text: reply.text, actions: reply.actions, ts: Date.now() })
      } else if (chat === 'scholar') {
        const ack = await chatApi.scholar()
        addMsg('scholar', { id: `vs_${Date.now()}`, from: 'them', text: ack.text, ts: Date.now() })
      } else if (chat === 'community') {
        const r = await chatApi.community('Ben')
        addMsg('community', { id: `vc_${Date.now()}`, from: 'them', text: r.text, ts: Date.now() })
      } else if (chat === 'family') {
        const r = await chatApi.family('Ben')
        addMsg('family', { id: `vf_${Date.now()}`, from: 'them', text: r.text, ts: Date.now() })
      }
    } catch {
      // Voice note still sent even if transcription fails
    } finally {
      setSending(false)
    }
  }

  function openChatById(id: ChatId) {
    setOpenChat(id)
    setUnread((prev) => ({ ...prev, [id]: 0 }))
  }

  function handleAction(route: string) {
    navigate(route)
  }

  function featureComingSoon(label: string) {
    toast(`${label} — pilot feature coming soon`)
  }

  // ─── Chat list view ─────────────────────────────────────────────────────────
  if (!openChat) {
    const chats: ChatMeta[] = [
      { id: 'ai', name: 'Hasanat AI', sub: 'Assistant · prayer, wallet, giving', avatar: '✦', unread: unread.ai, lastMsg: lastMsg.ai, lastTs: lastTs.ai },
      { id: 'scholar', name: 'Scholar panel', sub: 'Religious questions · private', avatar: '☪', unread: unread.scholar, lastMsg: lastMsg.scholar, lastTs: lastTs.scholar },
      { id: 'community', name: 'Masjid Al-Rahma', sub: 'Community · 124 members', avatar: '🕌', unread: unread.community, lastMsg: lastMsg.community, lastTs: lastTs.community },
      { id: 'family', name: 'Family', sub: 'Ben, Fatima, Omar', avatar: '👪', unread: unread.family, lastMsg: lastMsg.family, lastTs: lastTs.family },
    ]
    return (
      <div className="screen">
        <Header title="Chats" right={<Shield />} />
        <div className="pad sec">
          {chats.map((c) => (
            <div className="card" key={c.id} style={{ marginTop: 8, cursor: 'pointer' }} onClick={() => openChatById(c.id)}>
              <div className="item" style={{ border: 'none', padding: 0 }}>
                <div className="cav" style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{c.avatar}</div>
                <div className="tx" style={{ flex: 1 }}>
                  <b style={{ fontSize: 15 }}>{c.name}</b>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginTop: 2 }}>{c.lastMsg}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{c.sub}</span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtTime(c.lastTs)}</span>
                  {c.unread > 0 && <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, borderRadius: 10, padding: '2px 7px', minWidth: 20, textAlign: 'center' }}>{c.unread}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Chat thread view ───────────────────────────────────────────────────────
  const chatNames: Record<ChatId, string> = { ai: 'Hasanat AI', scholar: 'Scholar panel', community: 'Masjid Al-Rahma', family: 'Family' }
  const chatAvatars: Record<ChatId, string> = { ai: '✦', scholar: '☪', community: '🕌', family: '👪' }
  const msgs = messages[openChat]

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <Header
        title={chatNames[openChat]}
        left={<button className="ibtn" onClick={() => setOpenChat(null)} aria-label="Back">‹</button>}
        right={
          <>
            <button className="ibtn" onClick={() => featureComingSoon('Voice call')} aria-label="Call">📞</button>
            <button className="ibtn" onClick={() => featureComingSoon('Attachments')} aria-label="Attach">📎</button>
          </>
        }
      />

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', background: 'var(--wall)' }}>
        {msgs.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            {m.from === 'them' && <div className="cav" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginRight: 8, flexShrink: 0 }}>{chatAvatars[openChat]}</div>}
            <div style={{ maxWidth: '75%' }}>
              {m.voice ? (
                <div style={{
                  background: m.from === 'me' ? 'var(--bubble-out)' : 'var(--bubble-in)',
                  borderRadius: 18, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: 'var(--shadow)',
                }}>
                  <button style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-2)', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer' }}>▶</button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
                    {m.voice.waveform.map((h, i) => (
                      <span key={i} style={{ width: 2, height: `${h * 100}%`, background: m.from === 'me' ? 'var(--primary)' : 'var(--muted)', borderRadius: 1 }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{m.voice.duration}s</span>
                  {m.voice.mock && <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 4 }}>(mock)</span>}
                </div>
              ) : (
                <div style={{
                  background: m.from === 'me' ? 'var(--bubble-out)' : 'var(--bubble-in)',
                  color: 'var(--ink)',
                  borderRadius: 18, padding: '10px 14px', fontSize: 14, lineHeight: 1.5,
                  boxShadow: 'var(--shadow)',
                }}>
                  {m.text}
                </div>
              )}
              {m.actions && m.actions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {m.actions.map((a) => (
                    <button key={a.label} onClick={() => handleAction(a.route)} style={{
                      fontSize: 12, padding: '6px 12px', borderRadius: 16, border: '1px solid var(--primary-2)',
                      color: 'var(--primary-2)', background: 'transparent', cursor: 'pointer', fontWeight: 500,
                    }}>{a.label}</button>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, textAlign: m.from === 'me' ? 'right' : 'left' }}>
                {fmtTime(m.ts)}{m.from === 'me' && ' ✓✓'}
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
            <div className="cav" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginRight: 8 }}>...</div>
            <div style={{ background: 'var(--bubble-in)', borderRadius: 18, padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>typing...</div>
          </div>
        )}
      </div>

      {/* Quick replies (AI only) */}
      {openChat === 'ai' && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto', background: 'var(--bg)' }}>
          {QUICK_REPLIES.map((q) => (
            <button key={q} onClick={() => sendText('ai', q)} style={{
              fontSize: 12, padding: '6px 12px', borderRadius: 16, whiteSpace: 'nowrap',
              border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer',
            }}>{q}</button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px calc(env(safe-area-inset-bottom) + 10px)', background: 'var(--surface)', borderTop: '1px solid var(--line)', alignItems: 'center' }}>
        <input
          style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 22, padding: '10px 16px', fontSize: 14, background: 'var(--bg)', color: 'var(--ink)' }}
          placeholder={openChat === 'scholar' ? 'Ask the Scholar panel...' : 'Message...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendText(openChat, input) }}
        />
        {input.trim() ? (
          <button onClick={() => sendText(openChat, input)} disabled={sending} style={{
            width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>↑</button>
        ) : (
          <button
            onPointerDown={() => setRecording(true)}
            onPointerUp={() => sendVoice(openChat)}
            onPointerCancel={() => setRecording(false)}
            onPointerLeave={() => recording && sendVoice(openChat)}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: recording ? 'var(--danger)' : 'var(--accent)', color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none',
            }} aria-label="Hold to record"
          >🎤</button>
        )}
      </div>
      {recording && (
        <div style={{ position: 'fixed', bottom: 80, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>
          Recording... release to send
        </div>
      )}
    </div>
  )
}
