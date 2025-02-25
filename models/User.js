const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  resetPasswordToken: { type: String }, // Stores the reset token
  resetPasswordExpires: { type: Date }, // Expiration time for the token
});

module.exports = mongoose.model("User", userSchema);
