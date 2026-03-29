import { useMemo, useState } from 'react'
import { useBinanceKlines } from '../hooks/useBinanceWS'
import { analyzeMarket } from '../utils/indicators'
import type { EntryPlan } from '../utils/indicators'

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
        <div className="absolute inset-0 bg-gradient-to-r from-down via-warn to-up opacity-30 rounded-full" />
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

function SRLevels({
  supports,
  resistances,
  currentPrice,
}: {
  supports: number[]
  resistances: number[]
  currentPrice: number
}) {
  const r3 = resistances[2]
  const r2 = resistances[1]
  const r1 = resistances[0]
  const s1 = supports[0]
  const s2 = supports[1]
  const s3 = supports[2]

  type LevelRow = { label: string; price: number; type: 'resistance' | 'current' | 'support'; tag?: string }

  const rows: LevelRow[] = [
    ...(r3 ? [{ label: 'Resistencia 3', price: r3, type: 'resistance' as const, tag: 'R3' }] : []),
    ...(r2 ? [{ label: 'Resistencia 2', price: r2, type: 'resistance' as const, tag: 'R2' }] : []),
    ...(r1 ? [{ label: 'Resistencia 1', price: r1, type: 'resistance' as const, tag: 'R1 ←' }] : []),
    { label: 'Precio actual', price: currentPrice, type: 'current' as const, tag: 'Ahora' },
    ...(s1 ? [{ label: 'Soporte 1', price: s1, type: 'support' as const, tag: 'S1 ←' }] : []),
    ...(s2 ? [{ label: 'Soporte 2', price: s2, type: 'support' as const, tag: 'S2' }] : []),
    ...(s3 ? [{ label: 'Soporte 3', price: s3, type: 'support' as const, tag: 'S3' }] : []),
  ]

  return (
    <div className="bg-surface-800 rounded-2xl p-4 space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-bold text-sm">Soportes y Resistencias</h3>
        <span className="text-slate-400 text-xs">Pivot points reales</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => {
          const pctFromCurrent = ((row.price - currentPrice) / currentPrice) * 100
          const isKey = row.tag === 'R1 ←' || row.tag === 'S1 ←'

          return (
            <div
              key={row.label}
              className={`flex justify-between items-center rounded-xl px-3 py-2 ${
                row.type === 'resistance'
                  ? isKey
                    ? 'bg-down/15 border border-down/30'
                    : 'bg-down/5 border border-down/10'
                  : row.type === 'support'
                  ? isKey
                    ? 'bg-up/15 border border-up/30'
                    : 'bg-up/5 border border-up/10'
                  : 'bg-surface-700 border border-surface-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  row.type === 'resistance' ? 'bg-down/20 text-down' :
                  row.type === 'support' ? 'bg-up/20 text-up' :
                  'bg-surface-600 text-slate-300'
                }`}>
                  {row.tag ?? ''}
                </span>
                <span className="text-slate-300 text-xs">{row.label}</span>
              </div>
              <div className="text-right">
                <span className={`font-mono font-bold text-sm ${
                  row.type === 'resistance' ? 'text-down' :
                  row.type === 'support' ? 'text-up' :
                  'text-white'
                }`}>
                  ${row.price.toFixed(2)}
                </span>
                {row.type !== 'current' && (
                  <p className="text-slate-500 text-[10px] font-mono">
                    {pctFromCurrent > 0 ? '+' : ''}{pctFromCurrent.toFixed(2)}%
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EntryPlanCard({ plan }: { plan: EntryPlan }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(plan.shareText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const isLong = plan.direction === 'LONG'
  const dirColor = isLong ? 'text-up' : 'text-down'
  const dirBg = isLong ? 'bg-up/10 border-up/30' : 'bg-down/10 border-down/30'

  return (
    <div className={`bg-surface-800 rounded-2xl p-4 space-y-3 border ${dirBg}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-300 text-xs font-semibold uppercase tracking-widest">Operación sugerida</p>
          <p className={`text-lg font-bold mt-0.5 ${dirColor}`}>
            {isLong ? '▲ LONG' : '▼ SHORT'} ETH/USDT
          </p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-[10px]">Válida ~</p>
          <p className="text-warn font-bold text-sm">{plan.validMinutes} min</p>
        </div>
      </div>

      {/* Prices */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center bg-surface-700 rounded-xl px-3 py-2">
          <span className="text-slate-300 text-xs">🎯 Entrada</span>
          <span className="font-mono font-bold text-white text-sm">${plan.entry.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center bg-down/10 border border-down/20 rounded-xl px-3 py-2">
          <span className="text-slate-300 text-xs">🛑 Stop-Loss</span>
          <div className="text-right">
            <span className="font-mono font-bold text-down text-sm">${plan.stopLoss.toFixed(2)}</span>
            <p className="text-down/70 text-[10px] font-mono">-{plan.slPercent.toFixed(2)}%</p>
          </div>
        </div>
        <div className="flex justify-between items-center bg-up/10 border border-up/20 rounded-xl px-3 py-2">
          <span className="text-slate-300 text-xs">✅ TP1 · R:R 1:{plan.riskReward1.toFixed(1)}</span>
          <div className="text-right">
            <span className="font-mono font-bold text-up text-sm">${plan.takeProfit1.toFixed(2)}</span>
            <p className="text-up/70 text-[10px] font-mono">+{plan.tp1Percent.toFixed(2)}%</p>
          </div>
        </div>
        <div className="flex justify-between items-center bg-up/5 border border-up/10 rounded-xl px-3 py-2">
          <span className="text-slate-300 text-xs">✅ TP2 · R:R 1:{plan.riskReward2.toFixed(1)}</span>
          <div className="text-right">
            <span className="font-mono font-bold text-up text-sm">${plan.takeProfit2.toFixed(2)}</span>
            <p className="text-up/70 text-[10px] font-mono">+{plan.tp2Percent.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* Risk summary */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          { label: 'Apalancamiento', value: '15x' },
          { label: 'Margen', value: `$${plan.marginRequired.toFixed(0)}` },
          { label: 'Pérdida máx', value: `$${plan.maxLoss.toFixed(0)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-700 rounded-xl p-2 text-center">
            <p className="text-slate-400 text-[10px]">{label}</p>
            <p className="text-white font-bold font-mono text-xs mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
          copied
            ? 'bg-up text-white'
            : 'bg-brand text-white hover:bg-brand/80 active:scale-95'
        }`}
      >
        {copied ? '✓ Copiado — pega en Telegram/WhatsApp' : '📤 Copiar señal de grupo'}
      </button>

      <p className="text-slate-500 text-[10px] text-center">
        Capital base: $300 · 2% riesgo por operación · 15x apalancamiento
      </p>
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

      {/* Entry plan (only when directional signal) */}
      {analysis.entryPlan && <EntryPlanCard plan={analysis.entryPlan} />}

      {/* S/R levels */}
      <SRLevels
        supports={analysis.supports}
        resistances={analysis.resistances}
        currentPrice={analysis.currentPrice}
      />

      {/* Technical indicators */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-white font-bold text-sm">Indicadores Técnicos</h3>
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

      {/* Reasons */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-2">
        <h3 className="text-white font-bold text-sm">¿Por qué esta señal?</h3>
        {analysis.reasons.map((reason, i) => (
          <div key={i} className="flex items-start gap-2 bg-surface-700 rounded-xl px-3 py-2">
            <span className="text-brand text-xs mt-0.5">•</span>
            <span className="text-slate-200 text-xs leading-relaxed">{reason}</span>
          </div>
        ))}
        <p className="text-slate-500 text-xs pt-1">
          * Análisis técnico automático. No es asesoría financiera. Siempre usa stop-loss.
        </p>
      </div>
    </div>
  )
}
