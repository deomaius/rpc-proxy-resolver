
import type * as http from 'http'
import type * as server from 'http-proxy-middleware/dist/types'

import express, { Request, Response } from "express"
import dotenv from 'dotenv'

import { createProxyMiddleware } from 'http-proxy-middleware'

import parser from "body-parser"
import cors from "cors"
import fs from "fs"

import RPC_REGISTRY from "./rpc-registry"

const app = express()
const port = 1232

dotenv.config()

function selectRPC() {
  return RPC_REGISTRY[1]
}

async function handleResponse(
    proxyRes: http.IncomingMessage,
    req: Request,
    res: Response
  ) => {
    var body: any = []
    proxyRes.on('data', (chunk) => body.push(chunk))
    proxyRes.on('end', () => {
       body = Buffer.concat(body).toString()
       console.log("RESPONSE:", body)
       res.end(body)
    })
}

async function handleRequest(
  proxyReq: http.ClientRequest,
  req: Request,
  res: Response
) => {
  if(req.body) {
      let body = JSON.stringify(req.body)

      proxyReq.setHeader('Content-type', 'application/json')
      proxyReq.setHeader('Content-length', Buffer.byteLength(body))

      proxyReq.write(body)
  }
}

const proxyConfiguration: server.Options = {
  ws: true,
  toProxy: true,
  changeOrigin: true,
  target: selectRPC(),
  ssl: {
    key: fs.readFileSync(process.env.SSL_KEY, "ascii"),
    cert: fs.readFileSync(process.env.SSL_CERT, "ascii")
  },
  preserveHeaderKeyCase: true,
  onProxyRes:handleResponse,
  onProxyReq: handleRequest
}

app.use("/", createProxyMiddleware(proxyConfiguration))

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.raw())

app.post("/v1", createProxyMiddleware(proxyConfiguration))

app.listen(port, () => {
  console.log(`[server]: Resolver is running at https://localhost:${port}`)
})
