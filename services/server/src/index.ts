import fastify from 'fastify'
import { config } from '@runestone/config'
import main from './plugins/main/index.js'

const server = fastify()

server.register(main)

server.listen({ port: config.server.port ?? 8080, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Server listening at ${address}`)
})
