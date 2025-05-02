// controllers/ingredientController.js
const Ingredient = require("../models/ingredients"); // Adjust path if needed
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

// --- Initialize Google AI Client ---
// Ensure API key is available
if (!process.env.GEMINI_API_KEY) {
  console.error("FATAL ERROR: GEMINI_API_KEY environment variable is not set.");
  // Optionally exit or handle this more gracefully depending on your app's needs
  // process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-latest",
});

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
    // const normalizedTerms = termsString
    //   .split(",")
    //   .map((term) => term.toLowerCase().trim())
    //   .filter((term) => term.length > 0); // Filter ensures non-empty strings

    const normalizedTerms = termsString
      .split(",") // 1. Split the string into an array by commas
      .map(
        (
          term // 2. Process each element (potential term) in the array
        ) =>
          term
            .toLowerCase() // 3. Convert the term to lowercase
            .replace(/[\(\)\[\]\{\}]/g, "") // 4. Remove all instances of (), [], {} characters globally
            .trim() // 5. Remove leading/trailing whitespace from the result
      )
      .filter((term) => term.length > 0); // 6. Remove any terms that are now empty strings

    console.log(normalizedTerms);
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

/**
 * @desc    Processes a list of terms: finds data for existing ingredients,
 *          uses LLM for missing ones, and optionally saves new LLM data.
 * @route   GET /api/ingredients/process-list?terms=value1,value2...&productType=[cosmetic|food]
 * @access  Public
 * @returns {object} JSON object with dbData (array), llmAnalysis (object from LLM), and llmQueryTerms (string).
 */
