import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from '../server.mjs'

async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}
async function close(server) { server.closeAllConnections(); await new Promise(r => server.close(r)) }

test('proxy forwards body, cookies, query and OAuth redirects without following them', async () => {
  let seen
  const upstream = http.createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    seen = { url: req.url, body, cookie: req.headers.cookie, contentType: req.headers['content-type'] }
    res.writeHead(302, { 'Set-Cookie': ['ig_session=example; Path=/; HttpOnly; Secure; SameSite=Lax'], Location: 'https://accounts.google.com/example' })
    res.end()
  })
  const upstreamUrl = await listen(upstream)
  const server = createServer({ upstream: upstreamUrl + '/ig' })
  const base = await listen(server)
  try {
    const r = await fetch(base + '/api/media?batch=1', { method: 'POST', body: 'raw-upload', headers: { Cookie: 'ig_session=existing', 'Content-Type': 'multipart/form-data; boundary=test' }, redirect: 'manual' })
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), 'https://accounts.google.com/example')
    assert.match(r.headers.get('set-cookie'), /Path=\/; HttpOnly/)
    assert.equal(r.headers.get('cache-control'), 'no-store')
    assert.deepEqual(seen, { url: '/ig/api/media?batch=1', body: 'raw-upload', cookie: 'ig_session=existing', contentType: 'multipart/form-data; boundary=test' })
    assert.equal((await fetch(base + '/public/media/example', { redirect: 'manual' })).status, 302)
  } finally { await close(server); await close(upstream) }
})

test('SPA fallback serves pages but missing assets and private paths return 404', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'phanter-web-'))
  await writeFile(join(dist, 'index.html'), '<html>app</html>')
  await writeFile(join(dist, 'theme-init.js'), 'window.theme=true')
  const server = createServer({ dist })
  const base = await listen(server)
  try {
    assert.equal(await (await fetch(base + '/login')).text(), '<html>app</html>')
    const js = await fetch(base + '/theme-init.js')
    assert.equal(js.headers.get('content-type'), 'text/javascript')
    assert.equal((await fetch(base + '/missing.js')).status, 404)
    assert.equal((await fetch(base + '/.env')).status, 404)
    assert.equal((await fetch(base + '/%2eenv')).status, 404)
    assert.equal((await fetch(base + '/login', { method: 'POST' })).status, 405)
  } finally { await close(server); await rm(dist, { recursive: true }) }
})
