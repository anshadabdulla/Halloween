const mongoose = require("mongoose");

const supportSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    category: { type: String, required: true, trim: true }, // Added category field
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Pending", "In Progress", "Resolved"], default: "Pending" },
    userResponse: { type: String, default: "", trim: true }, // Stores user's response/message
    adminResponse: { type: String, default: "", trim: true }, // Stores admin's response
}, { timestamps: true }); // Automatically adds createdAt & updatedAt fields

const Support = mongoose.model("Support", supportSchema);

module.exports = Support;
