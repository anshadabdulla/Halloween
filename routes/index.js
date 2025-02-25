require("dotenv").config(); // Load environment variables
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require("express-session");
const crypto = require("crypto"); // For generating reset tokens
const User = require("../models/User"); // Import User model
const Booking = require("../models/Booking"); // Import Booking model
const { Subscriber, subscribeUser } = require("../models/Newsletter"); // import Newsletter for Subscribe
const Support = require("../models/Support"); // Import the Support model
const nodemailer = require("nodemailer"); // For sending emails

// Connect to MongoDB using environment variable
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

const db = mongoose.connection;
db.on("error", console.error.bind(console, "Connection error:"));
db.once("open", () => {
  console.log(`Connected to MongoDB `);
});

// Nodemailer setup for sending emails securely
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Load email from .env
    pass: process.env.EMAIL_PASS, // Load password from .env
  },
});

// =======================
// NEWSLETTER SUBSCRIPTION ROUTE
// =======================
// POST: Subscribe to the Newsletter
router.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if email already exists
    const existingSubscriber = await Subscriber.findOne({ email });
    if (existingSubscriber) {
      return res.redirect(`/error?message=${encodeURIComponent("You are already subscribed!")}`);
    }

    // Save new subscriber
    const newSubscriber = new Subscriber({ email });
    await newSubscriber.save();

// Send confirmation email
const mailOptions = {
  to: email,
  from: "mindvibe.learning@gmail.com",
  subject: "🎃 Welcome to the Spooky Club! 👻",
  text: `
🎃 Welcome to the Spooky Club! 👻

Thank you for subscribing to our newsletter! 🕷️💀 
You're now part of an exclusive circle that gets the spookiest deals, eerie exclusives, and chilling surprises before anyone else.

👀 What’s coming your way?
🕸️ Hauntingly good discounts
🎁 Ghostly giveaways
🧛 Wickedly exclusive treats
🎃 Limited-time specials

Stay tuned—our first spooky surprise is creeping into your inbox soon!

Happy Haunting,  
🦇 The Spooky Team ✨  

Keep an eye on your inbox... you never know what might be lurking! 👀💀
`
};

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error("Error sending confirmation email:", err);
        return res.redirect(`/error?message=${encodeURIComponent("Subscription successful, but email failed!")}`);
      }
      res.redirect("/subscription-success"); // Redirect to a success page
    });
  } catch (err) {
    console.error("Error subscribing to newsletter:", err);
    res.redirect(`/error?message=${encodeURIComponent("Internal server error")}`);
  }
});

// Function to send emails
async function sendEmail({ to, subject, text }) {
  try {
    await transporter.sendMail({
      from: "MindVibe Support <mindvibe.learning@gmail.com>",
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error("Error sending email:", err);
  }
}

// -------------------- SUPPORT REQUEST SYSTEM --------------------

// User Submits Support Request
router.post("/support", async (req, res) => {
  try {
    let { name, email, category, message } = req.body;
    name = name.trim();
    email = email.trim();
    category = category.trim();
    message = message.trim();

    if (!name || !email || !category || !message) {
      return res.status(400).send("All fields are required.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).send("Invalid email format.");
    }

    const newRequest = new Support({
      name,
      email,
      category,
      message,
      status: "Pending",
      createdAt: new Date(),
    });

    await newRequest.save();

    await sendEmail({
      to: email,
      subject: "Support Request Received",
      text: `Hi ${name},\n\nWe have received your support request regarding "${category}". Our team will get back to you shortly. Please note that the current status of your request is "Pending".\n\nBest regards,\nMindVibe Support Team`,
    });

    res.redirect("/support-success");
  } catch (err) {
    console.error("❌ Error submitting support request:", err);
    res.status(500).send("Internal server error.");
  }
});

// Admin Updates Support Request Status
router.post("/admin/support/:id/status", async (req, res) => {
  try {
    const requestId = req.params.id;
    const { status } = req.body;

    if (!["Pending", "In Progress", "Resolved"].includes(status)) {
      return res.status(400).send("Invalid status.");
    }

    const supportRequest = await Support.findByIdAndUpdate(requestId, { status }, { new: true });

    if (!supportRequest) {
      return res.status(404).send("Support request not found.");
    }

    // Send email notification to user when status changes
    await sendEmail({
      to: supportRequest.email,
      subject: `Your Support Request Status Updated to "${status}"`,
      text: `Hi ${supportRequest.name},\n\nYour support request has been updated to "${status}". If you have any further questions or need assistance, please do not hesitate to contact us.\n\nBest regards,\nMindVibe Support Team`,
    });

    res.redirect("/adminsupport");
  } catch (err) {
    console.error("❌ Error updating support request status:", err);
    res.status(500).send("Internal server error.");
  }
});

// Admin Responds to Support Request
router.post("/admin/support/:id/respond", async (req, res) => {
  try {
    const requestId = req.params.id;
    const { response } = req.body; // Corrected field name

    if (!response || response.trim() === "") {
      return res.status(400).send("Response message is required.");
    }

    const supportRequest = await Support.findById(requestId);

    if (!supportRequest) {
      return res.status(404).send("Support request not found.");
    }

    // Update the support request with the admin's response
    supportRequest.adminResponse = response;
    supportRequest.status = "Resolved"; // Auto-set to Resolved when admin responds
    await supportRequest.save();

    // Send email notification to user
    await sendEmail({
      to: supportRequest.email,
      subject: "Your Support Request has been Responded to",
      text: `Hi ${supportRequest.name},\n\nYour support request has been responded to by our admin.\n\nResponse: ${response}\n\nBest regards,\nMindVibe Support Team`,
    });

    res.redirect("/adminsupport");
  } catch (err) {
    console.error("❌ Error responding to support request:", err);
    res.status(500).send("Internal server error.");
  }
});

// -------------------- ADMIN PANEL --------------------

// Admin Support Page: Display support requests
router.get("/adminsupport", async (req, res) => {
  try {
    const requests = await Support.find();
    res.render("adminsupport", { requests });
  } catch (err) {
    console.error("Error fetching support requests:", err);
    res.status(500).send("Error fetching support requests.");
  }
});

// Admin Login (with session)
router.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  

  if (email === adminEmail && password === adminPassword) {
    req.session.admin = true;
    return res.redirect("/admindashboard");
  } else {
    return res.render("adminlogin", { error: "Invalid admin credentials." });
  }
});

// Admin Dashboard Route
router.get("/admindashboard", async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.render("admindashboard", { bookings });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).send("Error fetching bookings.");
  }
});

