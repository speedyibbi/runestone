import crypto from 'crypto'
import { FastifyPluginCallback, FastifyRequest, FastifyReply } from "fastify";
import { config } from '@runestone/config'
import { deleteFile, getFile, upsertFile } from '../../utils/file.js'
import schema from './schema.js'

declare module "fastify" {
  interface FastifyRequest {
    hmac: string | null;
  }
}

interface Query {
  path: string;
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

  fastify.get('/', { schema }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { path } = request.query as Query;

    return {
      signedURL: await getFile(`${request.hmac}/${path}`),
    };
  })

  fastify.post('/', { schema }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { path } = request.query as Query;

    return {
      signedURL: await upsertFile(`${request.hmac}/${path}`),
    };
  })

  fastify.delete('/', { schema }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { path } = request.query as Query;

    return {
      signedURL: await deleteFile(`${request.hmac}/${path}`),
    };
  })

  done()
}
