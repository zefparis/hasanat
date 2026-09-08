import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { walletApi, type WalletState, type LedgerEntry } from './api'
import { useAuth } from './auth'

interface WalletCtx {
  state: WalletState | null
  entries: LedgerEntry[]
  loading: boolean
  refresh: () => Promise<void>
  /** Buy HAS with SAR (1:1). */
  buy: (sar: number) => Promise<void>
  /** Send HAS to a contact. Throws on insufficient balance. */
  send: (to: string, amount: number) => Promise<void>
  /** Simulate an incoming payment (mock). */
  receive: (amount: number) => Promise<void>
  /** Pay a merchant. settlement: retain | convert | split. */
  pay: (merchant: string, amount: number, fee: number, settlement: 'retain' | 'convert' | 'split') => Promise<{ merchantReceives: number; receiptNo?: string }>
}

const Ctx = createContext<WalletCtx | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const { sid } = useAuth()
  const [state, setState] = useState<WalletState | null>(null)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [w, a] = await Promise.all([walletApi.state(), walletApi.activity()])
      setState(w)
      setEntries(a.entries)
    } catch {
      // keep last known state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!sid) { setState(null); setEntries([]); setLoading(false); return }
    void refresh()
  }, [sid, refresh])

  const buy = useCallback(async (sar: number) => {
    const res = await walletApi.buy(sar)
    setState((s) => s ? { ...s, balance: res.balance } : s)
    setEntries((e) => [res.entry, ...e])
  }, [])

  const send = useCallback(async (to: string, amount: number) => {
    const res = await walletApi.send(to, amount)
    setState((s) => s ? { ...s, balance: res.balance } : s)
    setEntries((e) => [res.entry, ...e])
  }, [])

  const receive = useCallback(async (amount: number) => {
    const res = await walletApi.receive(amount)
    setState((s) => s ? { ...s, balance: res.balance } : s)
    setEntries((e) => [res.entry, ...e])
  }, [])

  const pay = useCallback(async (merchant: string, amount: number, fee: number, settlement: 'retain' | 'convert' | 'split') => {
    const res = await walletApi.pay(merchant, amount, fee, settlement)
    setState((s) => s ? { ...s, balance: res.balance } : s)
    setEntries((e) => [res.entry, ...e])
    return { merchantReceives: res.merchantReceives, receiptNo: res.entry.receiptNo }
  }, [])

  return <Ctx.Provider value={{ state, entries, loading, refresh, buy, send, receive, pay }}>{children}</Ctx.Provider>
}

export function useWallet() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useWallet must be used within WalletProvider')
  return c
}