// =======================
// GENERAL ROUTES
// =======================

// Start with login page
router.get("/", (req, res) => {
  res.render("index", { error: null });
});

// Login page
router.get("/index", (req, res) => {
  res.render("index", { error: null });
});

// Signup page
router.get("/signup", (req, res) => {
  res.render("signup");
});

// Book Now page
router.get("/booknow", (req, res) => {
  res.render("booknow");
});
// subscription-success
router.get("/subscription-success", (req, res) => {
  res.render("subscription-success");
});
//views/support-success
router.get("/support-success", (req, res) => {
  res.render("support-success");
});
// GET: Render the support page
router.get("/support", (req, res) => {
  res.render("support");
});
//logout
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error logging out:", err);
      return res.redirect(`/error?message=${encodeURIComponent("Logout failed. Try again!")}`);
    }
    res.redirect("/index"); // Redirect to login page
  });
});


// adminsupport

router.get("/adminsupport", async (req, res) => { 
  try {
    const requests = await Support.find(); // Fetch all support requests
    res.render("adminsupport", { requests });
  } catch (err) {
    console.error("Error fetching support requests:", err);
    res.status(500).send("Error fetching support requests.");
  }
});



// Track Record page - fetch booking details from DB
router.get("/trackrecord", async (req, res) => {
  try {
    // Optionally, filter by email if provided (e.g., after a booking)
    const email = req.query.email;
    const bookings = await Booking.find(email ? { email } : {});
    res.render("trackrecord", { bookings });
  } catch (error) {
    console.error("Error fetching booking records:", error);
    res.status(500).send("Error fetching booking records.");
  }
});

// Home page
router.get("/home", (req, res) => {
  res.render("home");
});

// Success page
router.get("/success1", (req, res) => {
  const { firstName } = req.query;
  res.render("success1", { firstName });
});

// Error page
router.get("/error", (req, res) => {
  const { message } = req.query;
  res.render("error", { message });
});

// =======================
// PASSWORD RESET ROUTES
// =======================

// Forgot Password Page
router.get("/forgotpassword", (req, res) => {
  res.render("forgotpassword", { error: null, success: null });
});

// Reset Password Page
router.get("/resetpassword/:token", async (req, res) => {
  try {
    const users = await User.find({ resetPasswordExpires: { $gt: Date.now() } });

    if (!users.length) {
      return res.render("error", { message: "Invalid or expired reset token!" });
    }

    let matchedUser = null;
    for (const user of users) {
      if (await bcrypt.compare(req.params.token, user.resetPasswordToken)) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      return res.render("error", { message: "Invalid or expired reset token!" });
    }

    res.render("resetpassword", { token: req.params.token });
  } catch (err) {
    console.error("Error loading reset password page:", err);
    res.render("error", { message: "Internal server error" });
  }
});

