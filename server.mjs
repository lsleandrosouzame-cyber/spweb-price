import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const distRoot = path.resolve(fileURLToPath(new URL('./dist/', import.meta.url)))
const indexFile = path.join(distRoot, 'index.html')
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendJson(request, response, status, body, cacheControl = 'no-store') {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'Cache-Control': cacheControl,
    'Content-Length': Buffer.byteLength(payload),
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(request.method === 'HEAD' ? undefined : payload)
}

async function serveStatic(request, response, pathname) {
  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    sendJson(request, response, 400, { error: 'invalid_path' })
    return
  }

  if (/[\u0000-\u001f]/.test(decodedPath)) {
    sendJson(request, response, 400, { error: 'invalid_path' })
    return
  }

  let filePath = path.resolve(distRoot, `.${decodedPath}`)
  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${path.sep}`)) {
    sendJson(request, response, 400, { error: 'invalid_path' })
    return
  }

  let fileInfo
  try {
    fileInfo = await stat(filePath)
    if (fileInfo.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
      fileInfo = await stat(filePath)
    }
  } catch {
    if (path.extname(decodedPath)) {
      sendJson(request, response, 404, { error: 'not_found' })
      return
    }
    filePath = indexFile
    try {
      fileInfo = await stat(filePath)
    } catch {
      sendJson(request, response, 500, { error: 'application_not_built' })
      return
    }
  }

  if (!fileInfo.isFile()) {
    sendJson(request, response, 404, { error: 'not_found' })
    return
  }

  const extension = path.extname(filePath).toLowerCase()
  // NEVER CACHE - Save everything to Supabase only
  const cacheControl = 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  response.writeHead(200, {
    'Cache-Control': cacheControl,
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Length': fileInfo.size,
    'Content-Type': mimeTypes[extension] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  })

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  const stream = createReadStream(filePath)
  stream.on('error', () => {
    if (!response.headersSent) sendJson(request, response, 500, { error: 'file_read_failed' })
    else response.destroy()
  })
  stream.pipe(response)
}

const server = createServer(async (request, response) => {
  const method = request.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    sendJson(request, response, 405, { error: 'method_not_allowed' })
    return
  }

  let pathname
  try {
    pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  } catch {
    sendJson(request, response, 400, { error: 'invalid_request' })
    return
  }

  if (pathname === '/health') {
    sendJson(request, response, 200, { status: 'ok' })
    return
  }

  if (pathname === '/api/config') {
    const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? ''
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim() ?? ''
    const configured = Boolean(supabaseUrl && supabaseAnonKey)
    sendJson(request, response, 200, {
      configured,
      supabaseUrl: configured ? supabaseUrl : null,
      supabaseAnonKey: configured ? supabaseAnonKey : null,
    })
    return
  }

  if (pathname.startsWith('/api/')) {
    sendJson(request, response, 404, { error: 'not_found' })
    return
  }

  await serveStatic(request, response, pathname)
})

const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer from 1 to 65535.')
}

server.listen(port, '0.0.0.0', () => {
  console.log(`SPWeb Lucro server listening on port ${port}`)
})