exports.getIngredientsAndCheckMissing = async (req, res) => {
  let llmData = null; // Initialize variable to hold LLM response data
  let llmQueryTermsString = ""; // Initialize string for terms sent to LLM

  try {
    // 1. Get and Validate Input Terms and Product Type
    const termsString = req.query.terms;
    const productType = req.query.productType?.toLowerCase(); // Get product type and lowercase it

    if (
      !termsString ||
      typeof termsString !== "string" ||
      termsString.trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Term(s) are required as a non-empty, comma-separated string in the "terms" query parameter.',
      });
    }
    if (!productType || !["cosmetic", "food"].includes(productType)) {
      return res.status(400).json({
        success: false,
        message:
          'A valid "productType" query parameter ("cosmetic" or "food") is required.',
      });
    }

    // const normalizedTerms = termsString
    //   .split(",")
    //   .map((term) => term.toLowerCase().trim())
    //   .filter((term) => term.length > 0);

    const normalizedTerms = termsString
      .split(",") // 1. Split the string into an array by commas
      .map(
        (
          term // 2. Process each element (potential term) in the array
        ) =>
          term
            .toLowerCase() // 3. Convert the term to lowercase
            .replace(/[\(\)\[\]\{\}]/g, "") // 4. Remove all instances of (), [], {} characters globally
            .trim() // 5. Remove leading/trailing whitespace from the result
      )
      .filter((term) => term.length > 0); // 6. Remove any terms that are now empty strings

    console.log(normalizedTerms);

    if (normalizedTerms.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one valid search term.",
      });
    }

    // --- Partition Terms ---
    const foundExistenceCheck = await Ingredient.findByTerms(normalizedTerms)
      .select("name aliases")
      .lean();

    const foundDbIdentifiers = new Set();
    foundExistenceCheck.forEach((ingredient) => {
      foundDbIdentifiers.add(ingredient.name);
      if (ingredient.aliases && Array.isArray(ingredient.aliases)) {
        ingredient.aliases.forEach((alias) => foundDbIdentifiers.add(alias));
      }
    });

    const termsInDB = [];
    const termsNotInDB = [];
    const uniqueNormalizedTerms = new Set(normalizedTerms);

    uniqueNormalizedTerms.forEach((term) => {
      if (foundDbIdentifiers.has(term)) {
        termsInDB.push(term);
      } else {
        termsNotInDB.push(term);
      }
    });

    // --- Fetch Full Data for Terms Found In DB ---
    let dbData = [];
    if (termsInDB.length > 0) {
      // Fetch full documents for terms found in the DB
      dbData = await Ingredient.findByTerms(termsInDB);
    }

    // --- Call LLM for Terms Not Found In DB ---
    if (termsNotInDB.length > 0) {
      llmQueryTermsString = termsNotInDB.join(","); // Prepare string for LLM prompt

      // Construct the Prompt
      const prompt = `Analyze the following ingredient list obtained from a product:

"${llmQueryTermsString}"




{
  "ingredient_name": "The primary standardized name of the ingredient.",
  "aliases": ["...", "..."], // List common synonyms, INCI names, or alternative names found for this ingredient. Provide an empty array [] if none are commonly known or found.
  "functions": ["...", "..."], // e.g., ["Preservative", "Emulsifier"]. Describe its role(s) in the product type ([cosmetic/food]).
  "health_rating": number, // Scale 1-5 (1=Generally Considered Gentle/Beneficial, 3=Neutral/Minor Concern/More Data Needed, 5=High Concern/Potential Irritant/Avoid for Sensitive Individuals). Base this on potential for irritation, allergenicity, known toxicity concerns, or significant lack of safety data.
  "rating_rationale": "Brief explanation for the health_rating provided. Mention key factors like irritation potential, regulatory status, or common concerns. Avoid definitive medical claims.",
  "potential_side_effects": ["...", "..."], // List potential side effects, irritations, or sensitivities commonly associated with this ingredient. Provide an empty array [] if none are widely recognized.
  "source": "LLM", // Fixed value: This specific analysis record is generated by the Language Model now.
  "source_details": "Specify the source, Do not provide specific citations unless explicitly retrieved."
}

Assign the health_rating based on a general synthesis of information from reputable sources commonly used in ingredient safety assessment, such as regulatory bodies (FDA, EU CosIng), safety review panels (CIR), public databases (EWG Skin Deep, Paula's Choice Dictionary for cosmetics; Open Food Facts, USDA FoodData Central for food), and the general trend in scientific literature regarding safety, irritation potential, and allergenicity. Prioritize skin compatibility concerns for cosmetics and systemic/digestive/allergy concerns for food.
Return the entire analysis as a single, valid JSON object with a top-level key 'ingredients' (an array of the ingredient JSON objects as described above) . Ensure the ingredient names in the output array match the parsing of the input list. Ensure the entire output is ONLY the valid JSON object requested, with no surrounding text or explanations.`;

      try {
        console.log(
          `Sending ${termsNotInDB.length} terms to Gemini: ${llmQueryTermsString}`
        );
        console.log("Prompt sent to Gemini:\n", prompt); // Log the prompt sent to LL
        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        let rawText = response.text(); // Get raw text from LLM

        // --- ADDED: Clean the LLM response text ---
        console.log("Raw Gemini response received:\n", rawText); // Log before cleaning
        let jsonString = rawText.trim(); // Trim leading/trailing whitespace

        // Regex to find JSON content within ```json ... ``` or just ``` ... ```
        const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);

        if (jsonMatch && jsonMatch[1]) {
          // If fences found, use the content inside them
          jsonString = jsonMatch[1].trim();
          console.log("Extracted JSON string from fences.");
        } else {
          // If no fences, assume the whole trimmed text might be JSON
          console.log("No fences found, attempting to parse trimmed raw text.");
        }
        // --- END OF CLEANING BLOCK ---

        // Attempt to parse the potentially cleaned JSON string
        try {
          llmData = JSON.parse(jsonString); // <-- Parse the CLEANED string
          console.log("Successfully parsed Gemini response.");

          // --- Optional: Save LLM results back to DB ---
          if (
            llmData &&
            llmData.ingredients &&
            Array.isArray(llmData.ingredients)
          ) {
            console.log(
              `Attempting to save ${llmData.ingredients.length} ingredients from LLM to DB...`
            );
            for (const item of llmData.ingredients) {
              try {
                // Basic mapping from LLM structure to Mongoose schema
                const newIngredientData = {
                  name: item.ingredient_name?.toLowerCase().trim(), // Ensure required fields are present
                  display_name:
                    item.ingredient_name ||
                    item.ingredient_name?.toLowerCase().trim(), // Original name from LLM or fallback
                  aliases: item.aliases || [],
                  functions: item.functions || [], // Match schema field name 'functions'
                  health_rating: item.health_rating,
                  rating_rationale: item.rating_rationale,
                  potential_side_effects: item.potential_side_effects || [],
                  source: "LLM",
                  source_details:
                    item.source_details || "Gemini 1.5 Flash analysis", // Update default if needed
                };

                // Add validation before saving - e.g., check if 'name' exists
                if (!newIngredientData.name) {
                  console.warn(
                    "LLM item missing 'ingredient_name', skipping save:",
                    item
                  );
                  continue;
                }
                // Ensure display_name has a value
                if (!newIngredientData.display_name) {
                  newIngredientData.display_name = newIngredientData.name; // Use normalized name as fallback
                }

                // Use findOneAndUpdate with upsert: true to avoid race conditions
                // and duplicates if the item was somehow added between checks.
                await Ingredient.findOneAndUpdate(
                  { name: newIngredientData.name }, // Find by the unique lowercase name
                  { $setOnInsert: newIngredientData }, // Only set these fields if inserting (upserting)
                  { upsert: true, new: false, runValidators: true } // Upsert, don't return new doc, run schema validations
                );
                // console.log(`Saved/Updated ingredient: ${newIngredientData.name}`);
              } catch (saveError) {
                // Log saving errors but don't fail the main request
                console.error(
                  `Failed to save ingredient "${
                    item.ingredient_name || "N/A"
                  }" from LLM:`, // Handle potentially missing name in log
                  saveError.message
                );
                // Handle specific errors like duplicates if upsert wasn't used or validation errors
                if (saveError.code === 11000) {
                  console.warn(
                    `Ingredient "${
                      item.ingredient_name || "N/A"
                    }" likely already exists (duplicate key).`
                  );
                } else if (saveError.name === "ValidationError") {
                  console.warn(
                    `Validation failed for LLM ingredient "${
                      item.ingredient_name || "N/A"
                    }":`,
                    saveError.errors
                  );
                }
              }
            }
            console.log("Finished attempting to save LLM ingredients.");
          }
          // --- End Optional Save ---
        } catch (parseError) {
          // --- UPDATED: Enhanced logging for parse error ---
          console.error("Failed to parse Gemini response as JSON:", parseError);
          console.error("Cleaned string that failed parsing:", jsonString); // Log the string we TRIED to parse
          console.error("Original raw response text:", rawText); // Log original text for reference
          llmData = {
            error: "Failed to parse LLM response.",
            raw_response: rawText,
            attempted_parse_string: jsonString, // Include cleaned string in error response
          };
          // --- END OF UPDATE ---
        }
      } catch (llmError) {
        console.error("Error calling Gemini API:", llmError);
        llmData = {
          error: "Failed to get analysis from LLM.",
          // Provide more context if available from the error object
          details: llmError.message || String(llmError),
        };
        // Decide if the request should fail completely or return partial data
      }
    }

    // --- Format and Send Final Response ---
    res.status(200).json({
      success: true,
      data: {
        dbData: dbData, // Data found in local MongoDB
        llmAnalysis: llmData, // Structured analysis from LLM (or null/error object)
        llmQueryTerms: llmQueryTermsString, // The terms that were sent to the LLM
      },
    });
  } catch (error) {
    // --- General Error Handling ---
    console.error("Error in getIngredientsAndCheckMissing:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing ingredient list.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
            ? error.message // Return error message in development
            : "An unexpected error occurred." // Fallback message
          : "An internal error occurred.", // Generic message in production
    });
  }
};
