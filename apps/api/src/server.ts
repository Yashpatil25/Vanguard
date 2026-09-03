import "dotenv/config";

import express from "express";
import cors from "cors";

import paymentsRouter from "./routes/payments.js";
import auditRouter from "./routes/audit.js";
import razorpayWebhookRouter from "./routes/razorpay-webhook.js";
import demoRouter from "./routes/demo.js"; 

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

/*
 * Razorpay webhooks must receive the raw request body
 * so the HMAC signature can be verified correctly.
 *
 * IMPORTANT:
 * This route must be mounted BEFORE express.json().
 */
app.use("/api/v1/webhooks", razorpayWebhookRouter);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    service: "vanguard-api",
    status: "ok",
  });
});

app.use("/api/v1/payments", paymentsRouter);
app.use("/api/v1/audit", auditRouter);
app.use("/api/v1/demo", demoRouter);

const PORT = Number(process.env.API_PORT) || 4000;

app.listen(PORT, () => {
  console.log(`Vanguard API running on port ${PORT}`);
});