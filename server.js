require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

// ============================================
// REQUIRED ENV VAR CHECK (fail fast, not with a mystery 500 later)
// ============================================
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET", "EMAIL_USER", "EMAIL_PASS", "COMPANY_EMAIL"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`FATAL: missing required environment variable(s): ${missingEnv.join(", ")}`);
  process.exit(1);
}

// ============================================
// CORS
// ============================================
// Comma-separated list of allowed origins, e.g.
//   CORS_ORIGINS=https://www.whitewatersghana.com,https://whitewatersghana.com
// Falls back to "*" only if nothing is configured, with a loud warning —
// tighten this in production.
const configuredOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (!configuredOrigins.length) {
  console.warn("WARNING: CORS_ORIGINS is not set — allowing all origins ('*'). Set CORS_ORIGINS in production.");
}

app.use(cors({
  origin: configuredOrigins.length
    ? (origin, callback) => {
        if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    : "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// ============================================
// ASYNC HANDLER + APP ERROR (central error-handling helpers)
// ============================================
// Wrap every async route with this so thrown/rejected errors are forwarded
// to the global error handler instead of crashing the process or hanging
// the request.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

// ============================================
// MONGODB CONNECTION (with retry + connection event logging)
// ============================================
mongoose.set("strictQuery", true);

async function connectDB(retries = 5, delayMs = 5000) {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    if (retries > 0) {
      console.log(`Retrying MongoDB connection in ${delayMs / 1000}s... (${retries} attempt(s) left)`);
      setTimeout(() => connectDB(retries - 1, delayMs), delayMs);
    } else {
      console.error("FATAL: could not connect to MongoDB after multiple attempts.");
    }
  }
}
connectDB();

mongoose.connection.on("error", (err) => console.error("MongoDB runtime error:", err.message));
mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected — will not auto-reconnect until restart."));

// ============================================
// EMAIL TRANSPORTER
// ============================================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const STAFF_LOGIN_PROFILES = {
  "ceo9@whitewaterghana.com": { role: "admin", username: "CEO 9" },
  "manager25@whitewaterghana.com": { role: "admin", username: "Manager 25" },
  "supervisor1@whitewaterghana.com": { role: "supervisor", username: "Supervisor 1" }
};

// ============================================
// AUTH MIDDLEWARE (replaces trusted x-staff-role / x-user-email headers)
// ============================================
// Every protected route now reads its identity from a verified JWT instead
// of a client-supplied header, which a browser user could set to anything.
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new AppError("Missing or malformed Authorization header", 401));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      const message = err.name === "TokenExpiredError" ? "Session expired, please log in again" : "Invalid or expired token";
      return next(new AppError(message, 401));
    }
    req.user = decoded; // { id, email, role }
    next();
  });
}

// Optional auth: attaches req.user if a valid token is present, but never
// blocks the request. Useful for routes usable by both guests and logged-in
// customers (e.g. placing an order).
function attachUserIfPresent(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (!err) req.user = decoded;
      next();
    });
  } else {
    next();
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError("Authentication required", 401));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to perform this action", 403));
    }
    next();
  };
}

