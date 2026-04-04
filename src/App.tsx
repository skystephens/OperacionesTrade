import { useState } from 'react'
import { PriceTicker } from './components/PriceTicker'
import { RiskCalculator } from './components/RiskCalculator'
import { TradeJournal } from './components/TradeJournal'
import { MarketAnalysis } from './components/MarketAnalysis'
import { Backtester } from './components/Backtester'
import { Onboarding, loadProfile } from './components/Onboarding'
import { TabGuide } from './components/TabGuide'
import { useBinanceTicker } from './hooks/useBinanceWS'
import type { UserProfile } from './types'

const SYMBOLS = ['ETHUSDT', 'BTCUSDT', 'SOLUSDT', 'BNBUSDT'] as const
type Symbol = typeof SYMBOLS[number]

const INTERVALS = ['1m', '3m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'] as const
type Interval = typeof INTERVALS[number]

type Tab = 'chart' | 'analysis' | 'risk' | 'journal' | 'sim'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'chart',    label: 'Precio',   icon: '📈' },
  { id: 'analysis', label: 'Analisis', icon: '🧠' },
  { id: 'risk',     label: 'Riesgo',   icon: '🧮' },
  { id: 'journal',  label: 'Bitacora', icon: '📋' },
  { id: 'sim',      label: 'Sim',      icon: '🔬' },
]

function SymbolBadge({ symbol }: { symbol: Symbol }) {
  const names: Record<Symbol, string> = {
    ETHUSDT: 'ETH', BTCUSDT: 'BTC', SOLUSDT: 'SOL', BNBUSDT: 'BNB',
  }
  return <span>{names[symbol]}/USDT</span>
}

const DEFAULT_PROFILE: UserProfile = {
  capital: 300,
  horizon: 'weeks',
  expectedReturn: null,
  riskTolerance: 'moderate',
  createdAt: '',
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile() ?? DEFAULT_PROFILE)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [tab, setTab] = useState<Tab>('chart')
  const [symbol, setSymbol] = useState<Symbol>('ETHUSDT')
  const [interval, setInterval] = useState<Interval>('5m')
  const [showSymbolPicker, setShowSymbolPicker] = useState(false)

  const { ticker } = useBinanceTicker(symbol)

  // Full-screen profile page
  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={(p) => { setProfile(p); setShowOnboarding(false) }}
        onClose={() => setShowOnboarding(false)}
        initialProfile={profile}
      />
    )
  }

  // profile is kept for onboarding but not displayed in header anymore
  void profile

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col max-w-md mx-auto">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-surface-900/95 backdrop-blur border-b border-surface-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            {tab === 'sim' ? (
              <h1 className="text-white font-bold text-base">Simulador</h1>
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
              {tab === 'sim'
                ? 'Señal en vivo + backtest'
                : `Futuros Perpetuos · ${interval}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {ticker && tab !== 'sim' && (
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
        {showSymbolPicker && tab !== 'sim' && (
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

        {/* Interval selector — only for chart and analysis tabs */}
        {(tab === 'chart' || tab === 'analysis') && (
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 scrollbar-hide">
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors shrink-0 ${
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
        {tab === 'chart' && (
          <>
            <PriceTicker symbol={symbol} interval={interval} />
            <div className="bg-surface-800 rounded-2xl p-4 space-y-2 border border-surface-700">
              <p className="text-slate-300 text-xs font-bold uppercase tracking-widest">Que puedes hacer aqui</p>
              {[
                { icon: '📊', text: 'Cambia el intervalo arriba (1m, 3m, 5m, 15m, 1h) — usa 1m-5m para scalping rapido, 15m-1h para ver la tendencia general.' },
                { icon: '🔄', text: 'Cambia la moneda tocando ETH/USDT en el header — tienes ETH, BTC, SOL y BNB disponibles.' },
                { icon: '🕯️', text: 'Las velas verdes = precio subio en ese periodo. Rojas = precio bajo. El tamano del cuerpo indica la fuerza del movimiento.' },
                { icon: '📉', text: 'Volumen alto = mercado activo, buenas condiciones para operar. Volumen bajo = evita entrar, hay mas riesgo de slippage.' },
                { icon: '🧠', text: 'Ve al tab Analisis para ver senales de compra/venta calculadas automaticamente con RSI + EMA + Volumen.' },
              ].map(({ icon, text }, i) => (
                <div key={i} className="flex items-start gap-2 bg-surface-700 rounded-xl px-3 py-2">
                  <span className="text-sm shrink-0">{icon}</span>
                  <span className="text-slate-200 text-xs leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === 'analysis' && <MarketAnalysis symbol={symbol} interval={interval} />}
        {tab === 'risk'     && <RiskCalculator currentPrice={ticker?.price ?? null} />}
        {tab === 'journal'  && <TradeJournal currentPrice={ticker?.price ?? null} />}
        {tab === 'sim'      && <Backtester symbol={symbol} />}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-800 border-t border-surface-700">
        <div className="grid grid-cols-5 px-1">
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

      {/* Tab guide overlay */}
      {showGuide && (
        <TabGuide tab={tab} onClose={() => setShowGuide(false)} />
      )}
    </div>
  )
}
