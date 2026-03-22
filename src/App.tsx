import { useState } from 'react'
import { PriceTicker } from './components/PriceTicker'
import { RiskCalculator } from './components/RiskCalculator'
import { TradeJournal } from './components/TradeJournal'
import { Checklist } from './components/Checklist'
import { useBinanceTicker } from './hooks/useBinanceWS'

const SYMBOL = 'ETHUSDT'
const INTERVALS = ['1m', '3m', '5m', '15m'] as const
type Interval = typeof INTERVALS[number]

type Tab = 'chart' | 'risk' | 'journal' | 'checklist'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'chart', label: 'Precio', icon: '📈' },
  { id: 'risk', label: 'Riesgo', icon: '🧮' },
  { id: 'journal', label: 'Bitacora', icon: '📋' },
  { id: 'checklist', label: 'Checklist', icon: '✓' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('chart')
  const [interval, setInterval] = useState<Interval>('5m')
  const { ticker } = useBinanceTicker(SYMBOL)

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col max-w-md mx-auto">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-surface-900/95 backdrop-blur border-b border-surface-700 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-base tracking-wide">Trade Dashboard</h1>
          <p className="text-surface-600 text-xs">Scalping Futuros · {SYMBOL}</p>
        </div>
        {ticker && (
          <div className="text-right">
            <p className={`font-mono font-bold text-sm ${ticker.priceChangePercent >= 0 ? 'text-up' : 'text-down'}`}>
              ${ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className={`text-xs font-mono ${ticker.priceChangePercent >= 0 ? 'text-up' : 'text-down'}`}>
              {ticker.priceChangePercent >= 0 ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
            </p>
          </div>
        )}
      </header>

      {/* Interval selector (only on chart tab) */}
      {tab === 'chart' && (
        <div className="flex gap-2 px-4 pt-3">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                interval === iv ? 'bg-brand text-white' : 'bg-surface-700 text-surface-600'
              }`}
            >
              {iv}
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-3 pb-24 space-y-4">
        {tab === 'chart' && (
          <PriceTicker symbol={SYMBOL} interval={interval} />
        )}
        {tab === 'risk' && (
          <RiskCalculator currentPrice={ticker?.price ?? null} />
        )}
        {tab === 'journal' && (
          <TradeJournal currentPrice={ticker?.price ?? null} />
        )}
        {tab === 'checklist' && (
          <Checklist />
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-800 border-t border-surface-700">
        <div className="grid grid-cols-4 px-2 pb-safe">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-col items-center py-3 gap-0.5 transition-colors ${
                tab === id ? 'text-brand' : 'text-surface-600'
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className="text-xs font-sans">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