const requireAdmin = [authenticate, authorize("admin")];
const requireStaff = [authenticate, authorize("admin", "supervisor")];

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ============================================
// GENERATE INVOICE PDF
// ============================================
function generateInvoice(order, invoiceNumber) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filePath = path.join(__dirname, `invoice-${invoiceNumber}.pdf`);
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(20).font("Helvetica-Bold").text("WHITE WATER WELLS LTD", 50, 50);
      doc.fontSize(28).fillColor("#1a6fc4").text("INVOICE", 450, 50);
      doc.fillColor("#000000");

      doc.fontSize(10).font("Helvetica")
        .text("Comm 25 Peace B Down, Accra-Prampram Road", 50, 80)
        .text("P.O. Box 18204, Accra", 50, 95)
        .text("GPS: GN-0709-4736", 50, 110)
        .text("0243108878 / 0244483793", 50, 125);

      const date = new Date().toDateString();
      doc.fontSize(10)
        .text(`Invoice No: ${invoiceNumber}`, 350, 80)
        .text(`Date: ${date}`, 350, 95)
        .text(`Due Date: ${date}`, 350, 110);

      doc.moveTo(50, 145).lineTo(550, 145).stroke();

      doc.fontSize(12).font("Helvetica-Bold").text("BILL TO:", 50, 160);
      doc.fontSize(10).font("Helvetica")
        .text(order.name, 50, 178)
        .text(`${order.streetAddress || ""}, ${order.district || ""}, ${order.region || ""}`, 50, 193)
        .text(`Phone: ${order.phone}`, 50, 208)
        .text(`Email: ${order.email}`, 50, 223);

      doc.rect(50, 250, 500, 25).fill("#1a6fc4");
      doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold")
        .text("S/N", 55, 258)
        .text("PRODUCT DESCRIPTION", 90, 258)
        .text("QTY", 350, 258)
        .text("UNIT PRICE", 400, 258)
        .text("TOTAL", 480, 258);

      doc.fillColor("#000000").font("Helvetica").fontSize(10);
      const productNames = {
        "sachet-water": "Sachet Water - 500ml",
        "bulk-purchase": "Sachet Water - Bulk Purchase"
      };
      const productName = productNames[order.product] || order.product;
      const unitPrice = 7;
      const subtotal = unitPrice * order.quantity;
      const discountMap = { weekly: 10, biweekly: 15, monthly: 20, "one-time": 0 };
      const discount = discountMap[order.orderType] || 0;
      const discountAmount = (subtotal * discount) / 100;
      const deliveryFee = 100;
      const grandTotal = subtotal - discountAmount + deliveryFee;

      doc.rect(50, 275, 500, 25).fill("#f8faff");
      doc.fillColor("#000000")
        .text("1", 55, 283)
        .text(productName, 90, 283)
        .text(order.quantity.toString(), 350, 283)
        .text(`GH₵${unitPrice}.00`, 400, 283)
        .text(`GH₵${subtotal}.00`, 480, 283);

      for (let i = 2; i <= 5; i++) {
        const y = 275 + (i - 1) * 22;
        if (i % 2 === 0) doc.rect(50, y, 500, 22).fill("#ffffff");
        else doc.rect(50, y, 500, 22).fill("#f8faff");
        doc.fillColor("#000000").text(String(i), 55, y + 6);
      }
      const tableBottom = 275 + 5 * 22;

      doc.moveTo(50, tableBottom).lineTo(550, tableBottom).stroke();
      doc.fontSize(10)
        .text("SUBTOTAL:", 380, tableBottom + 10).text(`GH₵${subtotal}.00`, 480, tableBottom + 10)
        .text(`DISCOUNT (${discount}%):`, 380, tableBottom + 28).text(`-GH₵${discountAmount}.00`, 480, tableBottom + 28)
        .text("DELIVERY FEE:", 380, tableBottom + 46).text(`GH₵${deliveryFee}.00`, 480, tableBottom + 46);

      doc.moveTo(370, tableBottom + 65).lineTo(550, tableBottom + 65).stroke();
      doc.font("Helvetica-Bold").fontSize(12)
        .text("GRAND TOTAL:", 380, tableBottom + 73)
        .fillColor("#1a6fc4").text(`GH₵${grandTotal}.00`, 480, tableBottom + 73);

      doc.fillColor("#000000").font("Helvetica").fontSize(10)
        .text("Delivery Date:", 50, tableBottom + 10)
        .text(new Date(order.delivery).toDateString(), 50, tableBottom + 25)
        .text("Payment Method:", 50, tableBottom + 43)
        .text(order.paymentMethod || "To be confirmed", 50, tableBottom + 58);

      doc.moveTo(50, tableBottom + 110).lineTo(550, tableBottom + 110).stroke();
      doc.fontSize(9).fillColor("#6b7280")
        .text("Thank you for choosing White Water Wells LTD!", 50, tableBottom + 120, { align: "center", width: 500 })
        .text("Pure. Reliable. Refreshing.", 50, tableBottom + 135, { align: "center", width: 500 });

      doc.end();
      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================
// EMAIL HELPERS (each wrapped so a mail failure never throws upstream)
// ============================================
async function sendInvoiceEmail(order, invoiceNumber, pdfPath) {
  const productNames = {
    "sachet-water": "Sachet Water - 500ml",
    "bulk-purchase": "Sachet Water - Bulk Purchase"
  };

  const mailOptions = {
    from: process.env.EMAIL_USER,
    subject: `Invoice ${invoiceNumber} - White Water Wells LTD`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a6fc4; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">White Water Wells LTD</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 5px 0;">Pure. Reliable. Refreshing.</p>
        </div>
        <div style="padding: 30px; background: #f8faff;">
          <h2>Thank you for your order, ${order.name}!</h2>
          <p>Please find your invoice attached. Here is a summary of your order:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #1a6fc4; color: white;">
              <th style="padding: 10px; text-align: left;">Product</th>
              <th style="padding: 10px; text-align: left;">Quantity</th>
              <th style="padding: 10px; text-align: left;">Total</th>
            </tr>
            <tr style="background: white;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${productNames[order.product] || order.product}</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.quantity} bag(s)</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.total || "N/A"}</td>
            </tr>
          </table>
          <p><strong>Delivery Date:</strong> ${new Date(order.delivery).toDateString()}</p>
          <p><strong>Delivery Address:</strong> ${order.streetAddress}, ${order.district}, ${order.region}</p>
          <p><strong>Payment Method:</strong> ${order.paymentMethod || "To be confirmed"}</p>
          <p style="color: #6b7280; font-size: 13px;">We will contact you to confirm your order and arrange payment.</p>
        </div>
        <div style="background: #0f1c2e; padding: 20px; text-align: center; color: rgba(255,255,255,0.6); font-size: 12px;">
          <p>White Water Wells LTD | Comm 25 Peace B Down, Accra</p>
          <p>0243108878 / 0244483793 | whitewaterwellscompanyltd@gmail.com</p>
        </div>
      </div>
    `,
    attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, path: pdfPath }]
  };

  await transporter.sendMail({ ...mailOptions, to: order.email });
  await transporter.sendMail({
    ...mailOptions,
    to: process.env.COMPANY_EMAIL,
    subject: `New Order - Invoice ${invoiceNumber} from ${order.name}`,
    html: mailOptions.html.replace("Thank you for your order", "New order received from")
  });

  if (fs.existsSync(pdfPath)) {
    fs.unlinkSync(pdfPath);
  }
}

function getInvoiceNumberFromOrder(order) {
  return order?.invoiceNumber || "WWW-UNKNOWN";
}

async function sendPaidOrderConfirmationEmail(order) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: order.email,
    subject: "Order Confirmed & Paid - White Water Wells LTD",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #16a34a; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Order Confirmed & Paid</h1>
        </div>
        <div style="padding: 30px; background: #f8faff;">
          <p>Dear ${order.name},</p>
          <p>Your order has been confirmed and payment has been received.</p>
          <p><strong>Product:</strong> ${order.product}</p>
          <p><strong>Quantity:</strong> ${order.quantity} bag(s)</p>
          <p><strong>Total:</strong> ${order.total || "N/A"}</p>
          <p><strong>Delivery Date:</strong> ${new Date(order.delivery).toDateString()}</p>
          <p style="color: #16a34a; font-weight: 700;">Status: PAID</p>
        </div>
      </div>
    `
  });
}

