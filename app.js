const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const hbs = require("hbs"); // Import hbs to register helpers
const app = express();
const routes = require("./routes/index");
const mongoose = require("mongoose");

// Register Handlebars helper "eq" for comparing values
hbs.registerHelper("eq", (a, b) => a === b);

// Middleware for parsing JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Configure session middleware (must be set before mounting routes)
app.use(session({
  secret: "yourSecretKey", // Replace with a secure secret for production
  resave: false,
  saveUninitialized: false
}));

// Set Handlebars as the view engine and define the views directory
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Mount routes from the routes/index.js file
app.use("/", routes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
