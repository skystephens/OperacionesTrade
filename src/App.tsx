import { useState } from 'react'
import { PriceTicker } from './components/PriceTicker'
import { RiskCalculator } from './components/RiskCalculator'
import { TradeJournal } from './components/TradeJournal'
import { Checklist } from './components/Checklist'
import { MarketAnalysis } from './components/MarketAnalysis'
import { CashFlow } from './components/CashFlow'
import { Onboarding, loadProfile } from './components/Onboarding'
import { TabGuide } from './components/TabGuide'
import { useBinanceTicker } from './hooks/useBinanceWS'
import type { UserProfile } from './types'

const SYMBOLS = ['ETHUSDT', 'BTCUSDT', 'SOLUSDT', 'BNBUSDT'] as const
type Symbol = typeof SYMBOLS[number]

const INTERVALS = ['1m', '3m', '5m', '15m', '1h'] as const
type Interval = typeof INTERVALS[number]

type Tab = 'chart' | 'analysis' | 'risk' | 'journal' | 'checklist' | 'cashflow'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'chart',     label: 'Precio',   icon: '📈' },
  { id: 'analysis',  label: 'Analisis', icon: '🧠' },
  { id: 'risk',      label: 'Riesgo',   icon: '🧮' },
  { id: 'journal',   label: 'Bitacora', icon: '📋' },
  { id: 'checklist', label: 'Check',    icon: '✓'  },
  { id: 'cashflow',  label: 'Flujo',    icon: '💰' },
]

function SymbolBadge({ symbol }: { symbol: Symbol }) {
  const names: Record<Symbol, string> = {
    ETHUSDT: 'ETH', BTCUSDT: 'BTC', SOLUSDT: 'SOL', BNBUSDT: 'BNB',
  }
  return <span>{names[symbol]}/USDT</span>
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile())
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [tab, setTab] = useState<Tab>('chart')
  const [symbol, setSymbol] = useState<Symbol>('ETHUSDT')
  const [interval, setInterval] = useState<Interval>('5m')
  const [showSymbolPicker, setShowSymbolPicker] = useState(false)

  const { ticker } = useBinanceTicker(symbol)

  if (!profile) {
    return <Onboarding onComplete={(p) => setProfile(p)} />
  }

  const riskLabel: Record<string, string> = {
    conservative: 'Conservador',
    moderate: 'Moderado',
    aggressive: 'Agresivo',
  }

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col max-w-md mx-auto">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-surface-900/95 backdrop-blur border-b border-surface-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            {tab === 'cashflow' ? (
              <h1 className="text-white font-bold text-base">Flujo de Caja</h1>
            ) : (
              <button
                onClick={() => setShowSymbolPicker(!showSymbolPicker)}
                className="flex items-center gap-1.5 group"
              >
                <h1 className="text-white font-bold text-base">
                  <SymbolBadge symbol={symbol} />
                </h1>
                <span className="text-slate-400 text-xs group-hover:text-white transition-colors">▾</span>
              </button>
            )}
            <p className="text-slate-400 text-xs">
              {tab === 'cashflow'
                ? `$${profile.capital} · ${riskLabel[profile.riskTolerance]}`
                : `Futuros Perpetuos · ${interval}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {ticker && tab !== 'cashflow' && (
              <div className="text-right">
                <p className={`font-mono font-bold text-sm ${ticker.priceChangePercent >= 0 ? 'text-up' : 'text-down'}`}>
                  ${ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className={`text-xs font-mono ${ticker.priceChangePercent >= 0 ? 'text-up' : 'text-down'}`}>
                  {ticker.priceChangePercent >= 0 ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
                </p>
              </div>
            )}
            {/* Help */}
            <button
              onClick={() => setShowGuide(true)}
              className="text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors w-7 h-7 flex items-center justify-center rounded-full border border-surface-700"
              title="Como usar este tab"
            >
              ?
            </button>
            {/* Edit profile */}
            <button
              onClick={() => setShowOnboarding(true)}
              className="text-slate-600 hover:text-slate-400 text-sm transition-colors w-7 h-7 flex items-center justify-center"
              title="Editar perfil"
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Symbol picker dropdown */}
        {showSymbolPicker && tab !== 'cashflow' && (
          <div className="grid grid-cols-4 gap-2 mt-3">
            {SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => { setSymbol(s); setShowSymbolPicker(false) }}
                className={`py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  symbol === s ? 'bg-brand text-white' : 'bg-surface-700 text-slate-300'
                }`}
              >
                {s.replace('USDT', '')}
              </button>
            ))}
          </div>
        )}

        {/* Interval selector */}
        {(tab === 'chart' || tab === 'analysis') && (
          <div className="flex gap-2 mt-3">
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  interval === iv ? 'bg-brand text-white' : 'bg-surface-700 text-slate-300'
                }`}
              >
                {iv}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-3 pb-24 space-y-4">
        {tab === 'chart'     && <PriceTicker symbol={symbol} interval={interval} />}
        {tab === 'analysis'  && <MarketAnalysis symbol={symbol} interval={interval} />}
        {tab === 'risk'      && <RiskCalculator currentPrice={ticker?.price ?? null} />}
        {tab === 'journal'   && <TradeJournal currentPrice={ticker?.price ?? null} />}
        {tab === 'checklist' && <Checklist />}
        {tab === 'cashflow'  && <CashFlow profile={profile} />}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-800 border-t border-surface-700">
        <div className="grid grid-cols-6 px-1">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setShowGuide(false) }}
              className={`flex flex-col items-center py-3 gap-0.5 transition-colors ${
                tab === id ? 'text-brand' : 'text-slate-400'
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              <span className="text-[10px] font-sans">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Onboarding modal overlay */}
      {showOnboarding && (
        <Onboarding
          onComplete={(p) => { setProfile(p); setShowOnboarding(false) }}
          onClose={() => setShowOnboarding(false)}
          initialProfile={profile}
        />
      )}

      {/* Tab guide overlay */}
      {showGuide && (
        <TabGuide tab={tab} onClose={() => setShowGuide(false)} />
      )}
    </div>
  )
}
