import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import userRoutes from "./routes/user.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { sanitizeNoSql } from "./middleware/sanitize.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(sanitizeNoSql);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.json({ message: "API working" });
});

app.use("/api/user", userRoutes);

app.use(errorHandler);

export default app;