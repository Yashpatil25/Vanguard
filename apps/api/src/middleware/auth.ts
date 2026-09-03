import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";

export async function requireReviewer(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.header("x-user-id");

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.role !== "REVIEWER" && user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Reviewer authorization required",
      });
    }

    res.locals.user = user;

    next();
  } catch (error) {
    console.error("Authorization failed:", error);

    return res.status(500).json({
      success: false,
      error: "Authorization failed",
    });
  }
}