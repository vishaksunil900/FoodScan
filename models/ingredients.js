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

// --- Static Methods ---

/**
 * Finds a SINGLE ingredient document matching either the exact name or an alias.
 * Useful when you expect only one result for a specific identifier.
 * @param {string} searchTerm - The single name or alias to search for.
 * @returns {Promise<Document|null>} A promise resolving to the found ingredient or null.
 */
ingredientSchema.statics.findByNameOrAlias = function (searchTerm) {
  // Ensure searchTerm is a string before processing
  const normalizedTerm = String(searchTerm || "")
    .toLowerCase()
    .trim();
  if (!normalizedTerm) {
    return Promise.resolve(null); // Return null if search term is empty
  }
  // Use findOne as we expect at most one match for a unique name/alias pair
  return this.findOne({
    $or: [{ name: normalizedTerm }, { aliases: normalizedTerm }],
  });
};

/**
 * Finds ALL ingredient documents where the name OR any alias matches ANY of the provided terms.
 * Designed to work with an array of pre-normalized (lowercase, trimmed) terms.
 * @param {string[]} termsArray - An array of lowercase, trimmed terms to search for.
 * @returns {Promise<Document[]>} A promise resolving to an array of found ingredients.
 */
ingredientSchema.statics.findByTerms = function (termsArray) {
  // Basic validation on the input array
  if (!Array.isArray(termsArray) || termsArray.length === 0) {
    return Promise.resolve([]); // Return empty array if no valid terms provided
  }

  // Filter out any potential non-string or empty values from the array defensively
  const validTerms = termsArray.filter(
    (term) => typeof term === "string" && term.length > 0
  );

  if (validTerms.length === 0) {
    return Promise.resolve([]);
  }

  // Use find() with $in for efficient matching against multiple values in indexed fields
  return this.find({
    $or: [
      { name: { $in: validTerms } }, // Check if the name is in the list of terms
      { aliases: { $in: validTerms } }, // Check if any alias in the 'aliases' array is in the list of terms
    ],
  });
};

const Ingredient = mongoose.model("Ingredient", ingredientSchema);
module.exports = Ingredient;
