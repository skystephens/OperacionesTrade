import { useState } from 'react'
import type { TradeEntry } from '../types'

const STORAGE_KEY = 'trade_journal_v1'

function loadTrades(): TradeEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveTrades(trades: TradeEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades))
}

function calcStats(trades: TradeEntry[]) {
  const closed = trades.filter((t) => t.status === 'CLOSED' && t.pnl !== null)
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0)
  const totalPnL = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0
  return { totalTrades: closed.length, wins: wins.length, winRate, totalPnL }
}

interface Props {
  currentPrice: number | null
}

export function TradeJournal({ currentPrice }: Props) {
  const [trades, setTrades] = useState<TradeEntry[]>(loadTrades)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    pair: 'ETHUSDT',
    direction: 'LONG' as 'LONG' | 'SHORT',
    entryPrice: currentPrice ?? 2108.28,
    exitPrice: '',
    size: 0.01,
    leverage: 10,
    notes: '',
  })

  const stats = calcStats(trades)

  const addTrade = () => {
    const exit = parseFloat(form.exitPrice)
    const hasExit = !isNaN(exit) && exit > 0

    const priceDiff =
      form.direction === 'LONG'
        ? (hasExit ? exit : 0) - form.entryPrice
        : form.entryPrice - (hasExit ? exit : 0)

    const pnl = hasExit ? priceDiff * form.size * form.leverage : null

    const entry: TradeEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      pair: form.pair,
      direction: form.direction,
      entryPrice: form.entryPrice,
      exitPrice: hasExit ? exit : null,
      size: form.size,
      leverage: form.leverage,
      pnl,
      status: hasExit ? 'CLOSED' : 'OPEN',
      notes: form.notes,
    }

    const updated = [entry, ...trades]
    setTrades(updated)
    saveTrades(updated)
    setShowForm(false)
  }

  const removeTrade = (id: string) => {
    const updated = trades.filter((t) => t.id !== id)
    setTrades(updated)
    saveTrades(updated)
  }

  return (
    <div className="bg-surface-800 rounded-2xl p-4 space-y-4">
      {/* Header + stats */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-base">Bitacora de Operaciones</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand text-white text-xs px-3 py-1.5 rounded-xl font-semibold"
        >
          + Nueva
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Operaciones', value: stats.totalTrades },
          { label: 'Ganadas', value: stats.wins, color: 'text-up' },
          { label: 'Win Rate', value: `${stats.winRate.toFixed(0)}%`, color: stats.winRate >= 50 ? 'text-up' : 'text-down' },
          { label: 'PnL Total', value: `$${stats.totalPnL.toFixed(2)}`, color: stats.totalPnL >= 0 ? 'text-up' : 'text-down' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-700 rounded-xl p-2">
            <p className="text-surface-600 text-xs">{label}</p>
            <p className={`font-mono text-sm font-bold ${color ?? 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* New trade form */}
      {showForm && (
        <div className="bg-surface-700 rounded-xl p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['LONG', 'SHORT'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setForm((f) => ({ ...f, direction: d }))}
                className={`py-1.5 rounded-lg text-sm font-bold ${
                  form.direction === d
                    ? d === 'LONG' ? 'bg-up text-white' : 'bg-down text-white'
                    : 'bg-surface-800 text-surface-600'
                }`}
              >
                {d === 'LONG' ? '▲ LONG' : '▼ SHORT'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Entrada ($)', key: 'entryPrice' as const },
              { label: 'Salida ($)', key: 'exitPrice' as const, placeholder: 'Dejar vacio = OPEN' },
              { label: 'Tamano (ETH)', key: 'size' as const },
              { label: 'Apalancamiento', key: 'leverage' as const },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="text-surface-600 text-xs mb-1 block">{label}</label>
                <input
                  type={key === 'exitPrice' ? 'text' : 'number'}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full bg-surface-800 border border-surface-600 rounded-lg px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-brand"
                />
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Notas..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full bg-surface-800 border border-surface-600 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-brand"
          />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowForm(false)} className="py-1.5 rounded-lg bg-surface-800 text-surface-600 text-sm">
              Cancelar
            </button>
            <button onClick={addTrade} className="py-1.5 rounded-lg bg-brand text-white text-sm font-semibold">
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Trade list */}
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {trades.length === 0 && (
          <p className="text-surface-600 text-xs text-center py-4">Sin operaciones registradas</p>
        )}
        {trades.map((t) => {
          const pnlColor = (t.pnl ?? 0) >= 0 ? 'text-up' : 'text-down'
          return (
            <div key={t.id} className="bg-surface-700 rounded-xl px-3 py-2 flex items-center gap-3">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                  t.direction === 'LONG' ? 'bg-up/20 text-up' : 'bg-down/20 text-down'
                }`}
              >
                {t.direction}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <span className="text-white font-mono text-xs">${t.entryPrice.toFixed(2)}</span>
                  {t.pnl !== null && (
                    <span className={`font-mono text-xs font-bold ${pnlColor}`}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-surface-600 text-xs truncate">{t.date} · {t.status}</p>
              </div>
              <button onClick={() => removeTrade(t.id)} className="text-surface-600 hover:text-down text-lg leading-none">
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
