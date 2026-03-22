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

const STAFF_LOGIN_PROFILES = {
  "gardiner9wwwl@whitewaterghana": { role: "admin", username: "Gardiner Admin 9" },
  "gardiner11wwwl@whitewaterghana": { role: "admin", username: "Gardiner Admin 11" },
  "supervisorb@whitewaterghana.com": { role: "supervisor", username: "Supervisor B" }
};

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

    // Rows 2–5 (empty)
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

// ============================================
// AUTH ROUTES
// ============================================

app.post("/signup", async (req, res) => {
  try {
    const { fullName, email, phone, password, securityQuestion, securityAnswer } = req.body;
    if (!fullName || !email || !password || !securityQuestion || !securityAnswer)
      return res.status(400).json({ message: "Missing required fields" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ message: "Invalid email format" });

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ message: "Invalid email format" });

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

    const loginId = String(email || "").trim().toLowerCase();
    const profile = STAFF_LOGIN_PROFILES[loginId];

    if (!profile) {
      return res.status(403).json({ message: "Access denied. This staff login ID is not approved." });
    }

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Invalid credentials" });

    const role = profile.role;
    const displayUsername = profile.username;

    const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login successful!", token, user: { fullName: displayUsername, role } });
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
    const invoiceNumber = await generateWwwNumber("invoice");
    const order = new Order({ ...req.body, invoiceNumber });
    await order.save();
    res.status(201).json({ message: "Order placed!", order });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save order" });
  }
});

app.patch("/order/:id/payment", async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const isCash = paymentMethod === "Cash on Delivery";

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        paymentMethod: paymentMethod || "To be confirmed",
        paymentStatus: isCash ? "pending" : "paid"
      },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!isCash) {
      triggerPaidOrderEmails(order).catch(err => console.error("Paid-order email error:", err));
    }

    res.json({ message: "Payment updated", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
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

    triggerPaidOrderEmails(order).catch(err => console.error("Paid-order email error:", err));

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
    req.body.waybillNumber = await generateWwwNumber("waybill");
    req.body.emailSent = false;
    req.body.emailSentAt = null;

    const waybill = new Waybill(req.body);
    await waybill.save();

    // Send email in background — don't block the response
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
              <tr><td colspan="2" style="padding:0;"><table style="width:100%; border-collapse:collapse; font-size:13px;"><thead><tr style="background:#dbeafe;"><th style="padding:8px; text-align:left;">S/N</th><th style="padding:8px; text-align:left;">Quantity</th><th style="padding:8px; text-align:left;">Description</th><th style="padding:8px; text-align:left;">Remarks</th></tr></thead><tbody>${(req.body.items||[]).filter(it=>it.quantity||it.description).map((it,i)=>`<tr style="background:${i%2===0?'#fff':'#f8faff'};"><td style="padding:8px;">${i+1}</td><td style="padding:8px;">${it.quantity||''}</td><td style="padding:8px;">${it.description||''}</td><td style="padding:8px;">${it.remarks||''}</td></tr>`).join('')}</tbody></table></td></tr>
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
    }).catch(err => {
      console.error(`Waybill email FAILED for ${req.body.waybillNumber}:`, err.message);
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
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const counter = await Counter.findOne({ key: `waybill-${yyyy}` });
    const nextSeq = String((counter?.seq || 0) + 1).padStart(2, "0");
    const nextNumber = `WWW${yyyy}${mm}${dd}${nextSeq}`;
    res.json({ count: counter?.seq || 0, nextNumber });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

function parseMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const numeric = parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfWeek(d) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return startOfDay(monday);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1);
}

function endOfYear(d) {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

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
    waybills: {
      total: waybillTotal,
      count: sentWaybills.length
    },
    grandTotal: onlinePaidTotal + waybillTotal
  };
}

function growthMeta(current, previous) {
  const diff = current - previous;
  const pct = previous > 0 ? (diff / previous) * 100 : (current > 0 ? 100 : 0);
  return {
    change: diff,
    changePct: Number(pct.toFixed(1)),
    trend: diff >= 0 ? "profit" : "loss"
  };
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
    today,
    week,
    month,
    year,
    lastWeek,
    lastMonth,
    lastYear,
    monthlyData,
    trends: {
      today: growthMeta(today.grandTotal, lastWeek.grandTotal),
      week: growthMeta(week.grandTotal, lastWeek.grandTotal),
      month: growthMeta(month.grandTotal, lastMonth.grandTotal),
      year: growthMeta(year.grandTotal, lastYear.grandTotal)
    }
  };
}

app.get("/admin/analytics", async (req, res) => {
  try {
    const payload = await buildAnalyticsPayload();
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/admin/profits", async (req, res) => {
  try {
    const payload = await buildAnalyticsPayload();
    res.json(payload);
  } catch (err) {
    console.error(err);
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
app.listen(5000, () => {
  console.log("Server running on port 5000");
  transporter.verify((err, success) => {
    if (err) {
      console.error("EMAIL TRANSPORTER ERROR - credentials may be wrong:", err.message);
    } else {
      console.log("Email transporter ready. Sending from:", process.env.EMAIL_USER, "-> Company:", process.env.COMPANY_EMAIL);
    }
  });
});