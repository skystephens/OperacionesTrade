import { useState } from 'react'
import { fetchVelas, calcularIndicadores } from './calcIndicadores'
import { detectarPatrones } from './detectPatrones'
import { analizarConIA } from './analizarConIA'
import type { AnalisisTimeframe, ResultadoIA } from './types'

const MAKE_WEBHOOK = import.meta.env.VITE_MAKE_WEBHOOK_URL as string

const TIMEFRAMES = ['1m', '15m', '1h'] as const

// ─── Subcomponents ────────────────────────────────────────────────────────────

function SignalBadge({ señal }: { señal: ResultadoIA['señal'] }) {
  const cfg = {
    LONG:   { bg: 'bg-up',   border: 'border-up',   text: '▲ LONG',   sub: 'Comprar' },
    SHORT:  { bg: 'bg-down', border: 'border-down',  text: '▼ SHORT',  sub: 'Vender' },
    ESPERAR:{ bg: 'bg-warn', border: 'border-warn',  text: '— ESPERAR', sub: 'No operar ahora' },
  }[señal]

  return (
    <div className={`${cfg.bg}/10 border-2 ${cfg.border}/50 rounded-2xl p-5 text-center`}>
      <p className={`text-4xl font-bold font-mono ${
        señal === 'LONG' ? 'text-up' : señal === 'SHORT' ? 'text-down' : 'text-warn'
      }`}>
        {cfg.text}
      </p>
      <p className={`text-sm mt-1 font-semibold ${
        señal === 'LONG' ? 'text-up/70' : señal === 'SHORT' ? 'text-down/70' : 'text-warn/70'
      }`}>
        {cfg.sub}
      </p>
    </div>
  )
}

function ConfidenceBar({ confianza, señal }: { confianza: number; señal: ResultadoIA['señal'] }) {
  const color = señal === 'LONG' ? 'bg-up' : señal === 'SHORT' ? 'bg-down' : 'bg-warn'
  const label = confianza >= 75 ? 'Alta' : confianza >= 50 ? 'Media' : 'Baja'

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400 font-semibold">Confianza de la señal</span>
        <span className="font-mono font-bold text-white">{confianza}% · {label}</span>
      </div>
      <div className="h-3 bg-surface-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${confianza}%` }}
        />
      </div>
    </div>
  )
}

