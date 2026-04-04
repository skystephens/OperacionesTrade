import { useState, useEffect, useRef } from 'react'
import { analyzeMarket } from '../utils/indicators'
import type { KlineData } from '../types'
import { Checklist } from './Checklist'

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
  maxDrawdown: number
  profitFactor: number
}

interface OrderLevel { price: number; qty: number }

// ─── Shared journal key ───────────────────────────────────────────────────────

const JOURNAL_KEY = 'trade_journal_v1'

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

// ─── Order Book hook ──────────────────────────────────────────────────────────

function useOrderBook(symbol: string) {
  const [asks, setAsks] = useState<OrderLevel[]>([])
  const [bids, setBids] = useState<OrderLevel[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth10@500ms`
    )
    wsRef.current = ws
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data)
      setAsks(
        (d.asks as string[][]).slice(0, 8).map((a) => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }))
      )
      setBids(
        (d.bids as string[][]).slice(0, 8).map((b) => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }))
      )
    }
    return () => ws.close()
  }, [symbol])

  return { asks, bids }
}

// ─── Live price hook ──────────────────────────────────────────────────────────

function useLivePrice(symbol: string) {
  const [price, setPrice] = useState<number | null>(null)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`
    )
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data)
      setPrice(parseFloat(d.c))
      setPct(parseFloat(d.P))
    }
    return () => ws.close()
  }, [symbol])

  return { price, pct }
}

// ─── Backtest engine ──────────────────────────────────────────────────────────

interface SimParams { capital: number; riskPct: number; leverage: number }

function runBacktest(klines: KlineData[], params: SimParams): { trades: SimTrade[]; stats: BacktestStats } {
  const trades: SimTrade[] = []
  const { capital, riskPct, leverage } = params
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
        if (c.low <= stopLoss)     { outcome = 'SL';  exitPrice = stopLoss;    exitIdx = j; break }
        if (c.high >= takeProfit2) { outcome = 'TP2'; exitPrice = takeProfit2; exitIdx = j; break }
        if (c.high >= takeProfit1) { outcome = 'TP1'; exitPrice = takeProfit1; exitIdx = j; break }
      } else {
        if (c.high >= stopLoss)    { outcome = 'SL';  exitPrice = stopLoss;    exitIdx = j; break }
        if (c.low <= takeProfit2)  { outcome = 'TP2'; exitPrice = takeProfit2; exitIdx = j; break }
        if (c.low <= takeProfit1)  { outcome = 'TP1'; exitPrice = takeProfit1; exitIdx = j; break }
      }
      if (candlesToExit >= 24) { exitPrice = c.close; exitIdx = j; break }
    }

    const priceDiff = direction === 'LONG' ? exitPrice - entry : entry - exitPrice
    const pnlDollars = priceDiff * positionSize * leverage
    const pnlPercent = (pnlDollars / capital) * 100

    trades.push({
      index: trades.length + 1,
      openTime: new Date(klines[i].time).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      direction, entry, stopLoss, takeProfit1, takeProfit2,
      exitPrice,
      exitTime: new Date(klines[exitIdx].time).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      outcome, pnlDollars, pnlPercent, candlesToExit,
      signalScore: analysis.signalScore,
    })
    inTrade = false
  }

  const wins = trades.filter((t) => t.outcome === 'TP1' || t.outcome === 'TP2')
  const losses = trades.filter((t) => t.outcome === 'SL')
  const totalPnl = trades.reduce((s, t) => s + t.pnlDollars, 0)
  const grossWin = wins.reduce((s, t) => s + t.pnlDollars, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlDollars, 0))

  let peak = 0, runningPnl = 0, maxDrawdown = 0
  for (const t of trades) {
    runningPnl += t.pnlDollars
    if (runningPnl > peak) peak = runningPnl
    const dd = peak - runningPnl
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  return {
    trades,
    stats: {
      total: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
      totalPnl,
      avgWin: wins.length ? grossWin / wins.length : 0,
      avgLoss: losses.length ? -grossLoss / losses.length : 0,
      maxDrawdown,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0,
    },
  }
}

// ─── Order Book Panel ─────────────────────────────────────────────────────────

