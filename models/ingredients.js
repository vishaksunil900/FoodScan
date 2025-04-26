const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema(
  {
    name: {
      // The primary name used for lookup (e.g., lowercase, normalized)
      type: String,
      required: [true, "Ingredient name is required."], // Added custom error message
      unique: true, // Ensure we don't duplicate ingredients
      index: true, // Crucial for fast lookups
      trim: true, // Remove leading/trailing whitespace
      lowercase: true, // Automatically convert to lowercase
    },
    display_name: {
      // How the name should be shown to the user (original capitalization)
      type: String,
      required: [true, "Display name is required."],
      trim: true,
    },
    aliases: {
      // Other names, INCI names, synonyms found (normalized)
      type: [
        {
          type: String,
          trim: true,
          lowercase: true, // Normalize aliases too
        },
      ],
      index: true, // Index for potential lookups by alias
      default: [], // Good practice to default arrays
    },
    functions: {
      // Array of functions (e.g., ["Preservative", "Emulsifier"])
      // Option 1: Simple Strings (more flexible if vocabulary is dynamic)
      type: [
        {
          type: String,
          trim: true,
          // Consider lowercase: true here too if desired for consistency
        },
      ],
      index: true, // Index if commonly queried
      default: [],
      // Option 2: Using Enum (better validation if vocabulary is controlled)
      // type: [{
      //   type: String,
      //   trim: true,
      //   enum: ['Preservative', 'Emulsifier', 'Solvent', 'Fragrance', 'Colorant', 'Surfactant', /* ... other known functions */]
      // }],
      // index: true,
      // default: []
    },
    health_rating: {
      // Your calculated score (e.g., 1-5)
      type: Number,
      min: [1, "Health rating must be at least 1."], // Define min scale value
      max: [5, "Health rating must be no more than 5."], // Define max scale value
      index: true, // Index if commonly queried/filtered
    },
    rating_rationale: {
      // LLM-generated or curated explanation
      type: String,
      trim: true,
    },
    potential_side_effects: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    source: {
      // Where did this data come from?
      type: String,
      required: true,
      enum: [
        "LLM",
        "Curated",
        "User Contribution",
        "Database Import",
        "Scientific Literature",
      ], // Enforce allowed sources
      default: "LLM",
      index: true, // Index if commonly queried
    },
    source_details: {
      // Optional: More specific details about the source
      // Could be LLM model, curator username, publication DOI, etc.
      type: String, // Keep simple for now, or make an Object for structure
      trim: true,
    },
    // Removed created_at and last_updated_at, using timestamps option below
  },
  {
    // Mongoose Schema Options
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

//Optional: Text Index for free-text search across multiple fields
ingredientSchema.index({ name: "text", display_name: "text", aliases: "text" });

// Add a method for finding by name or alias (example)
ingredientSchema.statics.findByNameOrAlias = function (searchTerm) {
  const normalizedTerm = searchTerm.toLowerCase().trim();
  return this.findOne({
    $or: [{ name: normalizedTerm }, { aliases: normalizedTerm }],
  });
};

const Ingredient = mongoose.model("Ingredient", ingredientSchema);
module.exports = Ingredient;
