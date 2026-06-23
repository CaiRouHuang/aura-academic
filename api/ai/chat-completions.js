import { Buffer } from 'node:buffer';
import process from 'node:process';

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const MAX_BODY_BYTES = 4_000_000;

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  try {
    const body = parseBody(req.body);
    const rawSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
    if (rawSize > MAX_BODY_BYTES) {
      res.status(413).json({
        error: {
          message: 'AI request is too large for the deployment limit. Please upload a smaller file or fewer images.',
        },
      });
      return;
    }

    const apiKey = body.apiKey || process.env.NVIDIA_API_KEY || process.env.AI_API_KEY;
    const baseUrl = String(body.baseUrl || process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const upstreamUrl = resolveChatCompletionsUrl(baseUrl);

    if (!apiKey) {
      res.status(500).json({ error: { message: 'Server AI API key is not configured.' } });
      return;
    }

    if (!body.request || typeof body.request !== 'object') {
      res.status(400).json({ error: { message: 'Missing AI request payload.' } });
      return;
    }

    const timeoutMs = Math.max(10000, Math.min(Number(body.timeoutMs) || 180000, 300000));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify(body.request),
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        res.status(504).json({ error: { message: `AI provider timed out after ${Math.round(timeoutMs / 1000)} seconds.` } });
        return;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');

    if (!upstream.ok && text && upstream.headers.get('content-type')?.includes('application/json')) {
      const payload = JSON.parse(text);
      payload.error = payload.error || {};
      payload.error.message = [
        payload.error.message || `AI provider returned ${upstream.status}.`,
        `Model: ${body.request?.model || 'unknown'}.`,
        `Endpoint: ${upstreamUrl}.`,
      ].join(' ');
      res.end(JSON.stringify(payload));
      return;
    }

    res.end(text);
  } catch (error) {
    res.status(500).json({ error: { message: error.message || 'AI proxy failed.' } });
  }
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') return JSON.parse(body);
  return body;
}

function resolveChatCompletionsUrl(baseUrl) {
  if (baseUrl.endsWith('/chat/completions')) return baseUrl;
  if (baseUrl.endsWith('/v1')) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}
