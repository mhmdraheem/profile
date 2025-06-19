const express = require("express");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const csrf = require("csurf");
const cookieParser = require("cookie-parser");
const validator = require("validator");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PROFILE_APP_PORT || 3000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "https://kit.fontawesome.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    errors: ["تم تجاوز الحد المسموح من المحاولات. يرجى المحاولة لاحقاً."],
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to form submission
app.use("/submit-form", limiter);

// Body parsing middleware
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// Serve static files
app.use(express.static("."));

// CSRF protection
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail address
    pass: process.env.GMAIL_APP_PASSWORD, // Your Gmail App Password (not regular password)
  },
});

// Input validation and sanitization function
function validateAndSanitizeInput(name, email, message) {
  const errors = [];

  // Validate name
  if (!name || typeof name !== "string") {
    errors.push("الاسم مطلوب");
  } else if (name.trim().length < 2 || name.trim().length > 100) {
    errors.push("الاسم يجب أن يكون بين 2 و 100 حرف");
  } else if (!/^[\u0600-\u06FFa-zA-Z\s]+$/.test(name.trim())) {
    errors.push("الاسم يجب أن يحتوي على أحرف عربية أو إنجليزية فقط");
  }

  // Validate email
  if (!email || typeof email !== "string") {
    errors.push("البريد الإلكتروني مطلوب");
  } else if (!validator.isEmail(email)) {
    errors.push("البريد الإلكتروني غير صحيح");
  } else if (email.length > 254) {
    errors.push("البريد الإلكتروني طويل جداً");
  }

  // Validate message
  if (!message || typeof message !== "string") {
    errors.push("الرسالة مطلوبة");
  } else if (message.trim().length < 10 || message.trim().length > 1000) {
    errors.push("الرسالة يجب أن تكون بين 10 و 1000 حرف");
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      name: name ? validator.escape(name.trim()) : "",
      email: email ? validator.normalizeEmail(email.trim()) : "",
      message: message ? validator.escape(message.trim()) : "",
    },
  };
}

// Route to get CSRF token
app.get("/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
  // throw new Error();
});

// Form submission endpoint
app.post("/submit-form", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Validate and sanitize input
    const validation = validateAndSanitizeInput(name, email, message);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const { name: sanitizedName, email: sanitizedEmail, message: sanitizedMessage } = validation.sanitizedData;

    // Email configuration
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER, // Send to yourself
      subject: `رسالة جديدة من موقعك الشخصي - ${sanitizedName}`,
      html: `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
          <h2>رسالة جديدة من موقعك الشخصي</h2>
          <p><strong>الاسم:</strong> ${sanitizedName}</p>
          <p><strong>البريد الإلكتروني:</strong> ${sanitizedEmail}</p>
          <p><strong>الرسالة:</strong></p>
          <div style="background-color: #f5f5f5; padding: 15px; border-right: 4px solid #007bff; margin: 10px 0;">
            ${sanitizedMessage.replace(/\n/g, "<br>")}
          </div>
          <hr>
          <p style="color: #666; font-size: 12px;">
            تم إرسال هذه الرسالة من موقعك الشخصي في ${new Date().toLocaleString("ar-EG")}
          </p>
        </div>
      `,
      replyTo: sanitizedEmail,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: "تم إرسال رسالتك بنجاح! سأتواصل معك قريباً.",
    });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء إرسال الرسالة. يرجى المحاولة لاحقاً.",
    });
  }
});

app.use(express.static(path.join(__dirname, "public")));

// Error handling middleware
app.use((error, req, res, next) => {
  if (error.code === "EBADCSRFTOKEN") {
    res.status(403).json({
      success: false,
      message: "رمز الأمان غير صحيح. يرجى تحديث الصفحة والمحاولة مرة أخرى.",
    });
  } else {
    res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
