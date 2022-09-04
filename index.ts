import * as server from "http-proxy-middleware/dist/types"
import type * as client from "express"
import type * as http from "http"

import { ENDPOINT_REGISTRY, ADDRESSES, REGISTER_CALL } from "./constants/domains"
import { createProxyMiddleware } from "http-proxy-middleware"

import * as ethers from "ethers"
import express from "express"
import dotenv from "dotenv"
import zlib from "zlib"
import cors from "cors"
import fs from "fs"

const SERVER = express()
const PORT = 1232

dotenv.config()

function decodeMessage(
  msg: http.IncomingMessage,
  stream: Array<Buffer>,
  encoding: string
) {
  return new Promise((resolve) => {
    msg.on('data', (chunk) => stream.push(chunk))
    msg.on("end", () => {
      const raw = Buffer.concat(stream)

      if(encoding == "br") {
        zlib.brotliDecompress(raw,
          (error, buffer) => {
            if(buffer) resolve(buffer.toString())
            else resolve(error)
          })
      } else {
        resolve(raw.toString())
      }
    })
  })
}

async function selectFunctionalEndpoint(): Promise<string> {
  let selectedEndpoint = ENDPOINT_REGISTRY[0]
  let isEndpointWorking = false
  let endpointIndex = 0

  while(isEndpointWorking != true) {
    selectedEndpoint = ENDPOINT_REGISTRY[endpointIndex]
    isEndpointWorking = await simulateCall(selectedEndpoint)

    if(!isEndpointWorking) endpointIndex++
  }

  return selectedEndpoint
}

async function simulateCall(rpcEndpoint: string): Promise<boolean> {
  const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint)
  const price = await provider.getGasPrice()
  let transactionCall = true

  try {
    await provider.call({
      from: ADDRESSES.depositor,
      to: ADDRESSES.pool,
      data: REGISTER_CALL,
    }, "latest")
  } catch(e) {
    transactionCall = false
  } finally {
    return transactionCall
  }
}

function handleRequest(
  proxyReq: http.ClientRequest,
  req: client.Request,
  res: client.Response
) {
  if(req.body) {
    let body = JSON.stringify(req.body)

    proxyReq.setHeader("Content-type", "application/json")
    proxyReq.setHeader("Content-length", Buffer.byteLength(body))

    proxyReq.write(body)
  }
}

async function handleResponse(
  proxyRes: http.IncomingMessage,
  req: client.Request,
  res: client.Response
) {
  const resEncoding = proxyRes.headers["content-encoding"]
  const resBuffer: Array<Buffer> = []
  const resBody = await decodeMessage(
    proxyRes,
    resBuffer,
    resEncoding || "application/json"
  )

  console.log('RESPONSE:', resBody)
}

function handleError(
  err: Error,
  req: client.Request,
  res: client.Response
) {
  console.log('ERROR:', err)
}

const proxyConfiguration: server.Options = {
  target: ENDPOINT_REGISTRY[0],
  ssl: {
    key: fs.readFileSync(process.env.SSL_KEY, "ascii"),
    cert: fs.readFileSync(process.env.SSL_CERT, "ascii")
  },
  router: selectFunctionalEndpoint,
  onProxyRes: handleResponse,
  onProxyReq: handleRequest,
  onError: handleError,
  changeOrigin: true,
  toProxy: true
  // TODO: websocket support
  // ws: true
}

SERVER.use("/", createProxyMiddleware(proxyConfiguration))
SERVER.use(express.json())
SERVER.use(express.urlencoded({ extended: true }))
SERVER.use(express.raw())
SERVER.use(cors())

SERVER.listen(PORT, () => console.log(`[server]: ${PORT}`))
