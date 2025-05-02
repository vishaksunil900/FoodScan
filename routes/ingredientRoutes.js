const express = require("express");
const {
  createIngredient,
  searchIngredients,
  checkIngredientsExistence,
  getIngredientsAndCheckMissing,
} = require("../controllers/ingredientController"); // Adjust path if needed

const router = express.Router();

router.post("/", createIngredient);

// Example route using the static method
router.get("/search", searchIngredients);
//router.get("/check-existence", checkIngredientsExistence);
router.get("/process-list", getIngredientsAndCheckMissing);

module.exports = router;
