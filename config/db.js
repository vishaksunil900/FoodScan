// config/db.js

const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables from .env file
// It's good practice to load this early, especially if other configs depend on it.
// However, often it's loaded in the main server.js/app.js file.
// If loaded there, you might not need the next line here. Choose one place.
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ Error: MONGODB_URI is not defined in your .env file");
  // Exit the process with failure code
  process.exit(1);
}

// Mongoose connection options (Recommended)
// Mongoose 6+ onwards simplifies options: useNewUrlParser, useUnifiedTopology,
// useCreateIndex, and useFindAndModify are deprecated and no longer needed.
const mongooseOptions = {
  // Use the new connection string parser - Deprecated/Default in Mongoose 6+
  // useNewUrlParser: true,

  // Use the new Server Discovery and Monitoring engine - Deprecated/Default in Mongoose 6+
  // useUnifiedTopology: true,

  // Automatically create indexes specified in your schema - Deprecated/Default in Mongoose 6+
  // useCreateIndex: true, // If you need this explicitly (rarely needed now)

  // Use `findOneAndUpdate()` and `findOneAndDelete()` instead of `findAndModify()` - Deprecated/Default in Mongoose 6+
  // useFindAndModify: false,

  // How long the driver will wait trying to find a suitable server to execute an operation
  serverSelectionTimeoutMS: 5000, // Default: 30000 (30 seconds) - Lower for faster failure detection

  // How long the driver will wait for a response from the server after sending an operation
  socketTimeoutMS: 45000, // Default: 0 (no timeout) - Good to have a timeout

  // For Replica Sets/Sharded Clusters: Controls how reads/writes are distributed.
  // readPreference: 'primaryPreferred', // Example: prefer primary, fall back to secondary

  // Controls the write concern for operations. 'majority' is common for durability.
  // w: 'majority', // Often included in the connection string itself (?w=majority)

  // Automatically try to reconnect when connection is lost (Mongoose handles this by default)
  // autoReconnect: true, // This is the default behavior

  // Number of times to retry initial connection
  // reconnectTries: 30, // Deprecated in newer Mongoose versions

  // Time between initial connection retries
  // reconnectInterval: 1000, // Deprecated in newer Mongoose versions

  // Connection pool size (advanced) - Default is 5
  // Adjust based on your application's concurrency needs
  // poolSize: 10, // Default is 5 in Mongoose 6+
};

const connectDB = async () => {
  try {
    // Attempt to connect to MongoDB
    const conn = await mongoose.connect(MONGODB_URI, mongooseOptions);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`.cyan.underline);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`.red.bold);
    // Exit process with failure
    process.exit(1);
  }
};

// --- Mongoose Connection Event Handling ---

// When successfully connected
mongoose.connection.on("connected", () => {
  console.log(" Mongoose connected to DB".green);
});

// If the connection throws an error after initial connection was established
mongoose.connection.on("error", (err) => {
  console.error(` Mongoose connection error: ${err.message}`.red);
});

// When the connection is disconnected
mongoose.connection.on("disconnected", () => {
  console.log(" Mongoose disconnected from DB".yellow);
});

// When the Node process is terminated (e.g., Ctrl+C)
process.on("SIGINT", async () => {
  try {
    await mongoose.connection.close();
    console.log(
      " Mongoose connection disconnected due to application termination".magenta
    );
    process.exit(0); // Exit successfully
  } catch (err) {
    console.error(
      " Error closing Mongoose connection on app termination:".red,
      err
    );
    process.exit(1); // Exit with failure
  }
});

// Export the connection function
module.exports = connectDB;
