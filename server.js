import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer as createViteServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function createServer() {
  const app = express()

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  })

  app.use(vite.middlewares)

  app.use('*', async (req, res) => {
    const url = req.originalUrl

    try {
      let template = fs.readFileSync(
        path.resolve(__dirname, 'index.html'),
        'utf-8'
      )

      const styleModule = await vite.ssrLoadModule('/src/index.css')
      const css = styleModule.default

      template = await vite.transformIndexHtml(url, template)
      template = template.replace(
        '<!--ssr-style-outlet-->',
        `<style>${css}</style>`
      )

      const { render } = await vite.ssrLoadModule('/src/entry-server.jsx')
      const appHtml = await render(url)

      let html = template.replace(`<!--ssr-outlet-->`, appHtml)

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      vite.ssrFixStacktrace(e)
      console.error(e)
      res.status(500).end(e.message)
    }
  })

  app.listen(5173)
}

createServer()
