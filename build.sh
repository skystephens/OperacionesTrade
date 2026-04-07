#!/bin/bash
# build.sh — genera .env desde variables de Render (acepta con o sin prefijo VITE_)

# Groq: acepta VITE_GROQ_API_KEY o GROQ_API_KEY
GROQ_KEY="${VITE_GROQ_API_KEY:-${GROQ_API_KEY:-}}"

# Gemini: acepta VITE_GEMINI_API_KEY o GEMINI_API_KEY
GEMINI_KEY="${VITE_GEMINI_API_KEY:-${GEMINI_API_KEY:-}}"

# Proveedor: acepta VITE_AI_PROVIDER o AI_PROVIDER, default groq
AI_KEY="${VITE_AI_PROVIDER:-${AI_PROVIDER:-groq}}"

# Make webhook: acepta VITE_MAKE_WEBHOOK_URL o MAKE_WEBHOOK_URL
MAKE_KEY="${VITE_MAKE_WEBHOOK_URL:-${MAKE_WEBHOOK_URL:-}}"

# Escribir .env para Vite
cat > .env << EOF
VITE_GROQ_API_KEY=${GROQ_KEY}
VITE_GEMINI_API_KEY=${GEMINI_KEY}
VITE_AI_PROVIDER=${AI_KEY}
VITE_MAKE_WEBHOOK_URL=${MAKE_KEY}
EOF

# Log sin exponer valores
echo "→ .env generado:"
echo "  VITE_GROQ_API_KEY    = ${GROQ_KEY:0:8}***"
echo "  VITE_GEMINI_API_KEY  = ${GEMINI_KEY:0:8}***"
echo "  VITE_AI_PROVIDER     = ${AI_KEY}"
echo "  VITE_MAKE_WEBHOOK_URL= ${MAKE_KEY:0:20}***"

npm install && npm run build
