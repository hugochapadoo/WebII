import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { AppError } from "../utils/AppError.js";
import { User } from "../models/User.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return next(AppError.unauthorized("Authorization token is required"));
    }

    const parts = authorization.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return next(AppError.unauthorized("Invalid authorization format"));
    }

    const token = parts[1];
    const payload = jwt.verify(token, config.jwtAccessSecret);

    const user = await User.findById(payload.id);

    if (!user || user.deleted) {
      return next(AppError.unauthorized("User not found"));
    }

    req.user = user;
    next();
  } catch (error) {
    next(AppError.unauthorized("Invalid or expired token"));
  }
};