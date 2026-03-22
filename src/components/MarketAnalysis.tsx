import { useMemo } from 'react'
import { useBinanceKlines } from '../hooks/useBinanceWS'
import { analyzeMarket } from '../utils/indicators'

const SIGNAL_CONFIG = {
  STRONG_LONG: { label: 'COMPRA FUERTE', color: 'text-up', bg: 'bg-up/20 border-up/40', bar: 'bg-up', icon: '▲▲' },
  LONG:        { label: 'COMPRA',        color: 'text-up', bg: 'bg-up/10 border-up/20', bar: 'bg-up', icon: '▲' },
  NEUTRAL:     { label: 'NEUTRO / ESPERAR', color: 'text-warn', bg: 'bg-warn/10 border-warn/20', bar: 'bg-warn', icon: '—' },
  SHORT:       { label: 'VENTA',         color: 'text-down', bg: 'bg-down/10 border-down/20', bar: 'bg-down', icon: '▼' },
  STRONG_SHORT:{ label: 'VENTA FUERTE',  color: 'text-down', bg: 'bg-down/20 border-down/40', bar: 'bg-down', icon: '▼▼' },
}

interface Props {
  symbol: string
  interval: string
}

function GaugeMeter({ score }: { score: number }) {
  const pct = ((score + 100) / 200) * 100
  const color = score >= 20 ? '#22c55e' : score <= -20 ? '#ef4444' : '#f59e0b'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-300">
        <span>Venta fuerte</span>
        <span>Compra fuerte</span>
      </div>
      <div className="relative h-3 bg-surface-700 rounded-full overflow-hidden">
        {/* gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-down via-warn to-up opacity-30 rounded-full" />
        {/* indicator */}
        <div
          className="absolute top-0.5 w-2 h-2 rounded-full shadow-lg transition-all duration-500"
          style={{ left: `calc(${pct}% - 4px)`, backgroundColor: color }}
        />
      </div>
      <div className="text-center">
        <span className="font-mono text-xs text-slate-400">Score: </span>
        <span className="font-mono text-sm font-bold" style={{ color }}>
          {score > 0 ? '+' : ''}{score}
        </span>
      </div>
    </div>
  )
}

export function MarketAnalysis({ symbol, interval }: Props) {
  const { klines, loading } = useBinanceKlines(symbol, interval, 100)

  const analysis = useMemo(() => analyzeMarket(klines), [klines])

  if (loading || !analysis) {
    return (
      <div className="bg-surface-800 rounded-2xl p-6 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-300 text-sm">Analizando mercado...</p>
        </div>
      </div>
    )
  }

  const cfg = SIGNAL_CONFIG[analysis.signal]

  return (
    <div className="space-y-3">
      {/* Signal card */}
      <div className={`bg-surface-800 rounded-2xl p-4 border ${cfg.bg} space-y-3`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-300 text-xs font-semibold uppercase tracking-widest">Señal del mercado</p>
            <p className={`text-2xl font-bold mt-1 ${cfg.color}`}>
              {cfg.icon} {cfg.label}
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-300 text-xs">Tendencia</p>
            <p className={`font-bold text-sm mt-1 ${
              analysis.trend === 'ALCISTA' ? 'text-up' :
              analysis.trend === 'BAJISTA' ? 'text-down' : 'text-warn'
            }`}>{analysis.trend}</p>
          </div>
        </div>
        <GaugeMeter score={analysis.signalScore} />
      </div>

      {/* Indicators */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-white font-bold text-sm">Indicadores Tecnicos</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              label: 'RSI (14)',
              value: analysis.rsi.toFixed(1),
              sub: analysis.rsi < 30 ? 'Sobrevendido' : analysis.rsi > 70 ? 'Sobrecomprado' : 'Normal',
              color: analysis.rsi < 30 ? 'text-up' : analysis.rsi > 70 ? 'text-down' : 'text-warn',
            },
            {
              label: 'EMA 9',
              value: `$${analysis.ema9.toFixed(2)}`,
              sub: analysis.priceVsEma9 === 'above' ? 'Precio arriba' : 'Precio abajo',
              color: analysis.priceVsEma9 === 'above' ? 'text-up' : 'text-down',
            },
            {
              label: 'EMA 21',
              value: `$${analysis.ema21.toFixed(2)}`,
              sub: analysis.priceVsEma21 === 'above' ? 'Precio arriba' : 'Precio abajo',
              color: analysis.priceVsEma21 === 'above' ? 'text-up' : 'text-down',
            },
            {
              label: 'EMA 9 vs 21',
              value: analysis.ema9VsEma21 === 'above' ? 'Golden Cross' : 'Death Cross',
              sub: analysis.ema9VsEma21 === 'above' ? 'Señal alcista' : 'Señal bajista',
              color: analysis.ema9VsEma21 === 'above' ? 'text-up' : 'text-down',
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-surface-700 rounded-xl p-3">
              <p className="text-slate-300 text-xs font-semibold">{label}</p>
              <p className={`font-mono font-bold text-sm mt-1 ${color}`}>{value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Volume */}
        <div className="bg-surface-700 rounded-xl px-3 py-2 flex justify-between items-center">
          <span className="text-slate-300 text-xs font-semibold">Volumen reciente</span>
          <span className={`text-sm font-bold font-mono ${
            analysis.volumeTrend === 'increasing' ? 'text-up' :
            analysis.volumeTrend === 'decreasing' ? 'text-down' : 'text-warn'
          }`}>
            {analysis.volumeTrend === 'increasing' ? '↑ Aumentando' :
             analysis.volumeTrend === 'decreasing' ? '↓ Disminuyendo' : '→ Neutral'}
          </span>
        </div>
      </div>

      {/* Support & Resistance */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-white font-bold text-sm">Niveles Clave (20 velas)</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center bg-down/10 border border-down/20 rounded-xl px-3 py-2">
            <span className="text-slate-300 text-xs font-semibold">Resistencia</span>
            <span className="font-mono font-bold text-down text-sm">${analysis.resistance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center bg-surface-700 rounded-xl px-3 py-2">
            <span className="text-slate-300 text-xs font-semibold">Precio actual</span>
            <span className="font-mono font-bold text-white text-sm">${analysis.currentPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center bg-up/10 border border-up/20 rounded-xl px-3 py-2">
            <span className="text-slate-300 text-xs font-semibold">Soporte</span>
            <span className="font-mono font-bold text-up text-sm">${analysis.support.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Reasons */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-2">
        <h3 className="text-white font-bold text-sm">Por que esta señal?</h3>
        {analysis.reasons.map((reason, i) => (
          <div key={i} className="flex items-start gap-2 bg-surface-700 rounded-xl px-3 py-2">
            <span className="text-brand text-xs mt-0.5">•</span>
            <span className="text-slate-200 text-xs leading-relaxed">{reason}</span>
          </div>
        ))}
        <p className="text-slate-500 text-xs pt-1">
          * Analisis tecnico automatico. No es asesoría financiera. Siempre usa stop-loss.
        </p>
      </div>
    </div>
  )
}
