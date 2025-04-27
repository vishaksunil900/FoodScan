// routes/ingredientRoutes.js
const express = require("express");
const {
  createIngredient,
  searchIngredients, // Import other controller functions if you add them
} = require("../controllers/ingredientController"); // Adjust path if needed

const router = express.Router();

router.post("/", createIngredient);

// Example route using the static method
router.get("/search", searchIngredients);

module.exports = router;