function OrderBook({ symbol, currentPrice, pct }: { symbol: string; currentPrice: number | null; pct: number }) {
  const { asks, bids } = useOrderBook(symbol)

  const maxQty = Math.max(
    ...asks.map((a) => a.qty),
    ...bids.map((b) => b.qty),
    1
  )

  return (
    <div className="flex flex-col h-full text-[11px] font-mono">
      {/* Header */}
      <div className="flex justify-between text-slate-500 px-1 pb-1 border-b border-surface-700 text-[10px]">
        <span>Precio (USDT)</span>
        <span>Monto</span>
      </div>

      {/* Asks (sell orders) — shown high→low so lowest ask is nearest to price */}
      <div className="flex flex-col-reverse">
        {asks.slice(0, 7).map((a, i) => (
          <div key={i} className="relative flex justify-between items-center px-1 py-[3px]">
            <div
              className="absolute right-0 top-0 bottom-0 bg-down/10"
              style={{ width: `${(a.qty / maxQty) * 100}%` }}
            />
            <span className="text-down relative z-10">{a.price.toFixed(2)}</span>
            <span className="text-slate-400 relative z-10">
              {a.qty >= 1000 ? `${(a.qty / 1000).toFixed(1)}K` : a.qty.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Current price */}
      <div className="py-2 px-1 border-y border-surface-700 my-0.5">
        <div className={`text-base font-bold ${pct >= 0 ? 'text-up' : 'text-down'}`}>
          {currentPrice ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
        </div>
        <div className={`text-[10px] ${pct >= 0 ? 'text-up' : 'text-down'}`}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
        </div>
      </div>

      {/* Bids (buy orders) */}
      <div className="flex flex-col">
        {bids.slice(0, 7).map((b, i) => (
          <div key={i} className="relative flex justify-between items-center px-1 py-[3px]">
            <div
              className="absolute right-0 top-0 bottom-0 bg-up/10"
              style={{ width: `${(b.qty / maxQty) * 100}%` }}
            />
            <span className="text-up relative z-10">{b.price.toFixed(2)}</span>
            <span className="text-slate-400 relative z-10">
              {b.qty >= 1000 ? `${(b.qty / 1000).toFixed(1)}K` : b.qty.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Ratio bar */}
      {asks.length > 0 && bids.length > 0 && (() => {
        const totalAsk = asks.reduce((s, a) => s + a.qty, 0)
        const totalBid = bids.reduce((s, b) => s + b.qty, 0)
        const bidPct = (totalBid / (totalAsk + totalBid)) * 100
        return (
          <div className="mt-2 px-1">
            <div className="h-1.5 rounded-full overflow-hidden flex">
              <div className="bg-up h-full" style={{ width: `${bidPct}%` }} />
              <div className="bg-down h-full flex-1" />
            </div>
            <div className="flex justify-between text-[9px] mt-0.5">
              <span className="text-up">{bidPct.toFixed(1)}%</span>
              <span className="text-down">{(100 - bidPct).toFixed(1)}%</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Trading Panel (Binance style) ───────────────────────────────────────────

const SLIDER_PCTS = [0, 25, 50, 75, 100]

function TradingPanel({ symbol, capital, leverage }: { symbol: string; capital: number; leverage: number }) {
  const { price: livePrice, pct } = useLivePrice(symbol)
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG')
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT')
  const [limitPrice, setLimitPrice] = useState<number | null>(null)
  const [sliderPct, setSliderPct] = useState(25)
  const [tp, setTp] = useState('')
  const [sl, setSl] = useState('')
  const [confirmation, setConfirmation] = useState<{ pnl: number } | null>(null)

  const entryPrice = orderType === 'MARKET' ? (livePrice ?? 0) : (limitPrice ?? livePrice ?? 0)
  const margin = (capital * sliderPct) / 100
  const positionValue = margin * leverage
  const qtyEth = entryPrice > 0 ? positionValue / entryPrice : 0
  const liquidationPct = 100 / leverage
  const liquidationPrice = side === 'LONG'
    ? entryPrice * (1 - liquidationPct / 100)
    : entryPrice * (1 + liquidationPct / 100)

  // Auto-fill limit price from live
  useEffect(() => {
    if (limitPrice === null && livePrice) setLimitPrice(livePrice)
  }, [livePrice, limitPrice])

  function adjustPrice(delta: number) {
    setLimitPrice((p) => parseFloat(((p ?? livePrice ?? 0) + delta).toFixed(2)))
  }

  function submit() {
    const existing = JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? '[]')
    const tpVal = parseFloat(tp)
    const slVal = parseFloat(sl)
    const entry = {
      id: `sim_manual_${Date.now()}`,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      pair: `${symbol.replace('USDT', '')}/USDT (SIM)`,
      direction: side,
      entryPrice: entryPrice,
      exitPrice: null,
      size: parseFloat(qtyEth.toFixed(5)),
      leverage,
      pnl: null,
      status: 'OPEN' as const,
      notes: `Orden ${orderType} simulada · Margen $${margin.toFixed(2)} · ${isNaN(tpVal) ? '' : `TP $${tpVal}`} ${isNaN(slVal) ? '' : `SL $${slVal}`}`.trim(),
    }
    localStorage.setItem(JOURNAL_KEY, JSON.stringify([entry, ...existing]))
    setConfirmation({ pnl: 0 })
    setTimeout(() => setConfirmation(null), 3000)
  }

  const isLong = side === 'LONG'

  return (
    <div className="bg-surface-800 rounded-2xl overflow-hidden">
      {/* Symbol header */}
      <div className="px-4 py-2.5 border-b border-surface-700 flex justify-between items-center">
        <div>
          <span className="text-white font-bold text-sm">{symbol.replace('USDT', '')}/USDT</span>
          <span className="text-slate-500 text-xs ml-2">Perp.</span>
        </div>
        <div className="text-right">
          <p className={`font-mono font-bold text-sm ${pct >= 0 ? 'text-up' : 'text-down'}`}>
            {livePrice ? `$${livePrice.toFixed(2)}` : '—'}
          </p>
          <p className={`text-xs font-mono ${pct >= 0 ? 'text-up' : 'text-down'}`}>
            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="flex gap-0">
        {/* ── Left: Order form ── */}
        <div className="flex-1 p-3 space-y-2.5">

          {/* Margin mode + leverage row */}
          <div className="flex gap-1.5 text-xs">
            <div className="bg-surface-700 rounded-lg px-2 py-1 text-slate-300 font-bold">Aislado</div>
            <div className="bg-surface-700 rounded-lg px-2 py-1 text-warn font-bold">{leverage}x</div>
            <div className="bg-surface-700 rounded-lg px-2 py-1 text-slate-300 font-bold">S</div>
          </div>

          {/* Buy / Sell tabs */}
          <div className="flex rounded-xl overflow-hidden border border-surface-700">
            <button
              onClick={() => setSide('LONG')}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${isLong ? 'bg-up text-white' : 'bg-surface-700 text-slate-400'}`}
            >
              Comprar
            </button>
            <button
              onClick={() => setSide('SHORT')}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${!isLong ? 'bg-down text-white' : 'bg-surface-700 text-slate-400'}`}
            >
              Vender
            </button>
          </div>

          {/* Available */}
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Disponible</span>
            <span className="text-white font-mono font-bold">{capital.toFixed(2)} USDT</span>
          </div>

          {/* Order type */}
          <div className="flex gap-1.5">
            {(['LIMIT', 'MARKET'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${orderType === t ? 'bg-brand text-white' : 'bg-surface-700 text-slate-400'}`}
              >
                {t === 'LIMIT' ? 'Límite' : 'Mercado'}
              </button>
            ))}
          </div>

          {/* Price input */}
          {orderType === 'LIMIT' && (
            <div>
              <p className="text-slate-500 text-[10px] mb-1">Precio (USDT)</p>
              <div className="flex items-center gap-1.5 bg-surface-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => adjustPrice(-0.5)}
                  className="px-3 py-2.5 text-slate-300 font-bold text-lg hover:bg-surface-600 transition-colors"
                >−</button>
                <input
                  type="number"
                  value={limitPrice ?? ''}
                  onChange={(e) => setLimitPrice(parseFloat(e.target.value))}
                  className="flex-1 bg-transparent text-white font-mono font-bold text-sm text-center outline-none"
                />
                <button
                  onClick={() => adjustPrice(0.5)}
                  className="px-3 py-2.5 text-slate-300 font-bold text-lg hover:bg-surface-600 transition-colors"
                >+</button>
              </div>
            </div>
          )}

          {/* Quantity display */}
          <div>
            <p className="text-slate-500 text-[10px] mb-1">Cantidad</p>
            <div className="flex items-center justify-between bg-surface-700 rounded-xl px-3 py-2">
              <span className="text-white font-mono font-bold text-sm">{qtyEth.toFixed(4)}</span>
              <span className="text-slate-400 text-xs">ETH</span>
            </div>
          </div>

          {/* Slider */}
          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sliderPct}
              onChange={(e) => setSliderPct(parseInt(e.target.value))}
              className="w-full accent-brand h-1"
            />
            <div className="flex justify-between">
              {SLIDER_PCTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setSliderPct(p)}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors ${sliderPct === p ? 'bg-brand text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* TP / SL */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 bg-surface-700 rounded-xl overflow-hidden">
              <span className="pl-3 text-up text-[10px] font-bold shrink-0">TP</span>
              <input
                type="number"
                placeholder="Precio take profit"
                value={tp}
                onChange={(e) => setTp(e.target.value)}
                className="flex-1 bg-transparent text-white font-mono text-xs py-2 px-2 outline-none"
              />
              <span className="pr-3 text-slate-500 text-[10px]">USDT</span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface-700 rounded-xl overflow-hidden">
              <span className="pl-3 text-down text-[10px] font-bold shrink-0">SL</span>
              <input
                type="number"
                placeholder="Precio stop loss"
                value={sl}
                onChange={(e) => setSl(e.target.value)}
                className="flex-1 bg-transparent text-white font-mono text-xs py-2 px-2 outline-none"
              />
              <span className="pr-3 text-slate-500 text-[10px]">USDT</span>
            </div>
          </div>

          {/* Max / Costo */}
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="bg-surface-700 rounded-xl px-2.5 py-2">
              <p className="text-slate-500">Máx</p>
              <p className="text-white font-mono font-bold">${positionValue.toFixed(2)}</p>
            </div>
            <div className="bg-surface-700 rounded-xl px-2.5 py-2">
              <p className="text-slate-500">Margen</p>
              <p className="text-white font-mono font-bold">${margin.toFixed(2)}</p>
            </div>
            <div className="bg-surface-700 rounded-xl px-2.5 py-2 col-span-2">
              <p className="text-slate-500">Liquidación aprox.</p>
              <p className="text-warn font-mono font-bold">${liquidationPrice.toFixed(2)}</p>
            </div>
          </div>

          {/* Submit button */}
          {confirmation ? (
            <div className="w-full py-3 rounded-xl bg-up/20 border border-up/40 text-up font-bold text-xs text-center">
              ✓ Operación guardada en Bitácora
            </div>
          ) : (
            <button
              onClick={submit}
              disabled={sliderPct === 0}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 ${
                isLong ? 'bg-up hover:bg-up/80 text-white' : 'bg-down hover:bg-down/80 text-white'
              }`}
            >
              {isLong ? 'Comprar / Long' : 'Vender / Short'}
            </button>
          )}

          <p className="text-slate-600 text-[9px] text-center">
            Simulación — no ejecuta órdenes reales en Binance
          </p>
        </div>

        {/* ── Right: Order book ── */}
        <div className="w-[42%] border-l border-surface-700 p-2">
          <OrderBook symbol={symbol} currentPrice={livePrice} pct={pct} />
        </div>
      </div>
    </div>
  )
}

// ─── Backtest Section ─────────────────────────────────────────────────────────

const BT_INTERVALS = [
  { value: '15m', label: '15m · ~5 días' },
  { value: '1h',  label: '1h · ~21 días' },
  { value: '4h',  label: '4h · ~83 días' },
]

function BacktestSection({ symbol, capital, leverage, riskPct }: {
  symbol: string; capital: number; leverage: number; riskPct: number
}) {
  const [open, setOpen] = useState(false)
  const [btInterval, setBtInterval] = useState('1h')
  const [btStatus, setBtStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [btResult, setBtResult] = useState<{ trades: SimTrade[]; stats: BacktestStats } | null>(null)
  const [btError, setBtError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [savedToJournal, setSavedToJournal] = useState(false)

  async function runSim() {
    setBtStatus('loading'); setBtResult(null); setSavedToJournal(false)
    try {
      const klines = await fetchKlines(symbol, btInterval, 500)
      setBtResult(runBacktest(klines, { capital, riskPct: riskPct / 100, leverage }))
      setBtStatus('done')
    } catch (e) {
      setBtError(e instanceof Error ? e.message : 'Error')
      setBtStatus('error')
    }
  }

  function saveToJournal() {
    if (!btResult) return
    const existing = JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? '[]')
    const newEntries = btResult.trades.map((t) => ({
      id: `sim_bt_${t.index}_${Date.now()}`,
      date: t.openTime,
      pair: `${symbol.replace('USDT', '')}/USDT (SIM)`,
      direction: t.direction,
      entryPrice: t.entry,
      exitPrice: t.exitPrice,
      size: parseFloat(((capital * (riskPct / 100)) / (t.entry * Math.abs(t.entry - t.stopLoss) / t.entry)).toFixed(4)),
      leverage,
      pnl: t.pnlDollars,
      status: 'CLOSED' as const,
      notes: `Backtest ${btInterval} · ${t.outcome} · Score ${t.signalScore > 0 ? '+' : ''}${t.signalScore}`,
    }))
    localStorage.setItem(JOURNAL_KEY, JSON.stringify([...newEntries, ...existing]))
    setSavedToJournal(true)
  }

  const { trades = [], stats } = btResult ?? {}
  const visibleTrades = showAll ? trades : trades.slice(-8)

  return (
    <div className="bg-surface-800 rounded-2xl overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-3 hover:bg-surface-700 transition-colors"
      >
        <div className="text-left">
          <p className="text-white font-bold text-sm">Historial simulado (Backtest)</p>
          <p className="text-slate-500 text-xs">¿Cuánto habrías ganado con cada señal?</p>
        </div>
        <span className="text-slate-400 text-lg">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-surface-700 pt-3">
          {/* Params summary */}
          <div className="bg-surface-700/60 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-400">
            Capital <span className="text-white font-bold">${capital}</span>
            {' · '}Apal. <span className="text-warn font-bold">{leverage}x</span>
            {' · '}Riesgo <span className="text-down font-bold">{riskPct}%</span>
            {' · '}Pérd.max/trade <span className="text-down font-bold">${(capital * riskPct / 100).toFixed(2)}</span>
          </div>

          {/* Interval selector */}
          <div className="flex gap-2">
            {BT_INTERVALS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setBtInterval(value)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${btInterval === value ? 'bg-brand text-white' : 'bg-surface-700 text-slate-300'}`}
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

          {/* Results */}
          {stats && (
            <>
              {/* Win rate */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Win rate · {stats.wins}W / {stats.losses}L</span>
                  <span className={`font-bold font-mono ${stats.winRate >= 55 ? 'text-up' : stats.winRate >= 45 ? 'text-warn' : 'text-down'}`}>
                    {stats.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-surface-700 rounded-full overflow-hidden flex">
                  <div className="h-full bg-up rounded-l-full" style={{ width: `${stats.winRate}%` }} />
                  <div className="h-full bg-down flex-1 rounded-r-full" />
                </div>
              </div>

              {/* Numbers */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'P&L total', value: `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`, color: stats.totalPnl >= 0 ? 'text-up' : 'text-down' },
                  { label: 'Profit Factor', value: stats.profitFactor >= 99 ? '∞' : stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1.5 ? 'text-up' : stats.profitFactor >= 1 ? 'text-warn' : 'text-down' },
                  { label: 'Gan. promedio', value: `+$${stats.avgWin.toFixed(2)}`, color: 'text-up' },
                  { label: 'Pérd. promedio', value: `$${stats.avgLoss.toFixed(2)}`, color: 'text-down' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-surface-700 rounded-xl p-2.5">
                    <p className="text-slate-400 text-[10px]">{label}</p>
                    <p className={`font-mono font-bold text-sm mt-0.5 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Trade list */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-white font-bold text-xs">Operaciones</span>
                  <span className="text-slate-400 text-xs">{trades.length} simuladas</span>
                </div>
                {visibleTrades.map((t) => {
                  const isWin = t.outcome === 'TP1' || t.outcome === 'TP2'
                  const isSL = t.outcome === 'SL'
                  return (
                    <div key={t.index} className={`rounded-xl overflow-hidden border ${isWin ? 'border-up/25' : isSL ? 'border-down/25' : 'border-warn/25'}`}>
                      <div className={`px-3 py-2 flex justify-between items-center ${isWin ? 'bg-up/10' : isSL ? 'bg-down/10' : 'bg-warn/10'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${t.direction === 'LONG' ? 'bg-up/20 text-up' : 'bg-down/20 text-down'}`}>
                            {t.direction === 'LONG' ? '▲ L' : '▼ S'}
                          </span>
                          <span className="text-slate-300 text-xs">{t.openTime}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold ${isWin ? 'text-up' : isSL ? 'text-down' : 'text-warn'}`}>
                            {t.outcome === 'TP2' ? '✅ TP2' : t.outcome === 'TP1' ? '✅ TP1' : t.outcome === 'SL' ? '🛑 SL' : '⏱'}
                          </span>
                          <span className={`font-mono font-bold text-sm ${t.pnlDollars >= 0 ? 'text-up' : 'text-down'}`}>
                            {t.pnlDollars >= 0 ? '+' : ''}${t.pnlDollars.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {trades.length > 8 && (
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full py-2 rounded-xl text-xs font-bold bg-surface-700 text-slate-300"
                  >
                    {showAll ? 'Ver menos' : `Ver todas (${trades.length})`}
                  </button>
                )}
              </div>

              {/* Save to journal */}
              <button
                onClick={saveToJournal}
                disabled={savedToJournal}
                className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${savedToJournal ? 'bg-up/20 text-up border border-up/30' : 'bg-surface-700 text-slate-200 hover:bg-surface-600 active:scale-95'}`}
              >
                {savedToJournal ? '✓ Guardado en Bitácora' : '📋 Guardar en Bitácora'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props { symbol: string }

export function Backtester({ symbol }: Props) {
  const [capital, setCapital] = useState(300)
  const [leverage, setLeverage] = useState(15)
  const [riskPct, setRiskPct] = useState(2)

  return (
    <div className="space-y-4">

      {/* Params row */}
      <div className="bg-surface-800 rounded-2xl p-3">
        <p className="text-slate-400 text-xs font-bold mb-2">Parámetros de cuenta</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Capital $', value: capital, set: setCapital, min: 10, max: 100000, step: 10 },
            { label: 'Apal. x',   value: leverage, set: setLeverage, min: 1, max: 125, step: 1 },
            { label: 'Riesgo %',  value: riskPct,  set: setRiskPct,  min: 0.1, max: 10, step: 0.1 },
          ].map(({ label, value, set, min, max, step }) => (
            <div key={label} className="bg-surface-700 rounded-xl p-2.5 space-y-1">
              <p className="text-slate-500 text-[10px] font-semibold uppercase">{label}</p>
              <input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => set(parseFloat(e.target.value) || value)}
                className="w-full bg-surface-900 text-white font-mono font-bold text-sm rounded-lg px-2 py-1.5 border border-surface-600 focus:border-brand outline-none"
              />
            </div>
          ))}
        </div>
        <p className="text-slate-600 text-[10px] font-mono mt-2">
          Pérd. máx/trade: <span className="text-down">${(capital * riskPct / 100).toFixed(2)}</span>
          {' · '}Liquidación: <span className="text-warn">{(100 / leverage).toFixed(1)}% en contra</span>
        </p>
      </div>

      {/* Binance-style trading panel */}
      <TradingPanel symbol={symbol} capital={capital} leverage={leverage} />

      {/* Backtest (collapsible) */}
      <BacktestSection symbol={symbol} capital={capital} leverage={leverage} riskPct={riskPct} />

      {/* Checklist at the bottom */}
      <Checklist />
    </div>
  )
}
