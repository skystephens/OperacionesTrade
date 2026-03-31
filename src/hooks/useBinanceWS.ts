import { useState, useEffect, useRef, useCallback } from 'react'
import type { TickerData, KlineData } from '../types'

const WS_BASE = 'wss://stream.binance.com:9443/ws'

export function useBinanceTicker(symbol: string) {
  const [ticker, setTicker] = useState<TickerData | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const stream = `${symbol.toLowerCase()}@ticker`
    const ws = new WebSocket(`${WS_BASE}/${stream}`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    ws.onmessage = (event) => {
      const d = JSON.parse(event.data)
      setTicker({
        symbol: d.s,
        price: parseFloat(d.c),
        priceChange: parseFloat(d.p),
        priceChangePercent: parseFloat(d.P),
        high: parseFloat(d.h),
        low: parseFloat(d.l),
        volume: parseFloat(d.v),
        quoteVolume: parseFloat(d.q),
      })
    }

    return () => {
      ws.close()
    }
  }, [symbol])

  return { ticker, connected }
}

export function useBinanceKlines(symbol: string, interval: string = '1m', limit: number = 60) {
  const [klines, setKlines] = useState<KlineData[]>([])
  const [loading, setLoading] = useState(true)
  const wsRef = useRef<WebSocket | null>(null)

  // Fetch historical klines via REST
  const fetchHistory = useCallback(async () => {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      const res = await fetch(url)
      const data = await res.json()
      const parsed: KlineData[] = data.map((k: unknown[]) => ({
        time: k[0] as number,
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
        isClosed: true,
      }))
      setKlines(parsed)
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [symbol, interval, limit])

  useEffect(() => {
    fetchHistory()

    const stream = `${symbol.toLowerCase()}@kline_${interval}`
    const ws = new WebSocket(`${WS_BASE}/${stream}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const d = JSON.parse(event.data)
      const k = d.k
      const candle: KlineData = {
        time: k.t,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
        isClosed: k.x,
      }

      setKlines((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.time === candle.time) {
          return [...prev.slice(0, -1), candle]
        }
        return [...prev.slice(-limit + 1), candle]
      })
    }

    return () => {
      ws.close()
    }
  }, [symbol, interval, limit, fetchHistory])

  return { klines, loading }
}
