import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { Buffer } from 'node:buffer'
import process from 'node:process'

const MAX_AI_BODY_BYTES = 4_000_000

function aiProxyPlugin() {
  const attachProxy = (middlewares) => {
    middlewares.use('/api/ai/chat-completions', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: { message: 'Method not allowed' } }))
        return
      }

      try {
        const body = await readJsonBody(req)
        const bodyBytes = Buffer.byteLength(JSON.stringify(body), 'utf8')
        if (bodyBytes > MAX_AI_BODY_BYTES) {
          res.statusCode = 413
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { message: 'AI request is too large for the deployment limit. Please upload a smaller file or fewer images.' } }))
          return
        }

        const apiKey = body.apiKey || process.env.NVIDIA_API_KEY || process.env.AI_API_KEY || process.env.VITE_NVIDIA_API_KEY
        const baseUrl = String(body.baseUrl || process.env.VITE_AI_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')
        const upstreamUrl = resolveChatCompletionsUrl(baseUrl)

        if (!apiKey) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { message: 'Missing NVIDIA API key.' } }))
          return
        }

        const timeoutMs = Math.max(10000, Math.min(Number(body.timeoutMs) || 180000, 300000))
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

        let upstream
        try {
          upstream = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify(body.request),
          })
        } catch (error) {
          if (error?.name === 'AbortError') {
            res.statusCode = 504
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: { message: `AI provider timed out after ${Math.round(timeoutMs / 1000)} seconds.` } }))
            return
          }
          throw error
        } finally {
          clearTimeout(timeoutId)
        }

        const text = await upstream.text()
        res.statusCode = upstream.status
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
        if (!upstream.ok && text && upstream.headers.get('content-type')?.includes('application/json')) {
          const payload = JSON.parse(text)
          payload.error = payload.error || {}
          payload.error.message = [
            payload.error.message || `NVIDIA API returned ${upstream.status}.`,
            `Model: ${body.request?.model || 'unknown'}.`,
            `Endpoint: ${upstreamUrl}.`,
          ].join(' ')
          res.end(JSON.stringify(payload))
          return
        }

        res.end(text)
      } catch (error) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: { message: error.message || 'AI proxy failed.' } }))
      }
    })
  }

  return {
    name: 'aura-ai-proxy',
    configureServer(server) {
      attachProxy(server.middlewares)
    },
    configurePreviewServer(server) {
      attachProxy(server.middlewares)
    },
  }
}

function resolveChatCompletionsUrl(baseUrl) {
  if (baseUrl.endsWith('/chat/completions')) {
    return baseUrl
  }
  if (baseUrl.endsWith('/v1')) {
    return `${baseUrl}/chat/completions`
  }
  return `${baseUrl}/v1/chat/completions`
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

export default defineConfig({
  plugins: [
    aiProxyPlugin(),
    react(),
    tailwindcss(),
  ],
})