async function sendCompanyWaybillNoticeForPaidOrder(order) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.COMPANY_EMAIL,
    subject: `Waybill Preparation Needed - Paid Order ${order.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #0a3d7a; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Paid Order Ready for Waybill</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 5px 0;">White Water Wells LTD</p>
        </div>
        <div style="padding: 24px; background: #f8faff;">
          <p>A customer order has been confirmed and paid. Please prepare delivery waybill.</p>
          <table style="width:100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding:8px; font-weight:700; width:40%;">Customer:</td><td style="padding:8px;">${order.name}</td></tr>
            <tr style="background:#fff;"><td style="padding:8px; font-weight:700;">Phone:</td><td style="padding:8px;">${order.phone}</td></tr>
            <tr><td style="padding:8px; font-weight:700;">Address:</td><td style="padding:8px;">${order.streetAddress || ""}, ${order.district || ""}, ${order.region || ""}</td></tr>
            <tr style="background:#fff;"><td style="padding:8px; font-weight:700;">Product:</td><td style="padding:8px;">${order.product}</td></tr>
            <tr><td style="padding:8px; font-weight:700;">Quantity:</td><td style="padding:8px;">${order.quantity} bag(s)</td></tr>
            <tr style="background:#fff;"><td style="padding:8px; font-weight:700;">Delivery Date:</td><td style="padding:8px;">${new Date(order.delivery).toDateString()}</td></tr>
            <tr><td style="padding:8px; font-weight:700;">Total:</td><td style="padding:8px;">${order.total || "N/A"}</td></tr>
          </table>
        </div>
      </div>
    `
  });
}

async function triggerPaidOrderEmails(order) {
  if (!order || order.paymentStatus !== "paid") return;
  if (order.notificationSent) return;

  const invoiceNumber = getInvoiceNumberFromOrder(order);
  const pdfPath = await generateInvoice(order, invoiceNumber);

  await Promise.all([
    sendPaidOrderConfirmationEmail(order),
    sendInvoiceEmail(order, invoiceNumber, pdfPath),
    sendCompanyWaybillNoticeForPaidOrder(order)
  ]);

  await Order.findByIdAndUpdate(order._id, {
    notificationSent: true,
    notificationSentAt: new Date()
  });
}

// ============================================
// MODELS
// ============================================
const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  phone:    { type: String },
  password: { type: String, required: true },
  securityQuestion: { type: String },
  securityAnswer:   { type: String }
});
const User = mongoose.model("User", UserSchema);

// Order status timeline — customer-facing tracking.
const ORDER_STATUSES = ["received", "confirmed", "processing", "out_for_delivery", "delivered", "cancelled"];

const OrderSchema = new mongoose.Schema({
  name:          String,
  phone:         String,
  email:         String,
  region:        String,
  district:      String,
  streetAddress: String,
  product:       String,
  quantity:      Number,
  orderType:     String,
  delivery:      Date,
  timeSlot:      String,
  instructions:  String,
  total:         String,
  paymentMethod: String,
  transactionId: String,
  invoiceNumber:   String,
  paymentStatus: { type: String, default: "pending" },
  status: { type: String, enum: ORDER_STATUSES, default: "received" },
  statusHistory: [{
    status: { type: String, enum: ORDER_STATUSES },
    note: String,
    changedAt: { type: Date, default: Date.now }
  }],
  notificationSent: { type: Boolean, default: false },
  notificationSentAt: Date
}, { timestamps: true });
const Order = mongoose.model("Order", OrderSchema);

