import crypto from "crypto";
import { config } from "@runestone/config";
import { FastifyPluginCallback, FastifyRequest, FastifyReply } from "fastify";
import { deleteFile, getFile, upsertFile } from "../../utils/file.js";
import schema from "./schema.js";

declare module "fastify" {
  interface FastifyRequest {
    hmac: string | null;
  }
}

interface Query {
  path: string;
  contentLength?: number;
}

export default <FastifyPluginCallback>function (fastify, options, done) {
  fastify.decorateRequest("hmac", null);

  fastify.addHook(
    "preHandler",
    (request: FastifyRequest, reply: FastifyReply, done) => {
      const { "x-lookup": lookup } = request.headers;

      const hmac = crypto
        .createHmac(
          "sha256",
          Array.isArray(lookup) ? lookup[0] : (lookup ?? ""),
        )
        .digest("hex");

      request.hmac = hmac;

      done();
    },
  );

  fastify.get(
    "/",
    { schema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { path } = request.query as Query;

      return {
        signedURL: await getFile(`${request.hmac}/${path}`),
      };
    },
  );

  fastify.post(
    "/",
    { schema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { path, contentLength } = request.query as Query;

      if (contentLength !== undefined) {
        const maxSize = config.server.fileUpload.maxSize;
        if (contentLength > maxSize) {
          return reply.code(413).send({
            error: "File too large",
            message: `File size (${contentLength} bytes) exceeds maximum allowed size (${maxSize} bytes)`,
            maxSize,
          });
        }

        if (contentLength < 0) {
          return reply.code(400).send({
            error: "Invalid file size",
            message: "File size must be a positive number",
          });
        }
      }

      return {
        signedURL: await upsertFile(`${request.hmac}/${path}`, contentLength),
      };
    },
  );

  fastify.delete(
    "/",
    { schema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { path } = request.query as Query;

      return {
        signedURL: await deleteFile(`${request.hmac}/${path}`),
      };
    },
  );

  done();
};
