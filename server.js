const express = require("express");
const multer = require("multer");
const cors = require("cors");
const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
const dotenv = require("dotenv");
const colors = require("colors"); // Optional for colored logs
const connectDB = require("./config/db"); // MongoDB connection

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;
connectDB(); // Connect to MongoDB

// OpenAI setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Route: Upload and Analyze
app.post("/analyze", upload.single("file"), async (req, res) => {
  console.log("File received:", req.file);
  const imagePath = req.file.path;

  try {
    // Step 1: OCR to extract text
    const result = await Tesseract.recognize(imagePath, "eng");
    const extractedText = result.data.text;
    fs.unlinkSync(imagePath); // delete file after processing

    // Step 2: Analyze with ChatGPT
    const prompt = `
You are a food safety and health assistant. Given this list of ingredients:

${extractedText}

Extract all the ingredients and give a structured response in JSON format like this:
{
  "ingredients": [
    {
      "name": "ingredient name",
      "isHealthy": true | false,
      "notes": "short reason why it's good/bad"
    },
    ...
  ]
}
Only return the JSON.`;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const output = chatResponse.choices[0].message.content.trim();
    res.json({ extractedText, analysis: JSON.parse(output) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong during processing." });
  }
});

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
