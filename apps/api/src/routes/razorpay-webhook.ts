import { Router } from "express";
import express from "express";

import { processRazorpayWebhook } from "../services/razorpay-webhook.js";

const router = Router();

router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.header(
        "X-Razorpay-Signature"
      );

      if (!signature) {
        return res.status(400).json({
          success: false,
          error: "Missing Razorpay webhook signature",
        });
      }

      const eventId = req.header(
        "x-razorpay-event-id"
      );

      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: "Missing Razorpay event ID",
        });
      }

      if (!Buffer.isBuffer(req.body)) {
        return res.status(400).json({
          success: false,
          error: "Webhook body must be raw",
        });
      }

      const result =
        await processRazorpayWebhook({
          rawBody: req.body,
          signature,
          eventId,
        });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(
        "Razorpay webhook verification failed:",
        error
      );

      return res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Webhook verification failed",
      });
    }
  }
);

export default router;