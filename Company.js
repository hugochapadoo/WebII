import { AppError } from "../utils/AppError.js";

export const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized("Unauthorized"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden("Forbidden"));
    }

    next();
  };
};