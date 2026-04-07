import type { AnalisisTimeframe, ResultadoIA } from './types'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

function buildPrompt(timeframes: AnalisisTimeframe[], capital: number, leverage: number): string {
  const datos = timeframes.map((tf) => {
    const { intervalo, indicadores: ind, patrones } = tf
    const ultimasVelas = tf.velas.slice(-5).map((v) => ({
      o: v.open.toFixed(2), h: v.high.toFixed(2),
      l: v.low.toFixed(2), c: v.close.toFixed(2),
      vol: v.volume.toFixed(0),
    }))
    return `
Timeframe ${intervalo}:
  Precio actual: $${ind.precio.toFixed(2)}
  RSI(14): ${ind.rsi.toFixed(1)} (${ind.rsi < 30 ? 'SOBREVENDIDO' : ind.rsi > 70 ? 'SOBRECOMPRADO' : 'NEUTRAL'})
  EMA9: $${ind.ema9.toFixed(2)} | EMA21: $${ind.ema21.toFixed(2)}
  Precio vs EMA9: ${ind.precio > ind.ema9 ? 'ENCIMA' : 'DEBAJO'}
  Precio vs EMA21: ${ind.precio > ind.ema21 ? 'ENCIMA' : 'DEBAJO'}
  Tendencia: ${ind.tendencia}
  Volumen relativo: ${ind.volumenRelativo.toFixed(2)}x del promedio (${ind.volumenRelativo > 1.2 ? 'ALTO' : ind.volumenRelativo < 0.8 ? 'BAJO' : 'NORMAL'})
  Patrones detectados: ${patrones.length === 0 ? 'Ninguno' : patrones.map((p) => `${p.nombre} (${p.tipo})`).join(', ')}
  Últimas 5 velas OHLCV: ${JSON.stringify(ultimasVelas)}`
  }).join('\n')

  const precio = timeframes[0]?.indicadores.precio ?? 0
  const slLong = (precio * (1 - 1 / leverage)).toFixed(2)
  const slShort = (precio * (1 + 1 / leverage)).toFixed(2)

  return `Eres un analista de trading experto en futuros de criptomonedas con 10 años de experiencia en scalping y swing trading.

Analiza estos datos técnicos de ETH/USDT Perpetual Futuros en Binance y determina si hay una señal clara de LONG, SHORT, o si es mejor NO OPERAR.

Capital disponible: $${capital} USDT | Apalancamiento: ${leverage}x (aislado)
Precio de liquidación aprox: LONG=$${slLong} | SHORT=$${slShort}

DATOS DE MERCADO:
${datos}

INSTRUCCIONES:
- Si los 3 timeframes (1m, 15m, 1h) coinciden en dirección → confianza alta
- Si hay conflicto entre timeframes → señal ESPERAR
- El stop loss debe ser realista (no más del 1.5% del precio para ${leverage}x)
- El take profit debe tener R:R mínimo 1:1.5
- Considera el riesgo de liquidación con ${leverage}x de apalancamiento

Responde ÚNICAMENTE con este JSON exacto (sin texto adicional, sin markdown):
{
  "señal": "LONG" | "SHORT" | "ESPERAR",
  "confianza": 0-100,
  "razon_principal": "texto corto máximo 100 caracteres",
  "patron_detectado": "nombre del patrón o Ninguno",
  "entrada_sugerida": precio_numero,
  "stop_loss": precio_numero,
  "take_profit": precio_numero,
  "advertencias": ["advertencia 1", "advertencia 2"],
  "checklist": {
    "tendencia_alineada": true|false,
    "volumen_confirmado": true|false,
    "rsi_favorable": true|false,
    "patron_claro": true|false
  }
}`
}

async function llamarGroq(prompt: string): Promise<ResultadoIA> {
  const key = import.meta.env.VITE_GROQ_API_KEY as string
  if (!key) throw new Error('VITE_GROQ_API_KEY no configurada')

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const content: string = data.choices?.[0]?.message?.content ?? ''
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Groq no devolvió JSON válido')
  return JSON.parse(jsonMatch[0]) as ResultadoIA
}

async function llamarGemini(prompt: string): Promise<ResultadoIA> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string
  if (!key) throw new Error('VITE_GEMINI_API_KEY no configurada')

  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const content: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Gemini no devolvió JSON válido')
  return JSON.parse(jsonMatch[0]) as ResultadoIA
}

export async function analizarConIA(
  timeframes: AnalisisTimeframe[],
  capital: number,
  leverage: number
): Promise<ResultadoIA> {
  const prompt = buildPrompt(timeframes, capital, leverage)
  const provider = (import.meta.env.VITE_AI_PROVIDER as string) ?? 'groq'

  if (provider === 'gemini') return llamarGemini(prompt)
  return llamarGroq(prompt)
}
