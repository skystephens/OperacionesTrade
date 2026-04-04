import { useMemo, useState } from 'react'
import { useBinanceKlines } from '../hooks/useBinanceWS'
import { analyzeMarket } from '../utils/indicators'
import type { EntryPlan } from '../utils/indicators'
import { MakeSignal } from './MakeSignal'

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

  type LevelRow = { label: string; price: number; type: 'resistance' | 'current' | 'support'; tag: string; key: boolean }

  const rows: LevelRow[] = [
    ...(r3 ? [{ label: 'Resistencia 3', price: r3, type: 'resistance' as const, tag: 'R3', key: false }] : []),
    ...(r2 ? [{ label: 'Resistencia 2', price: r2, type: 'resistance' as const, tag: 'R2', key: false }] : []),
    ...(r1 ? [{ label: 'Resistencia 1', price: r1, type: 'resistance' as const, tag: 'R1', key: true }] : []),
    { label: 'Precio actual', price: currentPrice, type: 'current' as const, tag: '●', key: false },
    ...(s1 ? [{ label: 'Soporte 1', price: s1, type: 'support' as const, tag: 'S1', key: true }] : []),
    ...(s2 ? [{ label: 'Soporte 2', price: s2, type: 'support' as const, tag: 'S2', key: false }] : []),
    ...(s3 ? [{ label: 'Soporte 3', price: s3, type: 'support' as const, tag: 'S3', key: false }] : []),
  ]

  // Visual gauge: show current price position between nearest S1 and R1
  const gaugeMin = s1 ?? (currentPrice * 0.98)
  const gaugeMax = r1 ?? (currentPrice * 1.02)
  const gaugeRange = gaugeMax - gaugeMin
  const currentPct = gaugeRange > 0 ? Math.max(0, Math.min(100, ((currentPrice - gaugeMin) / gaugeRange) * 100)) : 50
  const distToR1 = r1 ? (((r1 - currentPrice) / currentPrice) * 100).toFixed(2) : null
  const distToS1 = s1 ? (((currentPrice - s1) / currentPrice) * 100).toFixed(2) : null

  return (
    <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-bold text-sm">Soportes y Resistencias</h3>
        <span className="text-slate-400 text-xs">Pivot points reales</span>
      </div>

      {/* Visual gauge */}
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-up font-bold">{s1 ? `S1 $${s1.toFixed(2)}` : '—'}</span>
          <span className="text-slate-400">zona de precio</span>
          <span className="text-down font-bold">{r1 ? `R1 $${r1.toFixed(2)}` : '—'}</span>
        </div>

        {/* Bar */}
        <div className="relative h-7 rounded-xl overflow-hidden bg-gradient-to-r from-up/25 via-surface-700 to-down/25 border border-surface-600">
          {/* zone fills */}
          <div className="absolute inset-0 bg-gradient-to-r from-up/10 to-transparent" style={{ width: `${currentPct}%` }} />
          <div className="absolute inset-0 bg-gradient-to-l from-down/10 to-transparent" style={{ left: `${currentPct}%` }} />
          {/* center labels */}
          {distToS1 && (
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-up/70">
              -{distToS1}%
            </span>
          )}
          {distToR1 && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-down/70">
              +{distToR1}%
            </span>
          )}
          {/* current price marker */}
          <div
            className="absolute top-0.5 bottom-0.5 w-0.5 bg-white rounded-full shadow-lg transition-all duration-500"
            style={{ left: `calc(${currentPct}% - 1px)` }}
          />
          {/* price label */}
          <div
            className="absolute -top-px text-[9px] font-mono font-bold text-white bg-brand px-1 rounded-b-md transition-all duration-500"
            style={{
              left: `${currentPct}%`,
              transform: `translateX(${currentPct > 80 ? '-100%' : currentPct < 20 ? '0%' : '-50%'})`,
            }}
          >
            ${currentPrice.toFixed(0)}
          </div>
        </div>

        {/* Support/Resistance zone labels */}
        <div className="flex justify-between text-[9px] text-slate-500">
          <span>← Zona soporte (Long)</span>
          <span>(Short) Zona resistencia →</span>
        </div>
      </div>

      {/* All levels — compact list */}
      <div className="space-y-1">
        {rows.map((row) => {
          const pctFromCurrent = ((row.price - currentPrice) / currentPrice) * 100

          return (
            <div
              key={row.tag}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                row.type === 'resistance'
                  ? row.key ? 'bg-down/15 border border-down/30' : 'bg-down/5 border border-down/10'
                  : row.type === 'support'
                  ? row.key ? 'bg-up/15 border border-up/30' : 'bg-up/5 border border-up/10'
                  : 'bg-surface-700 border border-surface-600'
              }`}
            >
              {/* Tag badge */}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md w-8 text-center shrink-0 ${
                row.type === 'resistance' ? 'bg-down/20 text-down' :
                row.type === 'support' ? 'bg-up/20 text-up' :
                'bg-surface-600 text-white'
              }`}>
                {row.tag}
              </span>

              {/* Mini bar showing distance */}
              {row.type !== 'current' && (
                <div className="flex-1 h-1.5 bg-surface-900/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.type === 'resistance' ? 'bg-down/50' : 'bg-up/50'}`}
                    style={{ width: `${Math.min(100, Math.abs(pctFromCurrent) * 10)}%` }}
                  />
                </div>
              )}
              {row.type === 'current' && <div className="flex-1" />}

              {/* Price + pct */}
              <div className="text-right shrink-0">
                <span className={`font-mono font-bold text-xs ${
                  row.type === 'resistance' ? 'text-down' :
                  row.type === 'support' ? 'text-up' :
                  'text-white'
                }`}>
                  ${row.price.toFixed(2)}
                </span>
                {row.type !== 'current' && (
                  <p className="text-slate-500 text-[9px] font-mono">
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

function EntryPlanCard({ plan, signal }: { plan: EntryPlan; signal: string }) {
  const [copied, setCopied] = useState(false)
  const isNeutral = signal === 'NEUTRAL'

  function handleCopy() {
    navigator.clipboard.writeText(plan.shareText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const isLong = plan.direction === 'LONG'
  const dirColor = isNeutral ? 'text-warn' : isLong ? 'text-up' : 'text-down'
  const dirBg = isNeutral ? 'bg-warn/10 border-warn/20' : isLong ? 'bg-up/10 border-up/30' : 'bg-down/10 border-down/30'

  return (
    <div className={`bg-surface-800 rounded-2xl p-4 space-y-3 border ${dirBg}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-300 text-xs font-semibold uppercase tracking-widest">
            {isNeutral ? 'Niveles de referencia' : 'Operación sugerida'}
          </p>
          <p className={`text-lg font-bold mt-0.5 ${dirColor}`}>
            {isNeutral ? '— ESPERAR SEÑAL' : isLong ? '▲ LONG ETH/USDT' : '▼ SHORT ETH/USDT'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-[10px]">{isNeutral ? 'Mercado' : 'Válida ~'}</p>
          <p className={`font-bold text-sm ${isNeutral ? 'text-warn' : 'text-warn'}`}>
            {isNeutral ? 'Lateral' : `${plan.validMinutes} min`}
          </p>
        </div>
      </div>

      {/* Neutral explanation */}
      {isNeutral && (
        <div className="bg-warn/5 border border-warn/20 rounded-xl px-3 py-2">
          <p className="text-warn text-xs font-semibold">¿Por qué esperar?</p>
          <p className="text-slate-300 text-xs mt-1 leading-relaxed">
            El mercado no tiene dirección clara. Los niveles abajo son referenciales — cuando el precio toque un soporte o resistencia y el score supere ±20, aparece la señal de entrada.
          </p>
        </div>
      )}

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

      {/* Copy button — only when signal is directional */}
      {!isNeutral && (
        <>
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
        </>
      )}
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
      {/* Make.com webhook signal */}
      <MakeSignal />

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-surface-700" />
        <span className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Análisis técnico local</span>
        <div className="flex-1 h-px bg-surface-700" />
      </div>

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

      {/* Entry plan — always visible */}
      <EntryPlanCard plan={analysis.entryPlan} signal={analysis.signal} />

      {/* S/R levels */}
      <SRLevels
        supports={analysis.supports}
        resistances={analysis.resistances}
        currentPrice={analysis.currentPrice}
      />

      {/* MACD */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-white font-bold text-sm">MACD</h3>
          <span className="text-slate-400 text-xs">Momentum del precio</span>
        </div>

        {/* Histogram bar visual */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Bajista</span><span>Alcista</span>
          </div>
          <div className="relative h-4 bg-surface-700 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-down via-surface-700 to-up opacity-20 rounded-full" />
            {/* center line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-surface-600" />
            {/* histogram bar */}
            {(() => {
              const h = analysis.macd.histogram
              const maxH = 5 // clamp visual range
              const clamped = Math.max(-maxH, Math.min(maxH, h))
              const pct = Math.abs(clamped) / maxH * 50
              const isPos = h >= 0
              return (
                <div
                  className={`absolute top-1 bottom-1 rounded-full transition-all duration-500 ${isPos ? 'bg-up' : 'bg-down'}`}
                  style={isPos
                    ? { left: '50%', width: `${pct}%` }
                    : { right: '50%', width: `${pct}%` }}
                />
              )
            })()}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: 'MACD',
              value: analysis.macd.macd.toFixed(3),
              color: analysis.macd.macd >= 0 ? 'text-up' : 'text-down',
              hint: analysis.macd.macd >= 0 ? 'Sobre cero' : 'Bajo cero',
            },
            {
              label: 'Señal',
              value: analysis.macd.signal.toFixed(3),
              color: 'text-slate-200',
              hint: 'Línea de señal',
            },
            {
              label: 'Histograma',
              value: analysis.macd.histogram.toFixed(3),
              color: analysis.macd.histogram >= 0 ? 'text-up' : 'text-down',
              hint: analysis.macd.histogram >= 0 ? '↑ Momentum alcista' : '↓ Momentum bajista',
            },
          ].map(({ label, value, color, hint }) => (
            <div key={label} className="bg-surface-700 rounded-xl p-2.5 text-center">
              <p className="text-slate-400 text-[10px]">{label}</p>
              <p className={`font-mono font-bold text-xs mt-1 ${color}`}>{value}</p>
              <p className="text-slate-500 text-[10px] mt-0.5 leading-tight">{hint}</p>
            </div>
          ))}
        </div>

        {analysis.macd.crossover && (
          <div className={`rounded-xl px-3 py-2 border ${
            analysis.macd.crossover === 'bullish_cross'
              ? 'bg-up/10 border-up/30'
              : 'bg-down/10 border-down/30'
          }`}>
            <p className={`text-xs font-bold ${analysis.macd.crossover === 'bullish_cross' ? 'text-up' : 'text-down'}`}>
              {analysis.macd.crossover === 'bullish_cross'
                ? '⚡ MACD cruzó al alza — señal de compra fuerte'
                : '⚡ MACD cruzó a la baja — señal de venta fuerte'}
            </p>
          </div>
        )}
      </div>

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
