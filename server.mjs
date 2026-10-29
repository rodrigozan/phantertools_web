import http from 'node:http'
import https from 'node:https'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json' }
const hopHeaders = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']
function end(res, code, message) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify({ error: message, message }))
}

export function createServer({ upstream = process.env.API_UPSTREAM_URL || 'https://phanterai.tailc5aaf7.ts.net:10000/ig', dist = fileURLToPath(new URL('./dist', import.meta.url)) } = {}) {
  const target = new URL(upstream.replace(/\/$/, '') + '/')
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw Error('API_UPSTREAM_URL inválida')
  const root = resolve(dist)
  return http.createServer(async (req, res) => {
    const pathname = req.url.split('?')[0]
    if (/^\/(api|public)(\/|$)/.test(pathname)) {
      // Concatenate rather than resolve: a client path cannot select a different host.
      const url = new URL(target.href.replace(/\/$/, '') + req.url)
      if (url.origin !== target.origin || !url.pathname.startsWith(target.pathname)) return end(res, 400, 'invalid_path')
      const headers = { ...req.headers, host: target.host }
      for (const key of [...hopHeaders, ...(req.headers.connection || '').split(',').map(x => x.trim().toLowerCase()), 'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto']) delete headers[key]
      // The upstream is reached through HTTPS Funnel, which supplies its own trusted proxy headers.
      const transport = url.protocol === 'https:' ? https : http
      const proxy = transport.request(url, { method: req.method, headers }, upstreamRes => {
        const responseHeaders = { ...upstreamRes.headers, 'cache-control': 'no-store' }
        for (const key of hopHeaders) delete responseHeaders[key]
        res.writeHead(upstreamRes.statusCode || 502, responseHeaders)
        upstreamRes.on('error', () => res.destroy())
        upstreamRes.pipe(res)
      })
      proxy.setTimeout(15 * 60 * 1000, () => proxy.destroy(Error('upstream timeout')))
      proxy.on('error', () => { if (!res.headersSent) end(res, 502, 'api_unavailable'); else res.destroy() })
      req.on('aborted', () => proxy.destroy())
      res.on('close', () => { if (!res.writableEnded) proxy.destroy() })
      req.pipe(proxy)
      return
    }
    if (!['GET', 'HEAD'].includes(req.method)) return end(res, 405, 'method_not_allowed')
    try {
      const decoded = decodeURIComponent(pathname)
      if (decoded.includes('\0') || decoded.split('/').some(x => x.startsWith('.'))) return end(res, 404, 'not_found')
      let file = resolve(root, '.' + decoded)
      if (file !== root && !file.startsWith(root + sep)) return end(res, 404, 'not_found')
      let info = await stat(file).catch(() => null)
      if (!info?.isFile()) {
        if (extname(decoded)) return end(res, 404, 'not_found')
        file = resolve(root, 'index.html')
        info = await stat(file)
      }
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Content-Length': info.size,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      })
      if (req.method === 'HEAD') return res.end()
      createReadStream(file).on('error', () => res.destroy()).pipe(res)
    } catch { end(res, 404, 'not_found') }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => console.log('Phanter Tools web iniciado'))
}
