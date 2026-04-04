interface GuideItem {
  title: string
  tips: string[]
}

const GUIDES: Record<string, GuideItem> = {
  chart: {
    title: 'Tab Precio — Que ves aqui',
    tips: [
      'Precio en tiempo real de la moneda seleccionada via Binance WebSocket (punto verde = conectado).',
      '24h Alto / Bajo / Volumen: muestra el rango del dia. Volumen alto = mercado activo, mejor para operar.',
      'Grafica de velas: cada vela = un periodo de tiempo. Verde = precio subio, Roja = precio bajo.',
      'Botones de intervalo (1m, 3m, 5m, 15m, 1h): cambia la escala temporal. 1m-5m para scalping, 15m-1h para ver la tendencia general.',
      'Cambia de moneda tocando ETH/USDT en el header (ETH, BTC, SOL, BNB disponibles).',
    ],
  },
  analysis: {
    title: 'Tab Analisis — Como leerlo',
    tips: [
      'Señal del mercado: calculada automaticamente con RSI + EMA + Volumen. COMPRA FUERTE = multiples indicadores alineados al alza.',
      'RSI (14): mide si la moneda esta sobrecomprada o sobrevendida. < 30 = posible rebote al alza. > 70 = posible caida.',
      'EMA 9 y EMA 21: promedios moviles. Si el precio esta por encima de ambas = tendencia alcista. Si EMA9 cruza arriba de EMA21 = Golden Cross (senal de compra fuerte).',
      'Soporte y Resistencia: niveles clave basados en las ultimas 20 velas. Opera cerca del soporte para Long, cerca de la resistencia para Short.',
      'Por que esta senal?: explicacion en texto de por que el sistema recomienda esa accion. Lee esto antes de entrar a una operacion.',
      'Cambia el intervalo para confirmar la senal en multiples timeframes (5m + 15m alineados = mas confiable).',
    ],
  },
  risk: {
    title: 'Tab Riesgo — Calculadora antes de operar',
    tips: [
      'Usa esta calculadora ANTES de abrir cualquier posicion en Binance. Nunca entres sin calcular primero.',
      'Capital: cuanto tienes en tu cuenta de Binance Futuros.',
      'Riesgo (%): cuanto estas dispuesto a perder si el trade sale mal. Recomendado: 1-2% del capital total.',
      'Apalancamiento: multiplica tu posicion pero tambien tus perdidas. Segun tu perfil: Conservador=5x, Moderado=15x, Agresivo=30x.',
      'Stop-Loss (%): distancia entre tu entrada y donde cortas la perdida. Con 30x, un 3.3% te liquida.',
      'Resultado: la calculadora te da el tamano exacto de posicion, precio de stop-loss, take-profit (1:2 R/R) y precio de liquidacion.',
    ],
  },
  journal: {
    title: 'Tab Bitacora — Registro de operaciones',
    tips: [
      'Registra CADA operacion que hagas, sin excepcion. Los datos propios son la unica forma de mejorar.',
      'Anota entrada, salida, resultado en USDT y notas de por que entraste.',
      'La bitacora calcula automaticamente tu win rate acumulado y drawdown maximo del mes.',
      'Revisa cada semana: en que condiciones ganas mas? A que hora? Con que apalancamiento? Eso define tu estrategia real.',
      'Meta minima: win rate > 55% sostenido. Por debajo, vuelve a paper trading (simular sin dinero real).',
    ],
  },
  sim: {
    title: 'Tab Sim — Checklist + Simulador',
    tips: [
      'Checklist pre-operacion: completa los 8 puntos ANTES de entrar a cualquier posicion. Si alguno no se cumple, NO operes.',
      'Señal en vivo: muestra la direccion recomendada ahora mismo con todos los parametros listos para ingresar en Binance (entrada, SL, TP, tamano de posicion).',
      'Parametros de simulacion: cambia el capital, apalancamiento y riesgo para ver como afectan los calculos. Los cambios aplican al backtest y a la señal en vivo.',
      'Historial simulado: corre el backtest sobre las ultimas 500 velas del intervalo elegido. Si el win rate supera 60%, la estrategia tiene base solida.',
      'Guardar en Bitacora: despues de correr la simulacion puedes guardar todas las operaciones simuladas en la Bitacora para analizarlas junto con tus trades reales.',
    ],
  },
  cashflow: {
    title: 'Tab Flujo — Tu situacion financiera real',
    tips: [
      'Mi Perfil: resumen del plan generado en tu onboarding. Muestra apalancamiento, riesgo por trade y proyeccion mensual segun tu capital y tolerancia.',
      'Estado de Flujo de Caja: registra tus ingresos y gastos mensuales reales. El numero clave es el Flujo Libre — cuanto te sobra cada mes.',
      'Evaluador de Oportunidad: basado en el juego Cash Flow de Kiyosaki. Ingresa el capital que necesitas, el retorno esperado y el plazo.',
      'Verde = viable: tu flujo libre cubre la inversion sin comprometer tus gastos.',
      'Amarillo = posible con apalancamiento: necesitas acumular varios meses de flujo libre.',
      'Rojo = no recomendado: el capital requerido supera lo que tu flujo puede soportar en ese plazo.',
    ],
  },
}

interface Props {
  tab: string
  onClose: () => void
}

export function TabGuide({ tab, onClose }: Props) {
  const guide = GUIDES[tab]
  if (!guide) return null

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end justify-center px-4 pb-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-surface-800 rounded-2xl p-5 space-y-3 border border-surface-700 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-sm">{guide.title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">✕</button>
        </div>
        <div className="space-y-2">
          {guide.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 bg-surface-700 rounded-xl px-3 py-2">
              <span className="text-brand text-xs mt-0.5 shrink-0">{i + 1}.</span>
              <span className="text-slate-200 text-xs leading-relaxed">{tip}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-brand text-white font-bold text-sm"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
