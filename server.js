const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const colors = require("colors"); // Optional for colored logs
const connectDB = require("./config/db"); // MongoDB connection

// --- Route Imports ---
const ingredientRoutes = require("./routes/ingredientRoutes"); // Adjust path

const app = express();
app.use(express.json());
app.use(cors());
const PORT = process.env.PORT || 5000;
connectDB(); // Connect to MongoDB

const server = app.listen(PORT, () => {
  console.log(
    `🚀 Server running in ${
      process.env.NODE_ENV || "development"
    } mode on port ${PORT}`.yellow.bold
  );
});

// Handle unhandled promise rejections (e.g., database connection errors after initial connect)
process.on("unhandledRejection", (err, promise) => {
  console.error(`Unhandled Rejection: ${err.message}`.red);
});

app.get("/", (req, res) => {
  res.send("API is running...");
});

// Mount the ingredient routes under the /api/ingredients prefix
app.use("/api/ingredients", ingredientRoutes);
