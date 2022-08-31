import express, { Express, Request, Response, Router } from "express"
import proxy from "express-http-proxy"
import parser from "body-parser"
import cors from "cors"

import RPC_REGISTRY from "./rpc-registry"

const app: Express = express()
const port = 777

function selectRPC() {
  return RPC_REGISTRY[0]
}

app.use(cors())
app.use("/", proxy(selectRPC, {
  // https: true,
  userResDecorator: (
    proxyRes: Request,
    proxyResData: Response
  ) => {
    console.log(proxyResData.jsonp)

    return proxyRes
  },
  filter: (
    userReq: Request,
    userRes: Response
  ) => {

    return true;
  }
}))
app.use(parser.urlencoded({ extended: false }))
app.use(parser.json())

app.listen(port, () => {
  console.log(`[server]: Resolver is running at https://localhost:${port}`)
})
