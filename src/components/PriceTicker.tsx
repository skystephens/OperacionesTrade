import { useBinanceTicker, useBinanceKlines } from '../hooks/useBinanceWS'
import { useEffect, useRef } from 'react'
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts'

interface Props {
  symbol: string
  interval: string
}

function MiniChart({ symbol, interval }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)
  const seriesRef = useRef<ReturnType<typeof chartRef.current extends null ? never : ReturnType<typeof createChart>['addCandlestickSeries']> | null>(null)
  const { klines } = useBinanceKlines(symbol, interval, 80)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1e293b' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#334155' },
      timeScale: { borderColor: '#334155', timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height: 220,
    })

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seriesRef.current = series as any

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.clientWidth, 220)
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [])

  useEffect(() => {
    if (!seriesRef.current || klines.length === 0) return
    const data = klines.map((k) => ({
      time: Math.floor(k.time / 1000) as unknown as import('lightweight-charts').Time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(seriesRef.current as any).setData(data)
    chartRef.current?.timeScale().fitContent()
  }, [klines])

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />
}

export function PriceTicker({ symbol, interval }: Props) {
  const { ticker, connected } = useBinanceTicker(symbol)

  const isUp = (ticker?.priceChangePercent ?? 0) >= 0
  const colorClass = isUp ? 'text-up' : 'text-down'
  const bgClass = isUp ? 'bg-up/10' : 'bg-down/10'

  return (
    <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg tracking-wide">{symbol}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-mono ${bgClass} ${colorClass}`}
            >
              {isUp ? '+' : ''}{ticker?.priceChangePercent.toFixed(2)}%
            </span>
          </div>
          <p className="text-surface-600 text-xs mt-0.5">Futuros Perpetuos · {interval}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-up animate-pulse' : 'bg-down'}`} />
          <span className="text-xs text-surface-600">{connected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* Price */}
      <div className={`font-mono text-3xl font-bold ${colorClass}`}>
        ${ticker?.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: '24h Alto', value: ticker?.high, color: 'text-up' },
          { label: '24h Bajo', value: ticker?.low, color: 'text-down' },
          { label: 'Volumen', value: ticker ? `${(ticker.quoteVolume / 1e6).toFixed(0)}M` : null, color: 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-700 rounded-xl p-2">
            <p className="text-surface-600 text-xs">{label}</p>
            <p className={`font-mono text-sm font-semibold ${color}`}>
              {typeof value === 'number'
                ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : (value ?? '—')}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <MiniChart symbol={symbol} interval={interval} />
    </div>
  )
}
