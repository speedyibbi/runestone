import crypto from 'crypto'
import { FastifyPluginCallback, FastifyRequest, FastifyReply } from "fastify";
import { config } from '@runestone/config'
import schema from './schema.js'

declare module "fastify" {
  interface FastifyRequest {
    hmac: string | null;
  }
}

export default <FastifyPluginCallback>function (fastify, options, done) {
  fastify.decorateRequest('hmac', null);

  fastify.addHook('preHandler', (request: FastifyRequest, reply: FastifyReply, done) => {
    const { 'x-lookup': lookup } = request.headers;

    const hmac = crypto.createHmac('sha256', Buffer.from(config.server.secret, 'utf8'))
    .update(Array.isArray(lookup) ? lookup[0] : lookup ?? '')
    .digest('hex');
    
    request.hmac = hmac

    done()
  })

  fastify.get('/plugin', { schema }, (request: FastifyRequest, reply: FastifyReply) => {
    return request.hmac
  })

  done()
}
