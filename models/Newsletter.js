const mongoose = require("mongoose");

// Define the subscriber schema
const subscriberSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    subscribedAt: {
        type: Date,
        default: Date.now
    }
});

// Create the model
const Subscriber = mongoose.model("Subscriber", subscriberSchema);

// Function to handle subscriptions
async function subscribeUser(email) {
    try {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return { success: false, message: "Please enter a valid email address." };
        }

        // Check if the email already exists
        const existingSubscriber = await Subscriber.findOne({ email });
        if (existingSubscriber) {
            return { success: false, message: "You are already subscribed!" };
        }

        // Save the new subscriber
        const newSubscriber = new Subscriber({ email });
        await newSubscriber.save();

        return { success: true, message: "Subscription successful! Thank you for subscribing." };
    } catch (error) {
        console.error("Subscription error:", error);
        return { success: false, message: "Internal Server Error. Please try again later." };
    }
}

module.exports = { Subscriber, subscribeUser };
