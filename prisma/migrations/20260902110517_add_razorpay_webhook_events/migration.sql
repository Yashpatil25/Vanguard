-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'REVIEWER', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "razorpay_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "razorpay_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "razorpay_webhook_events_eventId_key" ON "razorpay_webhook_events"("eventId");

-- CreateIndex
CREATE INDEX "razorpay_webhook_events_event_idx" ON "razorpay_webhook_events"("event");

-- CreateIndex
CREATE INDEX "razorpay_webhook_events_createdAt_idx" ON "razorpay_webhook_events"("createdAt");
