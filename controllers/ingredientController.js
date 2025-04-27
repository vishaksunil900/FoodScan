// controllers/ingredientController.js
const Ingredient = require("../models/ingredients"); // Adjust path if needed

/**
 * @desc    Create a new ingredient
 * @route   POST /api/ingredients
 * @access  Public (Adjust as needed with authentication middleware)
 */
exports.createIngredient = async (req, res) => {
  try {
    // Mongoose automatically takes fields from req.body that match the schema
    const newIngredient = new Ingredient(req.body);

    // Mongoose's save() method triggers validation defined in the schema
    const savedIngredient = await newIngredient.save();

    res.status(201).json({
      success: true,
      message: "Ingredient created successfully.",
      data: savedIngredient,
    });
  } catch (error) {
    console.error("Error creating ingredient:", error);

    // Handle validation errors specifically
    if (error.name === "ValidationError") {
      // Extract validation messages
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: messages,
      });
      console.error("request error:", req.body);
    }

    // Handle duplicate key errors (for 'name' uniqueness)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: `Duplicate field value entered for '${Object.keys(
          error.keyValue
        )}'. Please use a unique value.`,
        field: Object.keys(error.keyValue)[0], // Identify the duplicate field
      });
    }

    // Handle other potential errors
    res.status(500).json({
      success: false,
      message: "Server error while creating ingredient.",
      error: error.message, // Provide error message in dev, maybe generic in prod
    });
  }
};

/**
 * @desc    Search for ingredients by name or alias
 *          (accepts single term or comma-separated list in one query parameter)
 * @route   GET /api/ingredients/search?terms=value1,value2,value3...
 * @access  Public
 */
exports.searchIngredients = async (req, res) => {
  try {
    // 1. Get the 'terms' query parameter as a string
    const termsString = req.query.terms;

    // 2. Validate Input: Check if termsString exists, is a string, and is not empty
    if (
      !termsString ||
      typeof termsString !== "string" ||
      termsString.trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Search term(s) are required as a non-empty, comma-separated string in the "terms" query parameter.',
      });
    }

    // 3. Split the string by comma
    // 4. Normalize each term (lowercase, trim)
    // 5. Filter out any empty strings resulting from splitting/trimming
    const normalizedTerms = termsString
      .split(",")
      .map((term) => term.toLowerCase().trim())
      .filter((term) => term.length > 0); // Filter ensures non-empty strings

    // 6. Validate that there are valid terms remaining after normalization
    if (normalizedTerms.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one valid search term.",
      });
    }

    // 7. Database Query: Use the static method from the Ingredient model
    //    This method already handles the $or / $in logic
    const ingredients = await Ingredient.findByTerms(normalizedTerms);

    // 8. Send Response: Return 200 OK with the count and data
    res.status(200).json({
      success: true,
      count: ingredients.length, // Number of ingredients found
      data: ingredients, // Array of ingredient documents
    });
  } catch (error) {
    // 9. Error Handling: Catch potential server errors during the process
    console.error("Error searching ingredients:", error);
    res.status(500).json({
      success: false,
      message: "Server error while searching ingredients.",
      // Avoid sending detailed error messages in production for security
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "An internal error occurred.",
    });
  }
};
