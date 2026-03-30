import { useState, useEffect } from 'react'
import { analyzeMarket } from '../utils/indicators'
import type { AnalysisResult } from '../utils/indicators'
import type { KlineData } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimTrade {
  index: number
  openTime: string
  direction: 'LONG' | 'SHORT'
  entry: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  exitPrice: number
  exitTime: string
  outcome: 'TP1' | 'TP2' | 'SL' | 'TIMEOUT'
  pnlDollars: number
  pnlPercent: number
  candlesToExit: number
  signalScore: number
}

interface BacktestStats {
  total: number
  wins: number
  losses: number
  winRate: number
  totalPnl: number
  avgWin: number
  avgLoss: number
  bestTrade: number
  worstTrade: number
  maxDrawdown: number
  profitFactor: number
}

// ─── Binance REST fetch ───────────────────────────────────────────────────────

async function fetchKlines(symbol: string, interval: string, limit: number): Promise<KlineData[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Binance error: ${res.status}`)
  const data: unknown[][] = await res.json()
  return data.map((k) => ({
    time: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
    isClosed: true,
  }))
}

// ─── Backtest engine ──────────────────────────────────────────────────────────

function runBacktest(klines: KlineData[]): { trades: SimTrade[]; stats: BacktestStats } {
  const trades: SimTrade[] = []
  const capital = 300
  const riskPct = 0.02
  const leverage = 15
  let inTrade = false

  for (let i = 60; i < klines.length - 1; i++) {
    if (inTrade) continue
    const window = klines.slice(0, i + 1)
    const analysis = analyzeMarket(window)
    if (!analysis || analysis.signal === 'NEUTRAL') continue

    const { direction, entry, stopLoss, takeProfit1, takeProfit2 } = analysis.entryPlan
    const slPct = Math.abs(entry - stopLoss) / entry
    const positionSize = (capital * riskPct) / (entry * slPct)
    inTrade = true

    let outcome: SimTrade['outcome'] = 'TIMEOUT'
    let exitPrice = klines[klines.length - 1].close
    let exitIdx = klines.length - 1
    let candlesToExit = 0

    for (let j = i + 1; j < klines.length; j++) {
      const c = klines[j]
      candlesToExit++

      if (direction === 'LONG') {
        if (c.low <= stopLoss)    { outcome = 'SL';  exitPrice = stopLoss;    exitIdx = j; break }
        if (c.high >= takeProfit2){ outcome = 'TP2'; exitPrice = takeProfit2; exitIdx = j; break }
        if (c.high >= takeProfit1){ outcome = 'TP1'; exitPrice = takeProfit1; exitIdx = j; break }
      } else {
        if (c.high >= stopLoss)   { outcome = 'SL';  exitPrice = stopLoss;    exitIdx = j; break }
        if (c.low <= takeProfit2) { outcome = 'TP2'; exitPrice = takeProfit2; exitIdx = j; break }
        if (c.low <= takeProfit1) { outcome = 'TP1'; exitPrice = takeProfit1; exitIdx = j; break }
      }
      if (candlesToExit >= 24) { exitPrice = c.close; exitIdx = j; break }
    }

    const priceDiff = direction === 'LONG' ? exitPrice - entry : entry - exitPrice
    const pnlDollars = priceDiff * positionSize * leverage
    const pnlPercent = (pnlDollars / capital) * 100

    trades.push({
      index: trades.length + 1,
      openTime: new Date(klines[i].time).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      direction,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
      exitPrice,
      exitTime: new Date(klines[exitIdx].time).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      outcome,
      pnlDollars,
      pnlPercent,
      candlesToExit,
      signalScore: analysis.signalScore,
    })
    inTrade = false
  }

  const closed = trades
  const wins = closed.filter((t) => t.outcome === 'TP1' || t.outcome === 'TP2')
  const losses = closed.filter((t) => t.outcome === 'SL')
  const totalPnl = closed.reduce((s, t) => s + t.pnlDollars, 0)
  const grossWin = wins.reduce((s, t) => s + t.pnlDollars, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlDollars, 0))

  let peak = 0, runningPnl = 0, maxDrawdown = 0
  for (const t of closed) {
    runningPnl += t.pnlDollars
    if (runningPnl > peak) peak = runningPnl
    const dd = peak - runningPnl
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  return {
    trades,
    stats: {
      total: closed.length,
      wins: wins.length,
      losses: losses.length,
      winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
      totalPnl,
      avgWin: wins.length ? grossWin / wins.length : 0,
      avgLoss: losses.length ? -grossLoss / losses.length : 0,
      bestTrade: wins.length ? Math.max(...wins.map((t) => t.pnlDollars)) : 0,
      worstTrade: losses.length ? Math.min(...losses.map((t) => t.pnlDollars)) : 0,
      maxDrawdown,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0,
    },
  }
}

// ─── Price Ladder Visual ──────────────────────────────────────────────────────

function PriceLadder({ analysis }: { analysis: AnalysisResult }) {
  const { entryPlan, currentPrice, resistances, supports } = analysis
  const { direction, entry, stopLoss, takeProfit1, takeProfit2 } = entryPlan
  const isLong = direction === 'LONG'

  // Build price levels sorted high→low
  const r1 = resistances[0] ?? takeProfit2 * 1.01
  const s1 = supports[0] ?? stopLoss * 0.99

  const allLevels = [
    { price: Math.max(r1, takeProfit2) * 1.005, label: '', type: 'spacer' },
    { price: takeProfit2, label: `TP2  $${takeProfit2.toFixed(2)}`, type: 'tp2' },
    { price: takeProfit1, label: `TP1  $${takeProfit1.toFixed(2)}`, type: 'tp1' },
    { price: entry,       label: `ENTRADA  $${entry.toFixed(2)}`,   type: 'entry' },
    { price: currentPrice,label: `Precio actual  $${currentPrice.toFixed(2)}`, type: 'current' },
    { price: stopLoss,    label: `SL  $${stopLoss.toFixed(2)}`,    type: 'sl' },
    { price: Math.min(s1, stopLoss) * 0.995, label: '', type: 'spacer' },
  ]

  const sorted = isLong
    ? allLevels.sort((a, b) => b.price - a.price)
    : allLevels.sort((a, b) => a.price - b.price)

  const min = Math.min(...allLevels.map((l) => l.price))
  const max = Math.max(...allLevels.map((l) => l.price))
  const range = max - min || 1

  return (
    <div className="space-y-1">
      {sorted.filter((l) => l.type !== 'spacer').map((level) => {
        const pct = ((level.price - min) / range) * 100
        const barWidth = isLong ? pct : (100 - pct)

        const cfg = {
          tp2:     { bg: 'bg-up/20 border-up/40',     bar: 'bg-up',   text: 'text-up',      icon: '✅' },
          tp1:     { bg: 'bg-up/10 border-up/20',     bar: 'bg-up',   text: 'text-up',      icon: '🎯' },
          entry:   { bg: 'bg-brand/20 border-brand/40', bar: 'bg-brand', text: 'text-brand', icon: '⚡' },
          current: { bg: 'bg-surface-700 border-surface-600', bar: 'bg-slate-400', text: 'text-white', icon: '●' },
          sl:      { bg: 'bg-down/15 border-down/30', bar: 'bg-down', text: 'text-down',    icon: '🛑' },
        }[level.type] ?? { bg: 'bg-surface-700 border-surface-600', bar: 'bg-slate-400', text: 'text-white', icon: '·' }

        return (
          <div key={level.type} className={`rounded-xl px-3 py-2.5 border ${cfg.bg}`}>
            <div className="flex justify-between items-center mb-1.5">
              <span className={`text-xs font-bold ${cfg.text}`}>
                {cfg.icon} {level.label}
              </span>
              <span className="text-slate-400 text-[10px] font-mono">
                {level.price !== entry
                  ? `${(((level.price - entry) / entry) * 100).toFixed(2)}%`
                  : 'referencia'}
              </span>
            </div>
            <div className="h-1.5 bg-surface-900/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                style={{ width: `${Math.max(4, Math.min(100, barWidth))}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Binance Params Card ──────────────────────────────────────────────────────

function BinanceParamsCard({ analysis }: { analysis: AnalysisResult }) {
  const [copied, setCopied] = useState(false)
  const { entryPlan, signal } = analysis
  const { direction, entry, stopLoss, takeProfit1, takeProfit2, marginRequired, positionSizeEth } = entryPlan
  const isLong = direction === 'LONG'
  const isNeutral = signal === 'NEUTRAL'

  const binanceText =
    `BINANCE FUTURES — ETHUSDT PERP\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Dirección:       ${isLong ? 'LONG / BUY' : 'SHORT / SELL'}\n` +
    `Apalancamiento:  15x — ISOLATED\n` +
    `Tipo orden:      LIMIT\n` +
    `Precio entrada:  $${entry.toFixed(2)}\n` +
    `Tamaño pos.:     ${positionSizeEth.toFixed(4)} ETH\n` +
    `Margen:          $${marginRequired.toFixed(2)} USDT\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Stop-Loss:       $${stopLoss.toFixed(2)}\n` +
    `Take-Profit 1:   $${takeProfit1.toFixed(2)}\n` +
    `Take-Profit 2:   $${takeProfit2.toFixed(2)}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Capital base: $300 · Riesgo: 2% · Score: ${analysis.signalScore > 0 ? '+' : ''}${analysis.signalScore}`

  function handleCopy() {
    navigator.clipboard.writeText(binanceText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const borderColor = isNeutral ? 'border-warn/30' : isLong ? 'border-up/40' : 'border-down/40'
  const bgColor = isNeutral ? 'bg-warn/5' : isLong ? 'bg-up/5' : 'bg-down/5'

  return (
    <div className={`rounded-2xl border ${borderColor} ${bgColor} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-3 ${isNeutral ? 'bg-warn/10' : isLong ? 'bg-up/10' : 'bg-down/10'}`}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest">Parámetros Binance Futures</p>
            <p className={`text-lg font-bold mt-0.5 ${isNeutral ? 'text-warn' : isLong ? 'text-up' : 'text-down'}`}>
              {isNeutral ? '— Esperando señal' : isLong ? '▲ LONG — COMPRAR' : '▼ SHORT — VENDER'}
            </p>
          </div>
          <div className={`text-3xl opacity-30`}>
            {isNeutral ? '⏳' : isLong ? '📈' : '📉'}
          </div>
        </div>
      </div>

      {/* Params table */}
      <div className="p-4 space-y-1.5">
        {isNeutral && (
          <div className="bg-warn/10 border border-warn/20 rounded-xl px-3 py-2 mb-3">
            <p className="text-warn text-xs">Señal neutral — los niveles mostrados son referenciales. Espera que el score supere +20 o baje de -20 para una entrada válida.</p>
          </div>
        )}

        {[
          { label: 'Par',           value: 'ETHUSDT PERPETUAL', mono: false },
          { label: 'Dirección',     value: isLong ? '▲ LONG / BUY' : '▼ SHORT / SELL', color: isLong ? 'text-up' : 'text-down' },
          { label: 'Apalancamiento',value: '15x — Margen ISOLATED', color: 'text-warn' },
          { label: 'Tipo de orden', value: 'LIMIT', mono: true },
          { label: 'Precio entrada',value: `$${entry.toFixed(2)}`, mono: true, highlight: true },
          { label: 'Tamaño posición',value: `${positionSizeEth.toFixed(4)} ETH`, mono: true },
          { label: 'Margen requerido',value: `$${marginRequired.toFixed(2)} USDT`, mono: true },
          { label: 'Stop-Loss',     value: `$${stopLoss.toFixed(2)}`, mono: true, color: 'text-down' },
          { label: 'Take-Profit 1', value: `$${takeProfit1.toFixed(2)}`, mono: true, color: 'text-up' },
          { label: 'Take-Profit 2', value: `$${takeProfit2.toFixed(2)}`, mono: true, color: 'text-up' },
        ].map(({ label, value, mono, highlight, color }) => (
          <div
            key={label}
            className={`flex justify-between items-center px-3 py-2 rounded-xl ${highlight ? 'bg-brand/10 border border-brand/30' : 'bg-surface-800/80'}`}
          >
            <span className="text-slate-400 text-xs">{label}</span>
            <span className={`text-xs font-bold ${mono ? 'font-mono' : ''} ${color ?? 'text-white'}`}>
              {value}
            </span>
          </div>
        ))}

        {/* Steps guide */}
        <div className="mt-3 bg-surface-800 rounded-xl p-3 space-y-1.5">
          <p className="text-slate-300 text-xs font-bold">Cómo ingresar en Binance:</p>
          {[
            'Abrir Binance → Futuros → ETHUSDT',
            `Configurar ${isLong ? '15x' : '15x'} ISOLATED`,
            `Seleccionar ${isLong ? 'BUY/LONG' : 'SELL/SHORT'} → LIMIT`,
            `Precio: $${entry.toFixed(2)} · Cantidad: ${positionSizeEth.toFixed(4)} ETH`,
            `Activar TP/SL: SL $${stopLoss.toFixed(2)} · TP $${takeProfit1.toFixed(2)}`,
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-brand text-[10px] font-bold mt-0.5 shrink-0">{i + 1}.</span>
              <span className="text-slate-300 text-[10px] leading-relaxed">{step}</span>
            </div>
          ))}
        </div>

        {!isNeutral && (
          <button
            onClick={handleCopy}
            className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all mt-2 ${
              copied ? 'bg-up text-white' : 'bg-brand text-white hover:bg-brand/80 active:scale-95'
            }`}
          >
            {copied ? '✓ Copiado — pega en notas o Telegram' : '📋 Copiar parámetros completos'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const INTERVALS = [
  { value: '1h',  label: '1h · ~21 días de historia' },
  { value: '4h',  label: '4h · ~83 días de historia' },
  { value: '15m', label: '15m · ~5 días de historia' },
]

interface Props { symbol: string }

export function Backtester({ symbol }: Props) {
  const [liveAnalysis, setLiveAnalysis] = useState<AnalysisResult | null>(null)
  const [liveLoading, setLiveLoading] = useState(true)

  const [btInterval, setBtInterval] = useState('1h')
  const [btStatus, setBtStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [btResult, setBtResult] = useState<{ trades: SimTrade[]; stats: BacktestStats } | null>(null)
  const [btError, setBtError] = useState('')
  const [showAll, setShowAll] = useState(false)

  // Load live analysis on mount
  useEffect(() => {
    fetchKlines(symbol, '5m', 120).then((klines) => {
      setLiveAnalysis(analyzeMarket(klines))
      setLiveLoading(false)
    }).catch(() => setLiveLoading(false))
  }, [symbol])

  async function runSim() {
    setBtStatus('loading')
    setBtResult(null)
    try {
      const klines = await fetchKlines(symbol, btInterval, 500)
      setBtResult(runBacktest(klines))
      setBtStatus('done')
    } catch (e) {
      setBtError(e instanceof Error ? e.message : 'Error')
      setBtStatus('error')
    }
  }

  const { trades = [], stats } = btResult ?? {}
  const visibleTrades = showAll ? trades : trades.slice(-8)

  return (
    <div className="space-y-4">

      {/* ── SECTION 1: Live signal + Binance params ── */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-1">
        <p className="text-slate-300 text-xs font-semibold uppercase tracking-widest">Señal en vivo · ETH/USDT</p>
        <p className="text-slate-500 text-[10px]">Basado en últimas 120 velas de 5m</p>
      </div>

      {liveLoading ? (
        <div className="bg-surface-800 rounded-2xl p-8 flex items-center justify-center">
          <div className="space-y-2 text-center">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Cargando señal...</p>
          </div>
        </div>
      ) : liveAnalysis ? (
        <>
          <BinanceParamsCard analysis={liveAnalysis} />

          {/* Price ladder */}
          <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold text-sm">Visual de la operación</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                liveAnalysis.signal === 'NEUTRAL' ? 'bg-warn/20 text-warn' :
                liveAnalysis.signal.includes('LONG') ? 'bg-up/20 text-up' : 'bg-down/20 text-down'
              }`}>
                Score {liveAnalysis.signalScore > 0 ? '+' : ''}{liveAnalysis.signalScore}
              </span>
            </div>
            <PriceLadder analysis={liveAnalysis} />
            <p className="text-slate-500 text-[10px] text-center">
              Las barras muestran la distancia relativa entre cada nivel de precio
            </p>
          </div>
        </>
      ) : (
        <div className="bg-surface-800 rounded-2xl p-4 text-center text-slate-400 text-sm">
          No se pudo cargar la señal en vivo
        </div>
      )}

      {/* ── SECTION 2: Backtest ── */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-4">
        <div>
          <h3 className="text-white font-bold text-sm">Historial simulado</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            ¿Cuánto habrías ganado si hubieras tomado cada señal en el pasado?
          </p>
        </div>

        <div className="space-y-1.5">
          {INTERVALS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setBtInterval(value)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-mono transition-colors ${
                btInterval === value ? 'bg-brand text-white font-bold' : 'bg-surface-700 text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={runSim}
          disabled={btStatus === 'loading'}
          className="w-full py-3 rounded-xl font-bold text-sm bg-brand text-white disabled:opacity-50 active:scale-95 transition-all"
        >
          {btStatus === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Simulando...
            </span>
          ) : '🔬 Correr simulación'}
        </button>
        {btStatus === 'error' && <p className="text-down text-xs text-center">{btError}</p>}
      </div>

      {/* Backtest results */}
      {stats && (
        <>
          <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-white font-bold text-sm">Resultado</h3>

            {/* Win rate bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Win rate · {stats.wins}W / {stats.losses}L</span>
                <span className={`font-bold font-mono ${stats.winRate >= 55 ? 'text-up' : stats.winRate >= 45 ? 'text-warn' : 'text-down'}`}>
                  {stats.winRate.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 bg-surface-700 rounded-full overflow-hidden flex">
                <div className="h-full bg-up rounded-l-full" style={{ width: `${stats.winRate}%` }} />
                <div className="h-full bg-down flex-1 rounded-r-full" />
              </div>
              <p className="text-slate-500 text-[10px]">
                {stats.winRate >= 60 ? '✅ Estrategia rentable con este historial' :
                 stats.winRate >= 50 ? '⚠️ Positivo pero ajustado' :
                 '❌ Más pérdidas que ganancias — revisar parámetros'}
              </p>
            </div>

            {/* Numbers */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'P&L total', value: `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`, color: stats.totalPnl >= 0 ? 'text-up' : 'text-down', sub: `${((stats.totalPnl / 300) * 100).toFixed(1)}% del capital` },
                { label: 'Profit Factor', value: stats.profitFactor >= 99 ? '∞' : stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1.5 ? 'text-up' : stats.profitFactor >= 1 ? 'text-warn' : 'text-down', sub: stats.profitFactor >= 1.5 ? 'Muy bueno' : stats.profitFactor >= 1 ? 'OK' : 'Negativo' },
                { label: 'Ganancia prom.', value: `+$${stats.avgWin.toFixed(2)}`, color: 'text-up', sub: 'por trade ganado' },
                { label: 'Pérdida prom.', value: `$${stats.avgLoss.toFixed(2)}`, color: 'text-down', sub: 'por trade perdido' },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="bg-surface-700 rounded-xl p-3">
                  <p className="text-slate-400 text-[10px]">{label}</p>
                  <p className={`font-mono font-bold text-sm mt-0.5 ${color}`}>{value}</p>
                  <p className="text-slate-500 text-[10px] mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Trade list */}
          <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold text-sm">Operaciones</h3>
              <span className="text-slate-400 text-xs">{trades.length} simuladas</span>
            </div>

            {trades.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">Sin señales en este período</p>
            ) : (
              <>
                <div className="space-y-2">
                  {visibleTrades.map((t) => {
                    const isWin = t.outcome === 'TP1' || t.outcome === 'TP2'
                    const isSL = t.outcome === 'SL'
                    return (
                      <div
                        key={t.index}
                        className={`rounded-xl overflow-hidden border ${isWin ? 'border-up/25' : isSL ? 'border-down/25' : 'border-warn/25'}`}
                      >
                        {/* Trade header bar */}
                        <div className={`px-3 py-2 flex justify-between items-center ${isWin ? 'bg-up/10' : isSL ? 'bg-down/10' : 'bg-warn/10'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${t.direction === 'LONG' ? 'bg-up/20 text-up' : 'bg-down/20 text-down'}`}>
                              {t.direction === 'LONG' ? '▲ L' : '▼ S'}
                            </span>
                            <span className="text-slate-300 text-xs">{t.openTime}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold ${isWin ? 'text-up' : isSL ? 'text-down' : 'text-warn'}`}>
                              {t.outcome === 'TP2' ? '✅ TP2' : t.outcome === 'TP1' ? '✅ TP1' : t.outcome === 'SL' ? '🛑 SL' : '⏱ Tiempo'}
                            </span>
                            <span className={`font-mono font-bold text-sm ${t.pnlDollars >= 0 ? 'text-up' : 'text-down'}`}>
                              {t.pnlDollars >= 0 ? '+' : ''}${t.pnlDollars.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {/* Trade details */}
                        <div className="px-3 py-2 bg-surface-700/50 grid grid-cols-3 gap-1">
                          {[
                            { l: 'Entrada', v: `$${t.entry.toFixed(1)}` },
                            { l: 'Salida', v: `$${t.exitPrice.toFixed(1)}` },
                            { l: '% capital', v: `${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(1)}%` },
                          ].map(({ l, v }) => (
                            <div key={l} className="text-center">
                              <p className="text-slate-500 text-[9px]">{l}</p>
                              <p className="text-slate-200 text-[10px] font-mono font-bold">{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {trades.length > 8 && (
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full py-2 rounded-xl text-xs font-bold bg-surface-700 text-slate-300 hover:bg-surface-600 transition-colors"
                  >
                    {showAll ? 'Ver menos' : `Ver todas (${trades.length})`}
                  </button>
                )}
              </>
            )}
          </div>

          <p className="text-slate-600 text-[10px] text-center px-4 pb-2">
            Simulación sobre datos reales de Binance. No garantiza resultados futuros. Incluye fees y slippage en cálculos reales.
          </p>
        </>
      )}
    </div>
  )
}
