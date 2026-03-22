import { useState } from 'react'

const DEFAULT_ITEMS = [
  { id: 'trend', label: 'Tendencia alineada en 1h, 15m y 5m' },
  { id: 'volume', label: 'Volumen por encima del promedio' },
  { id: 'sl', label: 'Stop-loss definido ANTES de entrar' },
  { id: 'news', label: 'Sin noticias macro en proximos 30 min (CPI, Fed, etc.)' },
  { id: 'rsi', label: 'RSI no en zona extrema (< 25 o > 75)' },
  { id: 'support', label: 'Entrada cerca de soporte/resistencia clave' },
  { id: 'rr', label: 'Relacion riesgo/beneficio minimo 1:2' },
  { id: 'calm', label: 'Estado mental tranquilo — sin FOMO ni revenge trading' },
]

export function Checklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [resetKey, setResetKey] = useState(0)

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))

  const score = Object.values(checked).filter(Boolean).length
  const total = DEFAULT_ITEMS.length
  const ready = score === total

  return (
    <div className="bg-surface-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-base">Checklist Pre-Operacion</h2>
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${ready ? 'bg-up/20 text-up' : 'bg-warn/20 text-warn'}`}>
          {score}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${ready ? 'bg-up' : 'bg-warn'}`}
          style={{ width: `${(score / total) * 100}%` }}
        />
      </div>

      <div key={resetKey} className="space-y-2">
        {DEFAULT_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
              checked[item.id] ? 'bg-up/10' : 'bg-surface-700'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                checked[item.id] ? 'border-up bg-up' : 'border-surface-600'
              }`}
            >
              {checked[item.id] && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className={`text-sm ${checked[item.id] ? 'text-white' : 'text-surface-600'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {ready && (
        <div className="bg-up/10 border border-up/30 rounded-xl p-3 text-center">
          <p className="text-up font-bold text-sm">Listo para operar</p>
          <p className="text-up/70 text-xs">Todos los criterios cumplidos</p>
        </div>
      )}

      <button
        onClick={() => { setChecked({}); setResetKey((k) => k + 1) }}
        className="w-full py-2 bg-surface-700 text-surface-600 text-xs rounded-xl"
      >
        Reiniciar checklist
      </button>
    </div>
  )
}