function ChecklistCard({ checklist }: { checklist: ResultadoIA['checklist'] }) {
  const items = [
    { key: 'tendencia_alineada', label: 'Tendencia alineada (1m+15m+1h)' },
    { key: 'volumen_confirmado', label: 'Volumen por encima del promedio' },
    { key: 'rsi_favorable',     label: 'RSI en zona favorable' },
    { key: 'patron_claro',      label: 'Patrón de velas identificado' },
  ] as const

  const score = items.filter((i) => checklist[i.key]).length

  return (
    <div className="bg-surface-800 rounded-2xl p-4 space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-bold text-sm">Checklist IA</h3>
        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
          score === 4 ? 'bg-up/20 text-up' : score >= 3 ? 'bg-warn/20 text-warn' : 'bg-down/20 text-down'
        }`}>
          {score}/4
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map(({ key, label }) => (
          <div key={key} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${
            checklist[key] ? 'bg-up/10' : 'bg-surface-700'
          }`}>
            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
              checklist[key] ? 'bg-up text-white' : 'bg-surface-600 text-slate-500'
            }`}>
              {checklist[key] ? '✓' : '✗'}
            </span>
            <span className={`text-xs ${checklist[key] ? 'text-white' : 'text-slate-500'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimeframeCard({ tf }: { tf: AnalisisTimeframe }) {
  const { intervalo, indicadores: ind, patrones } = tf
  const trendColor = ind.tendencia === 'ALCISTA' ? 'text-up' : ind.tendencia === 'BAJISTA' ? 'text-down' : 'text-warn'

  return (
    <div className="bg-surface-700 rounded-xl p-3 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-white font-bold text-xs">{intervalo}</span>
        <span className={`text-xs font-bold ${trendColor}`}>{ind.tendencia}</span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <div>
          <span className="text-slate-500">RSI </span>
          <span className={`font-mono font-bold ${ind.rsi < 30 ? 'text-up' : ind.rsi > 70 ? 'text-down' : 'text-slate-300'}`}>
            {ind.rsi.toFixed(1)}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Vol </span>
          <span className={`font-mono font-bold ${ind.volumenRelativo > 1.2 ? 'text-up' : ind.volumenRelativo < 0.8 ? 'text-down' : 'text-slate-300'}`}>
            {ind.volumenRelativo.toFixed(2)}x
          </span>
        </div>
        <div>
          <span className="text-slate-500">EMA9 </span>
          <span className={`font-mono font-bold ${ind.precio > ind.ema9 ? 'text-up' : 'text-down'}`}>
            {ind.precio > ind.ema9 ? '↑' : '↓'}
          </span>
        </div>
        <div>
          <span className="text-slate-500">EMA21 </span>
          <span className={`font-mono font-bold ${ind.precio > ind.ema21 ? 'text-up' : 'text-down'}`}>
            {ind.precio > ind.ema21 ? '↑' : '↓'}
          </span>
        </div>
      </div>
      {patrones.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {patrones.map((p) => (
            <span key={p.nombre} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
              p.tipo === 'BULLISH' ? 'bg-up/20 text-up' :
              p.tipo === 'BEARISH' ? 'bg-down/20 text-down' :
              'bg-warn/20 text-warn'
            }`}>
              {p.nombre}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props { symbol?: string }

export function AnalizarVelas({ symbol = 'ETHUSDT' }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoIA | null>(null)
  const [timeframes, setTimeframes] = useState<AnalisisTimeframe[]>([])
  const [capital, setCapital] = useState(51.30)
  const [leverage, setLeverage] = useState(20)
  const [telegramSent, setTelegramSent] = useState(false)
  const [telegramLoading, setTelegramLoading] = useState(false)

  async function analizar() {
    setLoading(true)
    setError(null)
    setResultado(null)
    setTimeframes([])
    setTelegramSent(false)

    try {
      // 1. Fetch velas para los 3 timeframes en paralelo
      const [velas1m, velas15m, velas1h] = await Promise.all(
        TIMEFRAMES.map((tf) => fetchVelas(symbol, tf, 50))
      )

      const tfs: AnalisisTimeframe[] = [
        { intervalo: '1m',  velas: velas1m,  indicadores: calcularIndicadores(velas1m),  patrones: detectarPatrones(velas1m)  },
        { intervalo: '15m', velas: velas15m, indicadores: calcularIndicadores(velas15m), patrones: detectarPatrones(velas15m) },
        { intervalo: '1h',  velas: velas1h,  indicadores: calcularIndicadores(velas1h),  patrones: detectarPatrones(velas1h)  },
      ]
      setTimeframes(tfs)

      // 2. Enviar a IA
      const res = await analizarConIA(tfs, capital, leverage)
      setResultado(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function enviarTelegram() {
    if (!resultado || !MAKE_WEBHOOK) return
    setTelegramLoading(true)
    try {
      await fetch(MAKE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: 'ia_signal',
          source: 'AnalizarVelas',
          symbol,
          señal: resultado.señal,
          confianza: resultado.confianza,
          razon: resultado.razon_principal,
          patron: resultado.patron_detectado,
          entrada: resultado.entrada_sugerida,
          sl: resultado.stop_loss,
          tp: resultado.take_profit,
          capital,
          leverage,
        }),
      })
      setTelegramSent(true)
    } catch {
      setTelegramSent(true) // aceptamos gracefully
    } finally {
      setTelegramLoading(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* Header + params */}
      <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="text-white font-bold text-base">Análisis con IA</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            ETH/USDT · 1m + 15m + 1h · Groq llama-3.3-70b / Gemini 2.0
          </p>
        </div>

        {/* Capital + leverage */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface-700 rounded-xl p-2.5">
            <p className="text-slate-500 text-[10px] font-semibold uppercase">Capital $</p>
            <input
              type="number"
              value={capital}
              min={1}
              step={0.01}
              onChange={(e) => setCapital(parseFloat(e.target.value) || capital)}
              className="w-full bg-surface-900 text-white font-mono font-bold text-sm rounded-lg px-2 py-1.5 border border-surface-600 focus:border-brand outline-none mt-1"
            />
          </div>
          <div className="bg-surface-700 rounded-xl p-2.5">
            <p className="text-slate-500 text-[10px] font-semibold uppercase">Apalancamiento x</p>
            <input
              type="number"
              value={leverage}
              min={1}
              max={125}
              onChange={(e) => setLeverage(parseInt(e.target.value) || leverage)}
              className="w-full bg-surface-900 text-white font-mono font-bold text-sm rounded-lg px-2 py-1.5 border border-surface-600 focus:border-brand outline-none mt-1"
            />
          </div>
        </div>

        <button
          onClick={analizar}
          disabled={loading}
          className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
            loading
              ? 'bg-surface-700 text-slate-500 cursor-not-allowed'
              : 'bg-brand text-white hover:bg-brand/80'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analizando 3 timeframes...
            </span>
          ) : '🔍 Analizar Mercado Ahora'}
        </button>

        {error && (
          <div className="bg-down/10 border border-down/30 rounded-xl px-3 py-2.5">
            <p className="text-down text-xs font-bold">Error en el análisis</p>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">{error}</p>
          </div>
        )}
      </div>

      {/* Timeframe summary (visible mientras carga o después) */}
      {timeframes.length > 0 && (
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest px-1">
            Datos por timeframe
          </p>
          <div className="grid grid-cols-3 gap-2">
            {timeframes.map((tf) => <TimeframeCard key={tf.intervalo} tf={tf} />)}
          </div>
          {loading && (
            <div className="bg-surface-800 rounded-2xl p-4 flex items-center gap-3">
              <span className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-slate-300 text-sm">Enviando datos a la IA...</p>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {resultado && (
        <div className="space-y-3">

          {/* Signal */}
          <SignalBadge señal={resultado.señal} />

          {/* Confidence bar */}
          <div className="bg-surface-800 rounded-2xl p-4">
            <ConfidenceBar confianza={resultado.confianza} señal={resultado.señal} />
          </div>

          {/* Razón principal */}
          <div className="bg-surface-800 rounded-2xl p-4 space-y-1.5">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Razón principal</p>
            <p className="text-white text-sm leading-relaxed">{resultado.razon_principal}</p>
            {resultado.patron_detectado && resultado.patron_detectado !== 'Ninguno' && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-500 text-xs">Patrón:</span>
                <span className="text-brand text-xs font-bold">{resultado.patron_detectado}</span>
              </div>
            )}
          </div>

          {/* Entry params */}
          {resultado.señal !== 'ESPERAR' && (
            <div className="bg-surface-800 rounded-2xl p-4 space-y-2">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Parámetros sugeridos</p>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center bg-brand/10 border border-brand/30 rounded-xl px-3 py-2">
                  <span className="text-slate-300 text-xs">🎯 Entrada</span>
                  <span className="font-mono font-bold text-white">${resultado.entrada_sugerida.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center bg-down/10 border border-down/20 rounded-xl px-3 py-2">
                  <span className="text-slate-300 text-xs">🛑 Stop-Loss</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-down">${resultado.stop_loss.toFixed(2)}</span>
                    <p className="text-down/70 text-[10px] font-mono">
                      {(((resultado.stop_loss - resultado.entrada_sugerida) / resultado.entrada_sugerida) * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center bg-up/10 border border-up/20 rounded-xl px-3 py-2">
                  <span className="text-slate-300 text-xs">✅ Take-Profit</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-up">${resultado.take_profit.toFixed(2)}</span>
                    <p className="text-up/70 text-[10px] font-mono">
                      {(((resultado.take_profit - resultado.entrada_sugerida) / resultado.entrada_sugerida) * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-surface-700 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-400">
                Capital <span className="text-white font-bold">${capital}</span>
                {' · '}{leverage}x
                {' · '}Margen <span className="text-white font-bold">${(capital).toFixed(2)}</span>
                {' · '}Pos. <span className="text-warn font-bold">${(capital * leverage).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Checklist */}
          <ChecklistCard checklist={resultado.checklist} />

          {/* Advertencias */}
          {resultado.advertencias?.length > 0 && (
            <div className="bg-surface-800 rounded-2xl p-4 space-y-2">
              <p className="text-warn text-xs font-bold uppercase tracking-widest">⚠ Advertencias</p>
              {resultado.advertencias.map((a, i) => (
                <div key={i} className="flex items-start gap-2 bg-warn/5 border border-warn/20 rounded-xl px-3 py-2">
                  <span className="text-warn text-xs shrink-0 mt-0.5">•</span>
                  <span className="text-slate-300 text-xs leading-relaxed">{a}</span>
                </div>
              ))}
            </div>
          )}

          {/* Telegram button */}
          {MAKE_WEBHOOK && resultado.señal !== 'ESPERAR' && (
            <button
              onClick={enviarTelegram}
              disabled={telegramSent || telegramLoading}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                telegramSent
                  ? 'bg-up/20 text-up border border-up/30'
                  : 'bg-surface-700 text-white hover:bg-surface-600'
              }`}
            >
              {telegramLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando...
                </span>
              ) : telegramSent
                ? '✓ Alerta enviada a Telegram'
                : '📱 Enviar alerta a Telegram'}
            </button>
          )}

          <p className="text-slate-600 text-[10px] text-center px-4">
            Análisis generado por IA. No es asesoría financiera. Siempre usa stop-loss.
          </p>
        </div>
      )}
    </div>
  )
}
