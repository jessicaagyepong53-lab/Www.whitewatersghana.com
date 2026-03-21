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

const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// ============================================
// MONGODB CONNECTION
// ============================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

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

// ============================================
// GENERATE INVOICE PDF
// ============================================
function generateInvoice(order, invoiceNumber) {
  return new Promise((resolve, reject) => {
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
      .text(`Invoice No: WWW${invoiceNumber.toString().padStart(4, "0")}`, 350, 80)
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
    const discountMap = { "weekly": 10, "biweekly": 15, "monthly": 20, "one-time": 0 };
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

    doc.moveTo(50, 320).lineTo(550, 320).stroke();
    doc.fontSize(10)
      .text("SUBTOTAL:", 380, 330).text(`GH₵${subtotal}.00`, 480, 330)
      .text(`DISCOUNT (${discount}%):`, 380, 348).text(`-GH₵${discountAmount}.00`, 480, 348)
      .text("DELIVERY FEE:", 380, 366).text(`GH₵${deliveryFee}.00`, 480, 366);

    doc.moveTo(370, 385).lineTo(550, 385).stroke();
    doc.font("Helvetica-Bold").fontSize(12)
      .text("GRAND TOTAL:", 380, 393)
      .fillColor("#1a6fc4").text(`GH₵${grandTotal}.00`, 480, 393);

    doc.fillColor("#000000").font("Helvetica").fontSize(10)
      .text("Delivery Date:", 50, 330)
      .text(new Date(order.delivery).toDateString(), 50, 345)
      .text("Payment Method:", 50, 363)
      .text(order.paymentMethod || "To be confirmed", 50, 378);

    doc.moveTo(50, 430).lineTo(550, 430).stroke();
    doc.fontSize(9).fillColor("#6b7280")
      .text("Thank you for choosing White Water Wells LTD!", 50, 440, { align: "center", width: 500 })
      .text("Pure. Reliable. Refreshing.", 50, 455, { align: "center", width: 500 });

    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

// ============================================
// SEND INVOICE EMAIL
// ============================================
async function sendInvoiceEmail(order, invoiceNumber, pdfPath) {
  const productNames = {
    "sachet-water": "Sachet Water - 500ml",
    "bulk-purchase": "Sachet Water - Bulk Purchase"
  };

  const mailOptions = {
    from: process.env.EMAIL_USER,
    subject: `Invoice WWW${invoiceNumber.toString().padStart(4, "0")} - White Water Wells LTD`,
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
    attachments: [{ filename: `Invoice-WWW${invoiceNumber.toString().padStart(4, "0")}.pdf`, path: pdfPath }]
  };

  await transporter.sendMail({ ...mailOptions, to: order.email });
  await transporter.sendMail({
    ...mailOptions,
    to: process.env.COMPANY_EMAIL,
    subject: `New Order - Invoice WWW${invoiceNumber.toString().padStart(4, "0")} from ${order.name}`,
    html: mailOptions.html.replace("Thank you for your order", "New order received from")
  });

  fs.unlinkSync(pdfPath);
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
  paymentStatus: { type: String, default: "pending" }
}, { timestamps: true });
const Order = mongoose.model("Order", OrderSchema);

const WaybillSchema = new mongoose.Schema({
  waybillNumber:   String,
  to:              String,
  driverName:      String,
  address:         String,
  carNumber:       String,
  date:            Date,
  quantity:        String,
  description:     String,
  remarks:         String,
  despatchedBy:    String,
  receivedBy:      String,
  driverSignature: String,
  submittedBy:     String,
  amount:          Number
}, { timestamps: true });

// ============================================
// AUTH ROUTES
// ============================================

app.post("/signup", async (req, res) => {
  try {
    const { fullName, email, phone, password, securityQuestion, securityAnswer } = req.body;
    if (!fullName || !email || !password || !securityQuestion || !securityAnswer)
      return res.status(400).json({ message: "Missing required fields" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase(), 10);
    const user = new User({ fullName, email, phone, password: hashed, securityQuestion, securityAnswer: hashedAnswer });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ message: "Account created!", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Missing email or password" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login successful!", token, user: { fullName: user.fullName } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/staff-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Missing email or password" });

    const allowedDomains = ["@whitewatersghana.com", "@supervisor.whitewatersghana.com"];
    const isAllowed = allowedDomains.some(domain => email.endsWith(domain));
    if (!isAllowed)
      return res.status(403).json({ message: "Access denied. Staff emails only." });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Invalid credentials" });

    const role = email.includes("supervisor") ? "supervisor" : "admin";
    const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login successful!", token, user: { fullName: user.fullName, role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/verify-security", async (req, res) => {
  try {
    const { email, securityAnswer, securityQuestion } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "No account found with that email" });

    if (securityAnswer === "check-only")
      return res.json({ message: "User found" });

    if (securityQuestion && user.securityQuestion !== securityQuestion)
      return res.status(401).json({ message: "Incorrect question or answer. Please try again!" });

    const match = await bcrypt.compare(securityAnswer.toLowerCase(), user.securityAnswer);
    if (!match)
      return res.status(401).json({ message: "Incorrect answer. Please try again!" });

    res.json({ message: "Answer verified!", email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res.status(400).json({ message: "Missing required fields" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashed });
    res.json({ message: "Password reset successful!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================
// ORDER ROUTES
// ============================================

app.post("/order", async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();

    const orderCount = await Order.countDocuments();
    const pdfPath = await generateInvoice(req.body, orderCount);
    await sendInvoiceEmail(req.body, orderCount, pdfPath);

    res.status(201).json({ message: "Order placed!", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save order" });
  }
});

app.get("/orders/:email", async (req, res) => {
  try {
    const orders = await Order.find({ email: req.params.email }).sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/order/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/admin/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch("/admin/orders/:id/paid", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: "paid" },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: order.email,
      subject: "Payment Confirmed - White Water Wells LTD",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #16a34a; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Payment Confirmed!</h1>
          </div>
          <div style="padding: 30px; background: #f8faff;">
            <p>Dear ${order.name},</p>
            <p>Your payment has been confirmed by our team.</p>
            <p><strong>Product:</strong> ${order.product}</p>
            <p><strong>Quantity:</strong> ${order.quantity} bag(s)</p>
            <p><strong>Total:</strong> ${order.total}</p>
            <p><strong>Delivery Date:</strong> ${new Date(order.delivery).toDateString()}</p>
            <p style="color: #16a34a; font-weight: 700;">Status: PAID</p>
            <p style="color: #6b7280; font-size: 13px;">Thank you for choosing White Water Wells LTD!</p>
          </div>
          <div style="background: #0f1c2e; padding: 20px; text-align: center; color: rgba(255,255,255,0.6); font-size: 12px;">
            <p>White Water Wells LTD | 0243108878 / 0244483793</p>
          </div>
        </div>
      `
    });

    res.json({ message: "Order marked as paid!", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================
// WAYBILL ROUTES
// ============================================

app.post("/waybill", async (req, res) => {
  try {
    const waybillCount = await Waybill.countDocuments() + 1;
    req.body.waybillNumber = `WWW2026${String(waybillCount).padStart(4, "0")}`;

    const waybill = new Waybill(req.body);
    await waybill.save();

    await transporter.sendMail({
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
              <tr style="background:#fff;"><td style="padding:8px; font-weight:700;">Quantity:</td><td style="padding:8px;">${req.body.quantity}</td></tr>
              <tr><td style="padding:8px; font-weight:700;">Description:</td><td style="padding:8px;">${req.body.description}</td></tr>
              <tr style="background:#fff;"><td style="padding:8px; font-weight:700;">Remarks:</td><td style="padding:8px;">${req.body.remarks || "N/A"}</td></tr>
              <tr><td style="padding:8px; font-weight:700;">Despatched By:</td><td style="padding:8px;">${req.body.despatchedBy}</td></tr>
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
    });

    res.json({ message: "Waybill submitted successfully!", waybill });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit waybill" });
  }
});

app.get("/waybills", async (req, res) => {
  try {
    const waybills = await Waybill.find().sort({ createdAt: -1 });
    res.json({ waybills });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/waybills/count", async (req, res) => {
  try {
    const count = await Waybill.countDocuments();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
// GET /admin/analytics/custom-waybills
app.get("/admin/analytics/custom-waybills", async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59);

    const waybills = await Waybill.find({
      createdAt: { $gte: fromDate, $lte: toDate }
    });

    const total = waybills.reduce((sum, w) => sum + (w.amount || 0), 0);
    res.json({ total, count: waybills.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(5000, () => console.log("Server running on port 5000"));