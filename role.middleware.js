import mongoose from "mongoose";
import app from "./app.js";
import { config } from "./config/index.js";

const startServer = async () => {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log("MongoDB connected");

    app.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error("Error starting server:", error.message);
  }
};

startServer();