// Forgot Password - Handle Reset Link Generation
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("forgotpassword", { error: "User does not exist!", success: null });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiration
    await user.save();

    // Email setup
    const resetLink = `http://localhost:3000/resetpassword/${resetToken}`;
    const mailOptions = {
      to: user.email,
      from: "mindvibe.learning@gmail.com",
      subject: "Password Reset Request",
      text: `You requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nThis link will expire in 1 hour.`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error("Error sending email:", err);
        return res.render("forgotpassword", { error: "Failed to send email!", success: null });
      }
      res.render("forgotpassword", { error: null, success: "Password reset link sent to your email!" });
    });
  } catch (err) {
    console.error("Error during forgot password:", err);
    res.render("forgotpassword", { error: "Internal server error", success: null });
  }
});

// Reset Password - Handle Password Update
router.post("/resetpassword/:token", async (req, res) => {
  try {
    const { password, confirm_password } = req.body;

    if (password !== confirm_password) {
      return res.render("resetpassword", { token: req.params.token, error: "Passwords do not match!" });
    }

    const users = await User.find({ resetPasswordExpires: { $gt: Date.now() } });

    if (!users.length) {
      return res.render("error", { message: "Invalid or expired reset token!" });
    }

    let matchedUser = null;
    for (const user of users) {
      if (await bcrypt.compare(req.params.token, user.resetPasswordToken)) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      return res.render("error", { message: "Invalid or expired reset token!" });
    }

    // Hash new password
    matchedUser.password = await bcrypt.hash(password, 10);
    matchedUser.resetPasswordToken = undefined;
    matchedUser.resetPasswordExpires = undefined;
    await matchedUser.save();

    res.redirect("/index"); // Redirect to login page
  } catch (err) {
    console.error("Error during password reset:", err);
    res.render("error", { message: "Internal server error" });
  }
});

// =======================
// AUTHENTICATION ROUTES
// =======================

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { first_name, last_name, email, password, confirm_password } = req.body;

    if (password !== confirm_password) {
      return res.redirect(`/error?message=${encodeURIComponent("Passwords do not match!")}`);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.redirect(`/error?message=${encodeURIComponent("User already exists!")}`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName: first_name,
      lastName: last_name,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    res.redirect(`/success1?firstName=${encodeURIComponent(first_name)}`);
  } catch (err) {
    console.error("Error during signup:", err);
    res.redirect(`/error?message=${encodeURIComponent("Internal server error")}`);
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) {
      return res.redirect(`/error?message=${encodeURIComponent("Enter a valid email address!")}`);
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.redirect(`/error?message=${encodeURIComponent("User does not exist!")}`);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.redirect(`/error?message=${encodeURIComponent("Wrong password!")}`);
    }

    res.render("success", { firstName: user.firstName });
  } catch (err) {
    console.error("Error during login:", err);
    res.redirect(`/error?message=${encodeURIComponent("Internal server error")}`);
  }
});

// =======================
// BOOKING ROUTES
// =======================

// POST: Handle booking submission from booknow.hbs
router.post("/book", async (req, res) => {
  try {
    const { name, email, date, guests } = req.body;

    // Create a new booking record with default status "pending"
    const booking = new Booking({
      name,
      email,
      bookingDate: date,
      guests,
      status: "pending"
    });

    await booking.save();

    // Redirect to the track record page; here we pass email as query parameter
    res.redirect("/trackrecord?email=" + encodeURIComponent(email));
  } catch (error) {
    console.error("Error processing booking:", error);
    res.status(500).send("There was an error processing your booking.");
  }
});

// =======================
// ADMIN DASHBOARD ROUTES
// =======================

// GET: Render the admin dashboard with all bookings
router.get("/admindashboard", async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.render("admindashboard", { bookings });
  } catch (error) {
    console.error("Error fetching bookings for admin dashboard:", error);
    res.status(500).send("Error fetching bookings.");
  }
});

// POST: Update booking status (admin action)
// Updated route to include the /admin prefix so that it matches the POST URL
router.post("/admin/booking/:id/status", async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { status } = req.body;
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).send("Invalid status");
    }
    await Booking.findByIdAndUpdate(bookingId, { status });
    res.redirect("/admindashboard");
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).send("Error updating booking status");
  }
});

// =======================
// ADMIN LOGIN ROUTES
// =======================

// GET: Render the admin login page
router.get("/adminlogin", (req, res) => {
  res.render("adminlogin", { error: null });
});

// POST: Handle admin login using hardcoded credentials (demo only)
router.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  //  admin credentials 
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  

  if (email === adminEmail && password === adminPassword) {
    // Set a session flag for admin (ensure session middleware is configured in your main app)
    req.session.admin = true;
    return res.redirect("/admindashboard");
  } else {
    return res.render("adminlogin", { error: "Invalid admin credentials." });
  }
});

module.exports = router;
