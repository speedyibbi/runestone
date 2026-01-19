import { awsLambdaFastify } from "@fastify/aws-lambda";
import { app } from "./index.js";

export const handler = awsLambdaFastify(app);
await app.ready();
