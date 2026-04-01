import { useState } from 'react'

interface Projection {
  entrada: string
  stop_loss: string
  take_profit: string
}

interface MakeResponse {
  status: string
  timestamp: string
  par: string
  precio_actual: string
  cambio_24h: string
  volumen_24h: string
  high_24h: string
  low_24h: string
  proyeccion_long: Projection
  proyeccion_short: Projection
  riesgo_usd: string
  alerta_enviada: boolean
}

interface HistoryEntry extends MakeResponse {
  id: number
}

const WEBHOOK_URL = import.meta.env.VITE_MAKE_WEBHOOK_URL as string

export function MakeSignal() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MakeResponse | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [telegramSent, setTelegramSent] = useState(false)

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    setTelegramSent(false)
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual', source: 'dashboard' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      if (text.trim() === 'Accepted') {
        setTelegramSent(true)
        return
      }
      const data: MakeResponse = JSON.parse(text)
      setResult(data)
      setHistory(prev => [{ ...data, id: Date.now() }, ...prev.slice(0, 9)])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const cambio = result ? parseFloat(result.cambio_24h) : 0
  const cambioPositivo = cambio >= 0

  return (
    <div className="space-y-3">
      {/* Header card */}
      <div className="bg-surface-800 rounded-2xl p-4 border border-surface-700 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Make · Señal en vivo</p>
            <p className="text-white font-bold text-base mt-0.5">Análisis con Telegram</p>
          </div>
          {(result || telegramSent) && (
            <div className="text-right">
              {result && <p className="text-slate-500 text-[10px]">{result.timestamp}</p>}
              <p className="text-up text-xs font-bold mt-0.5">✓ Telegram enviado</p>
            </div>
          )}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
            loading
              ? 'bg-surface-700 text-slate-500 cursor-not-allowed'
              : 'bg-brand text-white hover:bg-brand/80'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analizando ETH...
            </span>
          ) : (
            '⚡ Analizar ETH ahora'
          )}
        </button>

        {telegramSent && !result && (
          <div className="bg-up/10 border border-up/30 rounded-xl px-3 py-2">
            <p className="text-up text-xs font-bold">✓ Señal enviada a Telegram</p>
            <p className="text-slate-400 text-xs mt-0.5">El análisis fue procesado. Revisa @trading_eth_sky_bot para ver los datos.</p>
          </div>
        )}

        {error && (
          <div className="bg-down/10 border border-down/30 rounded-xl px-3 py-2">
            <p className="text-down text-xs font-bold">Error al llamar Make.com</p>
            <p className="text-slate-400 text-xs mt-0.5">{error}</p>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <>
          {/* Precio actual */}
          <div className="bg-surface-800 rounded-2xl p-4 border border-surface-700">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-slate-400 text-xs">Precio actual · {result.par}</p>
                <p className="text-white font-mono font-bold text-2xl mt-0.5">
                  ${parseFloat(result.precio_actual).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-mono font-bold text-lg ${cambioPositivo ? 'text-up' : 'text-down'}`}>
                  {cambioPositivo ? '+' : ''}{cambio.toFixed(2)}%
                </p>
                <p className="text-slate-500 text-xs">24h</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { label: 'Máx 24h', value: `$${parseFloat(result.high_24h).toFixed(2)}`, color: 'text-up' },
                { label: 'Mín 24h', value: `$${parseFloat(result.low_24h).toFixed(2)}`, color: 'text-down' },
                { label: 'Riesgo USD', value: `$${result.riesgo_usd}`, color: 'text-warn' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-surface-700 rounded-xl p-2 text-center">
                  <p className="text-slate-500 text-[10px]">{label}</p>
                  <p className={`font-mono font-bold text-xs mt-0.5 ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Proyecciones */}
          <div className="grid grid-cols-2 gap-3">
            {/* LONG */}
            <div className="bg-up/10 border border-up/30 rounded-2xl p-3 space-y-2">
              <p className="text-up font-bold text-sm">▲ LONG</p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-xs">Entrada</span>
                  <span className="text-white font-mono text-xs font-bold">
                    ${parseFloat(result.proyeccion_long.entrada).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-xs">Stop-Loss</span>
                  <span className="text-down font-mono text-xs font-bold">
                    ${parseFloat(result.proyeccion_long.stop_loss).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-xs">Take-Profit</span>
                  <span className="text-up font-mono text-xs font-bold">
                    ${parseFloat(result.proyeccion_long.take_profit).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* SHORT */}
            <div className="bg-down/10 border border-down/30 rounded-2xl p-3 space-y-2">
              <p className="text-down font-bold text-sm">▼ SHORT</p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-xs">Entrada</span>
                  <span className="text-white font-mono text-xs font-bold">
                    ${parseFloat(result.proyeccion_short.entrada).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-xs">Stop-Loss</span>
                  <span className="text-down font-mono text-xs font-bold">
                    ${parseFloat(result.proyeccion_short.stop_loss).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-xs">Take-Profit</span>
                  <span className="text-up font-mono text-xs font-bold">
                    ${parseFloat(result.proyeccion_short.take_profit).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Volumen */}
          <div className="bg-surface-800 rounded-2xl px-4 py-3 border border-surface-700 flex justify-between items-center">
            <span className="text-slate-400 text-xs">Volumen 24h</span>
            <span className="text-white font-mono text-sm font-bold">
              ${(parseFloat(result.volumen_24h) / 1_000_000).toFixed(1)}M
            </span>
          </div>
        </>
      )}

      {/* Historial */}
      {history.length > 0 && (
        <div className="bg-surface-800 rounded-2xl border border-surface-700 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex justify-between items-center px-4 py-3 text-left"
          >
            <span className="text-slate-300 text-sm font-bold">Historial ({history.length})</span>
            <span className="text-slate-500 text-xs">{showHistory ? '▲ ocultar' : '▼ ver'}</span>
          </button>
          {showHistory && (
            <div className="divide-y divide-surface-700">
              {history.map((entry) => (
                <div key={entry.id} className="px-4 py-2.5 flex justify-between items-center">
                  <div>
                    <p className="text-white font-mono text-sm font-bold">
                      ${parseFloat(entry.precio_actual).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-slate-500 text-[10px]">{entry.timestamp}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-xs font-bold ${parseFloat(entry.cambio_24h) >= 0 ? 'text-up' : 'text-down'}`}>
                      {parseFloat(entry.cambio_24h) >= 0 ? '+' : ''}{parseFloat(entry.cambio_24h).toFixed(2)}%
                    </p>
                    {entry.alerta_enviada && (
                      <p className="text-up text-[10px]">✓ TG</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
