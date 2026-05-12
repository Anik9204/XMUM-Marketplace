import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// NOTE: The frontend SPA communicates directly with Firebase SDKs and does NOT
// call this Express server. This server currently only serves /api/healthz.
// If mutation endpoints are ever added, they MUST require a valid Firebase ID
// token in the Authorization header — do NOT rely on cookies or sessions.
const ALLOWED_ORIGINS = [
  process.env["FRONTEND_URL"],
  "https://xmum-market.replit.app",
].filter((o): o is string => Boolean(o));

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin / server-to-server requests (no Origin header) and
      // explicitly configured origins. Wildcard '*' is intentionally avoided.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin "${origin}" not allowed`));
      }
    },
    optionsSuccessStatus: 200,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
