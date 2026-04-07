#!/bin/bash
# build.sh — genera .env desde variables de Render y compila

echo "VITE_GROQ_API_KEY=${GROQ_API_KEY:-}" >> .env
echo "VITE_GEMINI_API_KEY=${GEMINI_API_KEY:-}" >> .env
echo "VITE_AI_PROVIDER=${AI_PROVIDER:-groq}" >> .env
echo "VITE_MAKE_WEBHOOK_URL=${MAKE_WEBHOOK_URL:-}" >> .env

echo "→ .env generado:"
cat .env | sed 's/=.*/=***/' # muestra keys ocultas en log

npm install && npm run build
