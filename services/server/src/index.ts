import fastify from "fastify";
import { config } from "@runestone/config";
import fileManager from "./plugins/fm/index.js";

export const app = fastify();

app.register(fileManager, { prefix: "/api/file" });

if (!config.global.environment.serverless) {
  app.listen(
    { port: config.server.port ?? 8080, host: config.server.host ?? "0.0.0.0" },
    (err, address) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log(`Server listening at ${address}`);
    },
  );
}