const WaybillSchema = new mongoose.Schema({
  waybillNumber:   String,
  to:              String,
  driverName:      String,
  address:         String,
  carNumber:       String,
  date:            Date,
  items:           [{ quantity: String, description: String, remarks: String }],
  quantity:        String,
  description:     String,
  remarks:         String,
  despatchedBy:    String,
  receivedBy:      String,
  driverSignature: String,
  submittedBy:     String,
  amount:          Number,
  emailSent:       { type: Boolean, default: false },
  emailSentAt:     Date
}, { timestamps: true });
const Waybill = mongoose.model("Waybill", WaybillSchema);

const CounterSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model("Counter", CounterSchema);

async function generateWwwNumber(type) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const result = await Counter.findOneAndUpdate(
    { key: `${type}-${yyyy}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const seq = String(result.seq).padStart(2, "0");
  return `WWW${yyyy}${mm}${dd}${seq}`;
}

// Small helper for consistent pagination query parsing.
function parsePagination(req, defaultLimit = 20, maxLimit = 100) {
  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, skip: (page - 1) * limit };
}

// ============================================
// AUTH ROUTES
// ============================================
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/signup", asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, securityQuestion, securityAnswer } = req.body;
  if (!fullName || !email || !password || !securityQuestion || !securityAnswer) {
    throw new AppError("Missing required fields", 400);
  }
  if (!EMAIL_REGEX.test(email)) throw new AppError("Invalid email format", 400);
  if (String(password).length < 8) throw new AppError("Password must be at least 8 characters", 400);

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError("Email already registered", 409);

  const hashed = await bcrypt.hash(password, 10);
  const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase(), 10);
  const user = new User({
    fullName,
    email: email.toLowerCase(),
    phone,
    password: hashed,
    securityQuestion,
    securityAnswer: hashedAnswer
  });
  await user.save();

  const token = jwt.sign({ id: user._id, email: user.email, role: "customer" }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({ message: "Account created!", token });
}));

app.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError("Missing email or password", 400);
  if (!EMAIL_REGEX.test(email)) throw new AppError("Invalid email format", 400);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError("Invalid credentials", 401);

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new AppError("Invalid credentials", 401);

  const token = jwt.sign({ id: user._id, email: user.email, role: "customer" }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ message: "Login successful!", token, user: { fullName: user.fullName, email: user.email } });
}));

app.post("/staff-login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError("Missing email or password", 400);

  const loginId = String(email || "").trim().toLowerCase();
  const profile = STAFF_LOGIN_PROFILES[loginId];
  if (!profile) throw new AppError("Access denied. This staff login ID is not approved.", 403);

  const user = await User.findOne({ email: loginId });
  if (!user) throw new AppError("Invalid credentials", 401);

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new AppError("Invalid credentials", 401);

  const { role, username: displayUsername } = profile;
  const token = jwt.sign({ id: user._id, email: loginId, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ message: "Login successful!", token, user: { fullName: displayUsername, role } });
}));

app.post("/verify-security", asyncHandler(async (req, res) => {
  const { email, securityAnswer, securityQuestion } = req.body;
  if (!email) throw new AppError("Email is required", 400);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError("No account found with that email", 404);

  if (securityAnswer === "check-only") {
    return res.json({ message: "User found" });
  }
  if (!securityAnswer) throw new AppError("Security answer is required", 400);

  if (securityQuestion && user.securityQuestion !== securityQuestion) {
    throw new AppError("Incorrect question or answer. Please try again!", 401);
  }

  const match = await bcrypt.compare(securityAnswer.toLowerCase(), user.securityAnswer);
  if (!match) throw new AppError("Incorrect answer. Please try again!", 401);

  res.json({ message: "Answer verified!", email });
}));

app.post("/reset-password", asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) throw new AppError("Missing required fields", 400);
  if (String(newPassword).length < 8) throw new AppError("Password must be at least 8 characters", 400);

  const hashed = await bcrypt.hash(newPassword, 10);
  const updated = await User.findOneAndUpdate({ email: email.toLowerCase() }, { password: hashed });
  if (!updated) throw new AppError("No account found with that email", 404);

  res.json({ message: "Password reset successful!" });
}));

// ============================================
// ORDER ROUTES
// ============================================

// Placing an order stays open to guests, but if the request carries a valid
// customer token we tag the order with that account automatically.
const VALID_PRODUCTS = ["sachet-water", "bulk-purchase"];
const VALID_ORDER_TYPES = ["one-time", "weekly", "biweekly", "monthly"];
const MAX_ORDER_QUANTITY = 100000;

app.post("/order", attachUserIfPresent, asyncHandler(async (req, res) => {
  const required = ["name", "phone", "email", "region", "district", "streetAddress", "product", "quantity", "delivery", "timeSlot"];
  const missing = required.filter((field) => !req.body[field]);
  if (missing.length) throw new AppError(`Missing required field(s): ${missing.join(", ")}`, 400);

  const { email, product, quantity, orderType, delivery } = req.body;

  if (!EMAIL_REGEX.test(email)) {
    throw new AppError("Please provide a valid email address", 400);
  }

  if (!VALID_PRODUCTS.includes(product)) {
    throw new AppError(`Product must be one of: ${VALID_PRODUCTS.join(", ")}`, 400);
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_ORDER_QUANTITY) {
    throw new AppError(`Quantity must be a whole number between 1 and ${MAX_ORDER_QUANTITY}`, 400);
  }

  if (orderType && !VALID_ORDER_TYPES.includes(orderType)) {
    throw new AppError(`Order type must be one of: ${VALID_ORDER_TYPES.join(", ")}`, 400);
  }

  const deliveryDate = new Date(delivery);
  if (Number.isNaN(deliveryDate.getTime())) {
    throw new AppError("Please provide a valid delivery date", 400);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (deliveryDate < today) {
    throw new AppError("Delivery date cannot be in the past", 400);
  }

  const invoiceNumber = await generateWwwNumber("invoice");

  // Compute the total server-side rather than trusting the client-supplied
  // value, using the same pricing rules as the PDF invoice generator, so a
  // tampered request can't set an arbitrary order total.
  const unitPrice = 7;
  const discountMap = { weekly: 10, biweekly: 15, monthly: 20, "one-time": 0 };
  const subtotal = unitPrice * qty;
  const discountPct = discountMap[orderType] || 0;
  const discountAmount = (subtotal * discountPct) / 100;
  const deliveryFee = 100;
  const grandTotal = subtotal - discountAmount + deliveryFee;

  const order = new Order({
    ...req.body,
    quantity: qty,
    total: `GH₵${grandTotal.toFixed(2)}`,
    invoiceNumber,
    status: "received",
    statusHistory: [{ status: "received", note: "Order placed by customer" }]
  });
  await order.save();
  res.status(201).json({ message: "Order placed!", order });
}));

app.patch("/order/:id/payment", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError("Invalid order ID", 400);

  const { paymentMethod, transactionId } = req.body;
  const allowedMethods = ["MTN Mobile Money", "Vodafone Cash", "AirtelTigo Money", "Card Payment", "Cash on Delivery"];
  if (paymentMethod && !allowedMethods.includes(paymentMethod)) {
    throw new AppError("Unrecognized payment method", 400);
  }
  const isCash = paymentMethod === "Cash on Delivery";

  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);

  order.paymentMethod = paymentMethod || "To be confirmed";
  order.transactionId = transactionId || order.transactionId;
  order.paymentStatus = isCash ? "pending" : "paid";
  if (!isCash) {
    order.status = "confirmed";
    order.statusHistory.push({ status: "confirmed", note: `Payment received via ${paymentMethod}` });
  }
  await order.save();

  if (!isCash) {
    triggerPaidOrderEmails(order).catch((err) => console.error("Paid-order email error:", err.message));
  }

  res.json({ message: "Payment updated", order });
}));

// A customer can only see their own orders unless they're staff/admin.
app.get("/orders/:email", authenticate, asyncHandler(async (req, res) => {
  const requestedEmail = String(req.params.email || "").trim().toLowerCase();
  const isOwner = req.user.email === requestedEmail;
  const isStaff = ["admin", "supervisor"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("You can only view your own orders", 403);

  const { page, limit, skip } = parsePagination(req);
  const [orders, total] = await Promise.all([
    Order.find({ email: requestedEmail }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments({ email: requestedEmail })
  ]);

  res.json({ orders, page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
}));

app.delete("/orders/:id", authenticate, asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError("Invalid order ID", 400);

  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);

  const isOwner = req.user.email === String(order.email || "").trim().toLowerCase();
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) throw new AppError("You can only delete your own orders", 403);

  await Order.findByIdAndDelete(req.params.id);
  res.json({ message: "Order deleted successfully" });
}));

app.get("/order/:id", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError("Invalid order ID", 400);
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);
  res.json({ order });
}));

// ---- Order status / tracking timeline ----
app.get("/order/:id/status", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError("Invalid order ID", 400);
  const order = await Order.findById(req.params.id).select("status statusHistory paymentStatus invoiceNumber");
  if (!order) throw new AppError("Order not found", 404);
  res.json({
    status: order.status,
    paymentStatus: order.paymentStatus,
    invoiceNumber: order.invoiceNumber,
    timeline: order.statusHistory
  });
}));

app.patch("/admin/orders/:id/status", ...requireStaff, asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError("Invalid order ID", 400);
  const { status, note } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    throw new AppError(`Status must be one of: ${ORDER_STATUSES.join(", ")}`, 400);
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);

  order.status = status;
  order.statusHistory.push({ status, note: note || `Status updated by ${req.user.email}` });
  await order.save();

  res.json({ message: "Order status updated", order });
}));

// ---- Admin order management ----
app.get("/admin/orders", ...requireAdmin, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req);
  const filter = {};
  if (req.query.view === "pending") filter.paymentStatus = { $ne: "paid" };
  if (req.query.view === "paid") { filter.paymentStatus = "paid"; filter.paymentMethod = { $ne: "Cash on Delivery" }; }
  if (req.query.view === "cash") filter.paymentMethod = "Cash on Delivery";

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter)
  ]);

  res.json({ orders, page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
}));

app.patch("/admin/orders/:id/paid", ...requireAdmin, asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError("Invalid order ID", 400);
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);

  order.paymentStatus = "paid";
  order.status = "confirmed";
  order.statusHistory.push({ status: "confirmed", note: `Marked paid by ${req.user.email}` });
  await order.save();

  triggerPaidOrderEmails(order).catch((err) => console.error("Paid-order email error:", err.message));

  res.json({ message: "Order marked as paid!", order });
}));

app.delete("/admin/orders/:id", ...requireAdmin, asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError("Invalid order ID", 400);
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) throw new AppError("Order not found", 404);
  res.json({ message: "Order deleted successfully" });
}));

// ============================================
// WAYBILL ROUTES (supervisor or admin)
// ============================================

app.post("/waybill", ...requireStaff, asyncHandler(async (req, res) => {
  const required = ["to", "driverName", "address", "carNumber", "date", "despatchedBy"];
  const missing = required.filter((field) => !req.body[field]);
  if (missing.length) throw new AppError(`Missing required field(s): ${missing.join(", ")}`, 400);

  const waybillDate = new Date(req.body.date);
  if (Number.isNaN(waybillDate.getTime())) {
    throw new AppError("Please provide a valid date", 400);
  }

  if (req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== "") {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new AppError("Amount must be a valid non-negative number", 400);
    }
    req.body.amount = amount;
  }

  req.body.waybillNumber = await generateWwwNumber("waybill");
  req.body.emailSent = false;
  req.body.emailSentAt = null;
  req.body.submittedBy = req.body.submittedBy || req.user.email;

  const waybill = new Waybill(req.body);
  await waybill.save();

  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.COMPANY_EMAIL,
    subject: `New Waybill ${req.body.waybillNumber} - White Water Wells LTD`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #0a3d7a; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">White Water Wells LTD</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 5px 0;">Waybill Notification</p>
        </div>
        <div style="padding: 30px; background: #f8faff;">
          <h2 style="border-bottom: 2px solid #dbeafe; padding-bottom: 10px;">Waybill No: ${req.body.waybillNumber}</h2>
          <table style="width:100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding:8px; font-weight:700; width:40%;">To:</td><td style="padding:8px;">${req.body.to}</td></tr>
            <tr style="background:#fff;"><td style="padding:8px; font-weight:700;">Driver's Name:</td><td style="padding:8px;">${req.body.driverName}</td></tr>
            <tr><td style="padding:8px; font-weight:700;">Address:</td><td style="padding:8px;">${req.body.address}</td></tr>
            <tr style="background:#fff;"><td style="padding:8px; font-weight:700;">Car Number:</td><td style="padding:8px;">${req.body.carNumber}</td></tr>
            <tr><td style="padding:8px; font-weight:700;">Date:</td><td style="padding:8px;">${req.body.date}</td></tr>
            <tr style="background:#fff;"><td colspan="2" style="padding:8px; font-weight:700;">Items:</td></tr>
            <tr><td colspan="2" style="padding:0;"><table style="width:100%; border-collapse:collapse; font-size:13px;"><thead><tr style="background:#dbeafe;"><th style="padding:8px; text-align:left;">S/N</th><th style="padding:8px; text-align:left;">Quantity</th><th style="padding:8px; text-align:left;">Description</th><th style="padding:8px; text-align:left;">Remarks</th></tr></thead><tbody>${(req.body.items || []).filter((it) => it.quantity || it.description).map((it, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8faff"};"><td style="padding:8px;">${i + 1}</td><td style="padding:8px;">${it.quantity || ""}</td><td style="padding:8px;">${it.description || ""}</td><td style="padding:8px;">${it.remarks || ""}</td></tr>`).join("")}</tbody></table></td></tr>
            <tr style="background:#fff;"><td style="padding:8px; font-weight:700;">Despatched By:</td><td style="padding:8px;">${req.body.despatchedBy}</td></tr>
            <tr style="background:#fff;"><td style="padding:8px; font-weight:700;">Received By:</td><td style="padding:8px;">${req.body.receivedBy || "N/A"}</td></tr>
            <tr><td style="padding:8px; font-weight:700;">Driver's Signature:</td><td style="padding:8px;">${req.body.driverSignature || "N/A"}</td></tr>
            <tr style="background:#fff;"><td style="padding:8px; font-weight:700;">Submitted By:</td><td style="padding:8px;">${req.body.submittedBy}</td></tr>
          </table>
        </div>
        <div style="background: #0f1c2e; padding: 20px; text-align: center; color: rgba(255,255,255,0.6); font-size: 12px;">
          <p>White Water Wells LTD | Comm 25 Peace B Down, Accra</p>
        </div>
      </div>
    `
  }).then(async () => {
    waybill.emailSent = true;
    waybill.emailSentAt = new Date();
    await waybill.save();
    console.log(`Waybill email sent for ${req.body.waybillNumber} to ${process.env.COMPANY_EMAIL}`);
  }).catch((err) => {
    console.error(`Waybill email FAILED for ${req.body.waybillNumber}:`, err.message);
  });

  res.json({ message: "Waybill submitted successfully!", waybill });
}));

app.get("/waybills", ...requireStaff, asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req);
  const filter = {};
  if (req.query.date) {
    const day = new Date(req.query.date);
    if (Number.isNaN(day.getTime())) throw new AppError("Invalid date filter", 400);
    filter.date = { $gte: startOfDay(day), $lte: endOfDay(day) };
  }

  const [waybills, total] = await Promise.all([
    Waybill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Waybill.countDocuments(filter)
  ]);

  res.json({ waybills, page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
}));

app.delete("/admin/waybills/:id", ...requireAdmin, asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError("Invalid waybill ID", 400);
  const waybill = await Waybill.findByIdAndDelete(req.params.id);
  if (!waybill) throw new AppError("Waybill not found", 404);
  res.json({ message: "Waybill deleted successfully" });
}));

app.get("/waybills/count", ...requireStaff, asyncHandler(async (req, res) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const counter = await Counter.findOne({ key: `waybill-${yyyy}` });
  const nextSeq = String((counter?.seq || 0) + 1).padStart(2, "0");
  const nextNumber = `WWW${yyyy}${mm}${dd}${nextSeq}`;
  res.json({ count: counter?.seq || 0, nextNumber });
}));

// ============================================
// PAYMENT WEBHOOK SCAFFOLD (MTN MoMo / provider callbacks)
// ============================================
// NOTE: this is infrastructure, not a finished integration — wiring it up
// for real requires signing up with a MoMo/Vodafone Cash aggregator (e.g.
// MTN MoMo API, Hubtel, Paystack Mobile Money) and putting their webhook
// secret in MOMO_WEBHOOK_SECRET. The endpoint verifies the payload
// signature, looks the order up by transaction ID, and marks it paid
// automatically instead of relying on the customer typing in a transaction
// ID that staff have to manually cross-check.
app.post("/webhooks/momo", express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }), asyncHandler(async (req, res) => {
  const secret = process.env.MOMO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("MOMO_WEBHOOK_SECRET not configured — rejecting webhook call.");
    throw new AppError("Payment webhook not configured", 501);
  }

  const signature = req.headers["x-momo-signature"];
  if (!signature) throw new AppError("Missing webhook signature", 401);

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody || Buffer.from(JSON.stringify(req.body)))
    .digest("hex");

  const valid = signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!valid) throw new AppError("Invalid webhook signature", 401);

  const { transactionId, status } = req.body;
  if (!transactionId) throw new AppError("Missing transactionId in webhook payload", 400);

  const order = await Order.findOne({ transactionId });
  if (!order) throw new AppError("No matching order for this transaction", 404);

  if (status === "SUCCESSFUL" && order.paymentStatus !== "paid") {
    order.paymentStatus = "paid";
    order.status = "confirmed";
    order.statusHistory.push({ status: "confirmed", note: "Payment auto-confirmed via provider webhook" });
    await order.save();
    triggerPaidOrderEmails(order).catch((err) => console.error("Paid-order email error:", err.message));
  }

  res.json({ received: true });
}));

// ============================================
// ANALYTICS HELPERS
// ============================================
function parseMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const numeric = parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function endOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
function startOfWeek(d) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return startOfDay(monday);
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function startOfYear(d) { return new Date(d.getFullYear(), 0, 1); }
function endOfYear(d) { return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999); }

async function computePeriodStats(from, to) {
  const [paidOrders, pendingOrders, sentWaybills] = await Promise.all([
    Order.find({ createdAt: { $gte: from, $lte: to }, paymentStatus: "paid" }),
    Order.find({ createdAt: { $gte: from, $lte: to }, paymentStatus: { $ne: "paid" } }),
    Waybill.find({ createdAt: { $gte: from, $lte: to }, emailSent: true })
  ]);

  const onlinePaidTotal = paidOrders.reduce((sum, o) => sum + parseMoney(o.total), 0);
  const onlinePendingTotal = pendingOrders.reduce((sum, o) => sum + parseMoney(o.total), 0);
  const waybillTotal = sentWaybills.reduce((sum, w) => sum + parseMoney(w.amount), 0);

  return {
    online: {
      paid: onlinePaidTotal,
      paidCount: paidOrders.length,
      pending: onlinePendingTotal,
      pendingCount: pendingOrders.length
    },
    waybills: { total: waybillTotal, count: sentWaybills.length },
    grandTotal: onlinePaidTotal + waybillTotal
  };
}

function growthMeta(current, previous) {
  const diff = current - previous;
  const pct = previous > 0 ? (diff / previous) * 100 : (current > 0 ? 100 : 0);
  return { change: diff, changePct: Number(pct.toFixed(1)), trend: diff >= 0 ? "profit" : "loss" };
}

async function buildAnalyticsPayload() {
  const now = new Date();

  const todayFrom = startOfDay(now);
  const todayTo = endOfDay(now);
  const weekFrom = startOfWeek(now);
  const weekTo = endOfDay(now);
  const monthFrom = startOfMonth(now);
  const monthTo = endOfDay(now);
  const yearFrom = startOfYear(now);
  const yearTo = endOfDay(now);

  const lastWeekTo = new Date(weekFrom.getTime() - 1);
  const lastWeekFrom = startOfWeek(lastWeekTo);

  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthFrom = startOfMonth(prevMonthDate);
  const lastMonthTo = endOfMonth(prevMonthDate);

  const prevYearDate = new Date(now.getFullYear() - 1, 0, 1);
  const lastYearFrom = startOfYear(prevYearDate);
  const lastYearTo = endOfYear(prevYearDate);

  const [today, week, month, year, lastWeek, lastMonth, lastYear] = await Promise.all([
    computePeriodStats(todayFrom, todayTo),
    computePeriodStats(weekFrom, weekTo),
    computePeriodStats(monthFrom, monthTo),
    computePeriodStats(yearFrom, yearTo),
    computePeriodStats(lastWeekFrom, lastWeekTo),
    computePeriodStats(lastMonthFrom, lastMonthTo),
    computePeriodStats(lastYearFrom, lastYearTo)
  ]);

  const monthlyData = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = startOfMonth(d);
    const to = endOfMonth(d);
    const stats = await computePeriodStats(from, to);
    monthlyData.push({
      month: d.toLocaleString("default", { month: "short" }),
      orders: Number(stats.online.paid.toFixed(2)),
      waybills: Number(stats.waybills.total.toFixed(2)),
      total: Number(stats.grandTotal.toFixed(2))
    });
  }

  return {
    today, week, month, year, lastWeek, lastMonth, lastYear, monthlyData,
    trends: {
      today: growthMeta(today.grandTotal, lastWeek.grandTotal),
      week: growthMeta(week.grandTotal, lastWeek.grandTotal),
      month: growthMeta(month.grandTotal, lastMonth.grandTotal),
      year: growthMeta(year.grandTotal, lastYear.grandTotal)
    }
  };
}

app.get("/admin/analytics", ...requireAdmin, asyncHandler(async (req, res) => {
  const payload = await buildAnalyticsPayload();
  res.json(payload);
}));

app.get("/admin/profits", ...requireAdmin, asyncHandler(async (req, res) => {
  const payload = await buildAnalyticsPayload();
  res.json(payload);
}));

app.get("/admin/analytics/custom", ...requireAdmin, asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) throw new AppError("Both 'from' and 'to' query params are required", 400);

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new AppError("Invalid 'from' or 'to' date", 400);
  }
  toDate.setHours(23, 59, 59, 999);

  const paidOrders = await Order.find({
    createdAt: { $gte: fromDate, $lte: toDate },
    paymentStatus: "paid"
  });
  const total = paidOrders.reduce((sum, o) => sum + parseMoney(o.total), 0);
  res.json({ total, count: paidOrders.length });
}));

app.get("/admin/analytics/custom-waybills", ...requireAdmin, asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) throw new AppError("Both 'from' and 'to' query params are required", 400);

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new AppError("Invalid 'from' or 'to' date", 400);
  }
  toDate.setHours(23, 59, 59, 999);

  const waybills = await Waybill.find({ createdAt: { $gte: fromDate, $lte: toDate } });
  const total = waybills.reduce((sum, w) => sum + (w.amount || 0), 0);
  res.json({ total, count: waybills.length });
}));

// ============================================
// HEALTH CHECK (useful for Render / uptime monitors)
// ============================================
app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.status(dbState === 1 ? 200 : 503).json({
    status: dbState === 1 ? "ok" : "degraded",
    db: ["disconnected", "connected", "connecting", "disconnecting"][dbState] || "unknown"
  });
});

// ============================================
// 404 HANDLER (for unmatched routes)
// ============================================
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ============================================
// GLOBAL ERROR HANDLER (must be registered last)
// ============================================
app.use((err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.isOperational ? err.message : "Server error";

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  } else if (err.code === 11000) {
    statusCode = 409;
    message = "A record with that value already exists";
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(", ");
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Session expired, please log in again";
  }

  if (statusCode >= 500) {
    console.error("Unhandled error:", err);
  } else {
    console.warn(`Handled error (${statusCode}):`, err.message);
  }

  res.status(statusCode).json({ message });
});

// ============================================
// PROCESS-LEVEL SAFETY NETS
// ============================================
// These don't replace the try/catch and asyncHandler patterns above — they
// exist so that any truly unexpected failure gets logged instead of
// silently killing the process or leaving it in a broken state.
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED PROMISE REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  // Exit so the process manager (Render, PM2, etc.) restarts us into a
  // known-good state rather than continuing in an undefined one.
  process.exit(1);
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  transporter.verify((err) => {
    if (err) {
      console.error("EMAIL TRANSPORTER ERROR - credentials may be wrong:", err.message);
    } else {
      console.log("Email transporter ready. Sending from:", process.env.EMAIL_USER, "-> Company:", process.env.COMPANY_EMAIL);
    }
  });
});