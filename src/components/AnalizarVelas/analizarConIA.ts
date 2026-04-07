import type { AnalisisTimeframe, ResultadoIA } from './types'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export const STORAGE_KEYS = {
  groq:     'ia_groq_api_key',
  gemini:   'ia_gemini_api_key',
  provider: 'ia_provider',
}

export function getStoredKey(provider: 'groq' | 'gemini'): string {
  return localStorage.getItem(STORAGE_KEYS[provider]) ?? ''
}

export function getStoredProvider(): 'groq' | 'gemini' {
  return (localStorage.getItem(STORAGE_KEYS.provider) as 'groq' | 'gemini') ?? 'gemini'
}

export function saveConfig(provider: 'groq' | 'gemini', key: string) {
  localStorage.setItem(STORAGE_KEYS[provider], key)
  localStorage.setItem(STORAGE_KEYS.provider, provider)
}

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
  Volumen relativo: ${ind.volumenRelativo.toFixed(2)}x del promedio
  Patrones detectados: ${patrones.length === 0 ? 'Ninguno' : patrones.map((p) => `${p.nombre} (${p.tipo})`).join(', ')}
  Últimas 5 velas OHLCV: ${JSON.stringify(ultimasVelas)}`
  }).join('\n')

  const precio = timeframes[0]?.indicadores.precio ?? 0
  const slLong  = (precio * (1 - 1 / leverage)).toFixed(2)
  const slShort = (precio * (1 + 1 / leverage)).toFixed(2)

  return `Eres un analista de trading experto en futuros de criptomonedas con 10 años de experiencia en scalping.

Analiza estos datos técnicos de ETH/USDT Perpetual Futuros en Binance y determina si hay señal de LONG, SHORT, o NO OPERAR.

Capital: $${capital} USDT | Apalancamiento: ${leverage}x (aislado)
Liquidación aprox: LONG=$${slLong} | SHORT=$${slShort}

DATOS DE MERCADO:
${datos}

INSTRUCCIONES:
- Si los 3 timeframes coinciden en dirección → confianza alta
- Si hay conflicto entre timeframes → señal ESPERAR
- Stop loss máximo 1.5% del precio para ${leverage}x
- Take profit con R:R mínimo 1:1.5

Responde ÚNICAMENTE con este JSON (sin texto extra, sin markdown):
{
  "señal": "LONG",
  "confianza": 72,
  "razon_principal": "texto corto",
  "patron_detectado": "nombre o Ninguno",
  "entrada_sugerida": 2050.00,
  "stop_loss": 2035.00,
  "take_profit": 2075.00,
  "advertencias": ["advertencia 1"],
  "checklist": {
    "tendencia_alineada": true,
    "volumen_confirmado": false,
    "rsi_favorable": true,
    "patron_claro": false
  }
}`
}

async function llamarGroq(prompt: string, key: string): Promise<ResultadoIA> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const content: string = data.choices?.[0]?.message?.content ?? ''
  const match = content.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Groq no devolvió JSON válido')
  return JSON.parse(match[0]) as ResultadoIA
}

async function llamarGemini(prompt: string, key: string): Promise<ResultadoIA> {
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const content: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const match = content.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Gemini no devolvió JSON válido')
  return JSON.parse(match[0]) as ResultadoIA
}

export async function analizarConIA(
  timeframes: AnalisisTimeframe[],
  capital: number,
  leverage: number
): Promise<ResultadoIA> {
  const provider = getStoredProvider()
  const key = getStoredKey(provider)

  if (!key) throw new Error(
    `API key de ${provider === 'groq' ? 'Groq' : 'Gemini'} no configurada. Pégala en el panel de configuración.`
  )

  const prompt = buildPrompt(timeframes, capital, leverage)
  if (provider === 'gemini') return llamarGemini(prompt, key)
  return llamarGroq(prompt, key)
}
