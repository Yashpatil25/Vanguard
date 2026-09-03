import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error(
    "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured"
  );
}

export const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export async function createRazorpayOrder(params: {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResult> {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new Error("Invalid payment amount");
  }

  const orderRequest: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  } = {
    amount: params.amount * 100,
    currency: params.currency,
    receipt: params.receipt,
  };

  if (params.notes) {
    orderRequest.notes = params.notes;
  }

  const order = await razorpay.orders.create(orderRequest as any);

  if (!order.id) {
    throw new Error("Razorpay did not return an order ID");
  }

  if (order.receipt === undefined) {
    throw new Error("Razorpay did not return a receipt");
  }

  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
    receipt: order.receipt,
    status: order.status,
  };
}