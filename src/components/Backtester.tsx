import { useState } from 'react'
import { analyzeMarket } from '../utils/indicators'
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
  outcome: 'TP1' | 'TP2' | 'SL' | 'OPEN'
  pnlDollars: number   // based on $300 capital, 2% risk, 15x
  pnlPercent: number   // % of capital
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
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`)
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
    if (!analysis) continue

    const { signal, entryPlan, signalScore } = analysis
    if (signal === 'NEUTRAL') continue

    // Enter trade
    const { direction, entry, stopLoss, takeProfit1, takeProfit2 } = entryPlan
    const maxLoss = capital * riskPct
    const slPct = Math.abs(entry - stopLoss) / entry
    const positionSize = maxLoss / (entry * slPct)
    inTrade = true

    // Scan forward to find exit
    let outcome: SimTrade['outcome'] = 'OPEN'
    let exitPrice = klines[klines.length - 1].close
    let exitIdx = klines.length - 1
    let candlesToExit = 0

    for (let j = i + 1; j < klines.length; j++) {
      const candle = klines[j]
      candlesToExit++

      if (direction === 'LONG') {
        // SL check first (conservative — assumes worst case if both in range)
        if (candle.low <= stopLoss) {
          outcome = 'SL'; exitPrice = stopLoss; exitIdx = j; break
        }
        if (candle.high >= takeProfit2) {
          outcome = 'TP2'; exitPrice = takeProfit2; exitIdx = j; break
        }
        if (candle.high >= takeProfit1) {
          outcome = 'TP1'; exitPrice = takeProfit1; exitIdx = j; break
        }
      } else {
        if (candle.high >= stopLoss) {
          outcome = 'SL'; exitPrice = stopLoss; exitIdx = j; break
        }
        if (candle.low <= takeProfit2) {
          outcome = 'TP2'; exitPrice = takeProfit2; exitIdx = j; break
        }
        if (candle.low <= takeProfit1) {
          outcome = 'TP1'; exitPrice = takeProfit1; exitIdx = j; break
        }
      }

      // Max hold: 24 candles (1 day at 1h)
      if (candlesToExit >= 24) {
        outcome = 'OPEN'
        exitPrice = candle.close
        exitIdx = j
        break
      }
    }

    const priceDiff = direction === 'LONG'
      ? exitPrice - entry
      : entry - exitPrice

    const pnlDollars = priceDiff * positionSize * leverage
    const pnlPercent = (pnlDollars / capital) * 100

    const openTime = new Date(klines[i].time).toLocaleDateString('es-CO', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    const exitTime = new Date(klines[exitIdx].time).toLocaleDateString('es-CO', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    trades.push({
      index: trades.length + 1,
      openTime,
      direction,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
      exitPrice,
      exitTime,
      outcome,
      pnlDollars,
      pnlPercent,
      candlesToExit,
      signalScore,
    })

    inTrade = false
  }

  // Stats
  const closed = trades.filter((t) => t.outcome !== 'OPEN')
  const wins = closed.filter((t) => t.outcome === 'TP1' || t.outcome === 'TP2')
  const losses = closed.filter((t) => t.outcome === 'SL')
  const totalPnl = closed.reduce((sum, t) => sum + t.pnlDollars, 0)
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnlDollars, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnlDollars, 0) / losses.length : 0
  const grossWin = wins.reduce((s, t) => s + t.pnlDollars, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlDollars, 0))

  // Max drawdown
  let peak = 0
  let runningPnl = 0
  let maxDrawdown = 0
  for (const t of closed) {
    runningPnl += t.pnlDollars
    if (runningPnl > peak) peak = runningPnl
    const dd = peak - runningPnl
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  const stats: BacktestStats = {
    total: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    totalPnl,
    avgWin,
    avgLoss,
    bestTrade: wins.length ? Math.max(...wins.map((t) => t.pnlDollars)) : 0,
    worstTrade: losses.length ? Math.min(...losses.map((t) => t.pnlDollars)) : 0,
    maxDrawdown,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0,
  }

  return { trades, stats }
}

// ─── Component ────────────────────────────────────────────────────────────────

const INTERVALS = [
  { value: '1h',  label: '1h  · ~21 días' },
  { value: '4h',  label: '4h  · ~83 días' },
  { value: '15m', label: '15m · ~5 días'  },
]

interface Props {
  symbol: string
}

export function Backtester({ symbol }: Props) {
  const [interval, setInterval] = useState('1h')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ trades: SimTrade[]; stats: BacktestStats } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [showAll, setShowAll] = useState(false)

  async function runSim() {
    setStatus('loading')
    setResult(null)
    try {
      const klines = await fetchKlines(symbol, interval, 500)
      const res = runBacktest(klines)
      setResult(res)
      setStatus('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
      setStatus('error')
    }
  }

  const { trades, stats } = result ?? { trades: [], stats: null }
  const visibleTrades = showAll ? trades : trades.slice(-10)

  return (
    <div className="space-y-4">
      {/* Config card */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-4">
        <div>
          <h2 className="text-white font-bold text-base">Simulador de Operaciones</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Corre las señales sobre datos históricos reales de {symbol.replace('USDT', '')}/USDT y ve cuánto habrías ganado o perdido.
          </p>
        </div>

        {/* Interval selector */}
        <div className="space-y-1.5">
          <p className="text-slate-300 text-xs font-semibold">Intervalo de velas</p>
          <div className="space-y-1.5">
            {INTERVALS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setInterval(value)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-mono transition-colors ${
                  interval === value
                    ? 'bg-brand text-white font-bold'
                    : 'bg-surface-700 text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Info box */}
        <div className="bg-surface-700 rounded-xl px-3 py-2.5 space-y-1">
          <p className="text-slate-300 text-xs font-semibold">¿Cómo funciona?</p>
          <p className="text-slate-400 text-xs leading-relaxed">
            Descarga 500 velas históricas de Binance, aplica el mismo algoritmo de señales que usas en vivo (RSI + EMA + MACD + S/R), simula la entrada y ve si el TP o el SL se hubiera tocado primero.
          </p>
          <p className="text-slate-500 text-xs mt-1">
            Capital: $300 · Riesgo: 2%/trade · Apalancamiento: 15x
          </p>
        </div>

        <button
          onClick={runSim}
          disabled={status === 'loading'}
          className="w-full py-3 rounded-xl font-bold text-sm bg-brand text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          {status === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Simulando...
            </span>
          ) : '🔬 Correr simulación'}
        </button>

        {status === 'error' && (
          <p className="text-down text-xs text-center">{errorMsg}</p>
        )}
      </div>

      {/* Results */}
      {stats && (
        <>
          {/* Summary stats */}
          <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-white font-bold text-sm">Resultado del backtest</h3>

            {/* Win rate gauge */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Win rate</span>
                <span className={`font-bold font-mono ${stats.winRate >= 55 ? 'text-up' : stats.winRate >= 45 ? 'text-warn' : 'text-down'}`}>
                  {stats.winRate.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${stats.winRate >= 55 ? 'bg-up' : stats.winRate >= 45 ? 'bg-warn' : 'bg-down'}`}
                  style={{ width: `${Math.min(100, stats.winRate)}%` }}
                />
              </div>
              <p className="text-slate-500 text-[10px]">
                {stats.winRate >= 60 ? '✅ Excelente — estrategia rentable' :
                 stats.winRate >= 50 ? '⚠️ Aceptable — depende del R:R' :
                 '❌ Bajo — revisar condiciones de entrada'}
              </p>
            </div>

            {/* Key numbers grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: 'P&L total',
                  value: `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`,
                  color: stats.totalPnl >= 0 ? 'text-up' : 'text-down',
                  sub: `${((stats.totalPnl / 300) * 100).toFixed(1)}% del capital`,
                },
                {
                  label: 'Profit Factor',
                  value: stats.profitFactor === 999 ? '∞' : stats.profitFactor.toFixed(2),
                  color: stats.profitFactor >= 1.5 ? 'text-up' : stats.profitFactor >= 1 ? 'text-warn' : 'text-down',
                  sub: stats.profitFactor >= 1.5 ? 'Muy bueno' : stats.profitFactor >= 1 ? 'Aceptable' : 'Negativo',
                },
                {
                  label: `Ganadas (${stats.wins})`,
                  value: `+$${stats.avgWin.toFixed(2)}`,
                  color: 'text-up',
                  sub: 'promedio por trade',
                },
                {
                  label: `Perdidas (${stats.losses})`,
                  value: `$${stats.avgLoss.toFixed(2)}`,
                  color: 'text-down',
                  sub: 'promedio por trade',
                },
                {
                  label: 'Mejor trade',
                  value: `+$${stats.bestTrade.toFixed(2)}`,
                  color: 'text-up',
                  sub: '',
                },
                {
                  label: 'Peor trade',
                  value: `$${stats.worstTrade.toFixed(2)}`,
                  color: 'text-down',
                  sub: '',
                },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="bg-surface-700 rounded-xl p-3">
                  <p className="text-slate-400 text-[10px]">{label}</p>
                  <p className={`font-mono font-bold text-sm mt-0.5 ${color}`}>{value}</p>
                  {sub && <p className="text-slate-500 text-[10px] mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center bg-down/10 border border-down/20 rounded-xl px-3 py-2">
              <span className="text-slate-300 text-xs">Max Drawdown</span>
              <span className="font-mono font-bold text-down text-sm">-${stats.maxDrawdown.toFixed(2)}</span>
            </div>
          </div>

          {/* Trade list */}
          <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-bold text-sm">Operaciones simuladas</h3>
              <span className="text-slate-400 text-xs">{trades.length} total</span>
            </div>

            {trades.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">
                No se generaron señales en este período
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {visibleTrades.map((t) => (
                    <div
                      key={t.index}
                      className={`rounded-xl p-3 border ${
                        t.outcome === 'SL'
                          ? 'bg-down/5 border-down/20'
                          : t.outcome === 'OPEN'
                          ? 'bg-warn/5 border-warn/20'
                          : 'bg-up/5 border-up/20'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            t.direction === 'LONG' ? 'bg-up/20 text-up' : 'bg-down/20 text-down'
                          }`}>
                            {t.direction === 'LONG' ? '▲ L' : '▼ S'}
                          </span>
                          <div>
                            <p className="text-slate-300 text-xs">{t.openTime}</p>
                            <p className="text-slate-500 text-[10px]">Entrada: ${t.entry.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-mono font-bold text-sm ${
                            t.pnlDollars >= 0 ? 'text-up' : 'text-down'
                          }`}>
                            {t.pnlDollars >= 0 ? '+' : ''}${t.pnlDollars.toFixed(2)}
                          </p>
                          <p className={`text-[10px] font-bold ${
                            t.outcome === 'TP2' ? 'text-up' :
                            t.outcome === 'TP1' ? 'text-up' :
                            t.outcome === 'SL' ? 'text-down' : 'text-warn'
                          }`}>
                            {t.outcome === 'TP2' ? '✅ TP2' :
                             t.outcome === 'TP1' ? '✅ TP1' :
                             t.outcome === 'SL' ? '🛑 SL' : '⏳ Abierta'}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-between mt-2 pt-2 border-t border-white/5">
                        <span className="text-slate-500 text-[10px]">
                          Salida: ${t.exitPrice.toFixed(2)} · {t.candlesToExit}v
                        </span>
                        <span className={`text-[10px] font-mono ${t.pnlDollars >= 0 ? 'text-up' : 'text-down'}`}>
                          {t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent.toFixed(2)}% capital
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {trades.length > 10 && (
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
            Backtest no garantiza resultados futuros. Condiciones reales incluyen fees, slippage y liquidez variable.
          </p>
        </>
      )}
    </div>
  )
}
