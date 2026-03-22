"use strict";

const request = require("supertest");

// ============================================================
// Mocks – must be set up before requiring the app.
// Variables referenced inside jest.mock() factories MUST be
// prefixed with "mock" (Jest hoisting requirement).
// ============================================================

jest.mock("dotenv", () => ({ config: jest.fn() }));

// ---- mongoose mock ----
// Static method stubs shared across all "model" instances
const mockUserFindOne        = jest.fn();
const mockUserFindOneAndUpdate = jest.fn();
const mockOrderFind          = jest.fn();
const mockOrderFindById      = jest.fn();
const mockOrderFindByIdAndUpdate = jest.fn();
const mockOrderCountDocuments = jest.fn();
const mockWaybillFind        = jest.fn();
const mockWaybillCountDocuments = jest.fn();

jest.mock("mongoose", () => {
  function mockUserModel(data) {
    return Object.assign(
      { _id: "user123", fullName: "Test User", email: "test@example.com",
        password: "hashedpassword", securityQuestion: "Pet name?",
        securityAnswer: "hashedanswer" },
      data,
      { save: jest.fn().mockResolvedValue(true) }
    );
  }
  mockUserModel.findOne        = mockUserFindOne;
  mockUserModel.findOneAndUpdate = mockUserFindOneAndUpdate;

  function mockOrderModel(data) {
    return Object.assign(
      { _id: "order123", name: "Test User", email: "test@example.com",
        product: "sachet-water", quantity: 5, orderType: "weekly",
        paymentStatus: "pending", total: "GH₵135.00" },
      data,
      { save: jest.fn().mockResolvedValue(true) }
    );
  }
  mockOrderModel.find              = mockOrderFind;
  mockOrderModel.findById          = mockOrderFindById;
  mockOrderModel.findByIdAndUpdate = mockOrderFindByIdAndUpdate;
  mockOrderModel.countDocuments    = mockOrderCountDocuments;

  function mockWaybillModel(data) {
    return Object.assign(
      { _id: "waybill123", waybillNumber: "WWW20260001" },
      data,
      { save: jest.fn().mockResolvedValue(true) }
    );
  }
  mockWaybillModel.find           = mockWaybillFind;
  mockWaybillModel.countDocuments = mockWaybillCountDocuments;

  return {
    connect: jest.fn().mockResolvedValue(true),
    Schema: jest.fn().mockImplementation(function () {}),
    model: jest.fn().mockImplementation((name) => {
      if (name === "User")    return mockUserModel;
      if (name === "Order")   return mockOrderModel;
      if (name === "Waybill") return mockWaybillModel;
    })
  };
});

// ---- bcryptjs mock ----
jest.mock("bcryptjs", () => ({
  hash:    jest.fn().mockResolvedValue("hashedvalue"),
  compare: jest.fn()
}));

// ---- jsonwebtoken mock ----
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mock.jwt.token")
}));

// ---- nodemailer mock ----
const mockSendMail = jest.fn().mockResolvedValue({ messageId: "test" });
jest.mock("nodemailer", () => ({
  createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail })
}));

// ---- pdfkit mock (all methods return `this` for chaining) ----
jest.mock("pdfkit", () => {
  return jest.fn().mockImplementation(() => {
    const self = {};
    ["pipe","fontSize","font","text","fillColor","rect","fill",
     "moveTo","lineTo","stroke"].forEach(m => { self[m] = jest.fn().mockReturnValue(self); });
    self.end = jest.fn();
    return self;
  });
});

// ---- fs mock – each createWriteStream call returns a fresh EventEmitter ----
jest.mock("fs", () => ({
  createWriteStream: jest.fn().mockImplementation(() => {
    const { EventEmitter } = require("events");
    return new EventEmitter();
  }),
  unlinkSync: jest.fn()
}));

// ============================================================
// Import app AFTER all mocks are in place
// ============================================================
const { app, generateInvoice } = require("../server");
const bcrypt = require("bcryptjs");
const fs = require("fs");

// Helper: make the most-recently created stream emit "finish"
function resolveStream() {
  const results = fs.createWriteStream.mock.results;
  const stream = results[results.length - 1].value;
  setImmediate(() => stream.emit("finish"));
}

// Convenience: a sample user document returned by mocks
const mockUserDoc = {
  _id: "user123",
  fullName: "Test User",
  email: "test@example.com",
  securityQuestion: "Pet name?",
  securityAnswer: "hashedanswer"
};

const mockOrderDoc = {
  _id: "order123",
  name: "Test User",
  email: "test@example.com",
  product: "sachet-water",
  quantity: 5,
  orderType: "weekly",
  paymentStatus: "pending",
  total: "GH₵135.00",
  delivery: new Date("2026-04-01")
};

const mockWaybillDoc = {
  _id: "waybill123",
  waybillNumber: "WWW20260001",
  amount: 500
};

// ============================================================
// AUTH ROUTES
// ============================================================

describe("POST /signup", () => {
  beforeEach(() => {
    mockUserFindOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashedvalue");
  });

  it("returns 201 and token on successful signup", async () => {
    const res = await request(app).post("/signup").send({
      fullName: "Alice",
      email: "alice@example.com",
      phone: "0200000001",
      password: "secret",
      securityQuestion: "Pet name?",
      securityAnswer: "Buddy"
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Account created!");
    expect(res.body.token).toBe("mock.jwt.token");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app).post("/signup").send({
      email: "alice@example.com",
      password: "secret"
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Missing required fields/i);
  });

  it("returns 409 when email is already registered", async () => {
    mockUserFindOne.mockResolvedValue(mockUserDoc);
    const res = await request(app).post("/signup").send({
      fullName: "Alice",
      email: "alice@example.com",
      phone: "0200000001",
      password: "secret",
      securityQuestion: "Pet name?",
      securityAnswer: "Buddy"
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered/i);
  });
});

describe("POST /login", () => {
  it("returns 400 when credentials are missing", async () => {
    const res = await request(app).post("/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Missing/i);
  });

  it("returns 401 when user is not found", async () => {
    mockUserFindOne.mockResolvedValue(null);
    const res = await request(app).post("/login").send({
      email: "nobody@example.com",
      password: "pass"
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid credentials/i);
  });

  it("returns 401 when password does not match", async () => {
    mockUserFindOne.mockResolvedValue(mockUserDoc);
    bcrypt.compare.mockResolvedValue(false);
    const res = await request(app).post("/login").send({
      email: "test@example.com",
      password: "wrongpass"
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid credentials/i);
  });

  it("returns 200 with token on successful login", async () => {
    mockUserFindOne.mockResolvedValue(mockUserDoc);
    bcrypt.compare.mockResolvedValue(true);
    const res = await request(app).post("/login").send({
      email: "test@example.com",
      password: "correctpass"
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Login successful!");
    expect(res.body.token).toBe("mock.jwt.token");
    expect(res.body.user.fullName).toBe(mockUserDoc.fullName);
  });
});

describe("POST /staff-login", () => {
  it("returns 400 when credentials are missing", async () => {
    const res = await request(app).post("/staff-login").send({});
    expect(res.status).toBe(400);
  });

  it("returns 403 for non-staff email domain", async () => {
    const res = await request(app).post("/staff-login").send({
      email: "user@gmail.com",
      password: "pass"
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Access denied/i);
  });

  it("returns 401 when staff user is not found", async () => {
    mockUserFindOne.mockResolvedValue(null);
    const res = await request(app).post("/staff-login").send({
      email: "admin@whitewatersghana.com",
      password: "pass"
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when staff password does not match", async () => {
    mockUserFindOne.mockResolvedValue(mockUserDoc);
    bcrypt.compare.mockResolvedValue(false);
    const res = await request(app).post("/staff-login").send({
      email: "admin@whitewatersghana.com",
      password: "wrong"
    });
    expect(res.status).toBe(401);
  });

  it("returns 200 with role=admin for admin email", async () => {
    mockUserFindOne.mockResolvedValue(mockUserDoc);
    bcrypt.compare.mockResolvedValue(true);
    const res = await request(app).post("/staff-login").send({
      email: "admin@whitewatersghana.com",
      password: "correct"
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("admin");
    expect(res.body.token).toBe("mock.jwt.token");
  });

  it("returns 200 with role=supervisor for supervisor email", async () => {
    mockUserFindOne.mockResolvedValue(mockUserDoc);
    bcrypt.compare.mockResolvedValue(true);
    const res = await request(app).post("/staff-login").send({
      email: "jane@supervisor.whitewatersghana.com",
      password: "correct"
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("supervisor");
  });
});

describe("POST /verify-security", () => {
  it("returns 404 when user is not found", async () => {
    mockUserFindOne.mockResolvedValue(null);
    const res = await request(app).post("/verify-security").send({
      email: "nobody@example.com",
      securityAnswer: "answer"
    });
    expect(res.status).toBe(404);
  });

  it("returns 200 for check-only mode", async () => {
    mockUserFindOne.mockResolvedValue(mockUserDoc);
    const res = await request(app).post("/verify-security").send({
      email: "test@example.com",
      securityAnswer: "check-only"
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User found");
  });

  it("returns 401 when security question does not match", async () => {
    mockUserFindOne.mockResolvedValue(mockUserDoc);
    const res = await request(app).post("/verify-security").send({
      email: "test@example.com",
      securityQuestion: "Wrong question?",
      securityAnswer: "someAnswer"
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Incorrect question or answer/i);
  });

  it("returns 401 when security answer does not match", async () => {
    mockUserFindOne.mockResolvedValue(mockUserDoc);
    bcrypt.compare.mockResolvedValue(false);
    const res = await request(app).post("/verify-security").send({
      email: "test@example.com",
      securityQuestion: "Pet name?",
      securityAnswer: "wrongAnswer"
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Incorrect answer/i);
  });

  it("returns 200 when security answer is verified", async () => {
    mockUserFindOne.mockResolvedValue(mockUserDoc);
    bcrypt.compare.mockResolvedValue(true);
    const res = await request(app).post("/verify-security").send({
      email: "test@example.com",
      securityQuestion: "Pet name?",
      securityAnswer: "Buddy"
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Answer verified!");
    expect(res.body.email).toBe("test@example.com");
  });
});

describe("POST /reset-password", () => {
  it("returns 400 when fields are missing", async () => {
    const res = await request(app).post("/reset-password").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Missing required fields/i);
  });

  it("returns 200 on successful password reset", async () => {
    mockUserFindOneAndUpdate.mockResolvedValue(mockUserDoc);
    bcrypt.hash.mockResolvedValue("newhashed");
    const res = await request(app).post("/reset-password").send({
      email: "test@example.com",
      newPassword: "newSecret"
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password reset successful!");
  });
});

// ============================================================
// ORDER ROUTES
// ============================================================

describe("POST /order", () => {
  beforeEach(() => {
    mockOrderCountDocuments.mockResolvedValue(1);
    mockSendMail.mockResolvedValue({ messageId: "ok" });
  });

  it("returns 201 and saves the order", async () => {
    // Emit stream "finish" after the request handler creates the write stream
    setTimeout(resolveStream, 20);
    const res = await request(app).post("/order").send({
      name: "Test User",
      email: "test@example.com",
      phone: "0200000001",
      product: "sachet-water",
      quantity: 5,
      orderType: "weekly",
      delivery: "2026-04-01",
      region: "Greater Accra",
      district: "Accra Metro",
      streetAddress: "1 Main St"
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Order placed!");
  });
});

describe("GET /orders/:email", () => {
  it("returns orders for a given email", async () => {
    mockOrderFind.mockReturnValue({
      sort: jest.fn().mockResolvedValue([mockOrderDoc])
    });
    const res = await request(app).get("/orders/test@example.com");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders).toHaveLength(1);
  });

  it("returns empty array when no orders exist for email", async () => {
    mockOrderFind.mockReturnValue({
      sort: jest.fn().mockResolvedValue([])
    });
    const res = await request(app).get("/orders/nobody@example.com");
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(0);
  });
});

describe("GET /order/:id", () => {
  it("returns 404 when order is not found", async () => {
    mockOrderFindById.mockResolvedValue(null);
    const res = await request(app).get("/order/nonexistent123");
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("returns the order when found", async () => {
    mockOrderFindById.mockResolvedValue(mockOrderDoc);
    const res = await request(app).get("/order/order123");
    expect(res.status).toBe(200);
    expect(res.body.order._id).toBe("order123");
  });
});

describe("GET /admin/orders", () => {
  it("returns all orders sorted by creation date", async () => {
    mockOrderFind.mockReturnValue({
      sort: jest.fn().mockResolvedValue([mockOrderDoc])
    });
    const res = await request(app).get("/admin/orders");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });
});

describe("PATCH /admin/orders/:id/paid", () => {
  it("returns 404 when order is not found", async () => {
    mockOrderFindByIdAndUpdate.mockResolvedValue(null);
    const res = await request(app).patch("/admin/orders/bad123/paid");
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("marks the order as paid and returns 200", async () => {
    const paidOrder = { ...mockOrderDoc, paymentStatus: "paid" };
    mockOrderFindByIdAndUpdate.mockResolvedValue(paidOrder);
    mockSendMail.mockResolvedValue({ messageId: "ok" });
    const res = await request(app).patch("/admin/orders/order123/paid");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/marked as paid/i);
    expect(res.body.order.paymentStatus).toBe("paid");
  });
});

// ============================================================
// WAYBILL ROUTES
// ============================================================

describe("POST /waybill", () => {
  it("creates a waybill and returns 200", async () => {
    mockWaybillCountDocuments.mockResolvedValue(0);
    mockSendMail.mockResolvedValue({ messageId: "ok" });
    const res = await request(app).post("/waybill").send({
      to: "Customer A",
      driverName: "Driver B",
      address: "Accra",
      carNumber: "GR-1234-20",
      date: "2026-04-01",
      quantity: "100",
      description: "Sachet water",
      despatchedBy: "Admin",
      submittedBy: "Admin"
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/submitted successfully/i);
    expect(res.body.waybill.waybillNumber).toMatch(/WWW2026/);
  });
});

describe("GET /waybills", () => {
  it("returns all waybills", async () => {
    mockWaybillFind.mockReturnValue({
      sort: jest.fn().mockResolvedValue([mockWaybillDoc])
    });
    const res = await request(app).get("/waybills");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.waybills)).toBe(true);
    expect(res.body.waybills).toHaveLength(1);
  });
});

describe("GET /waybills/count", () => {
  it("returns the count of waybills", async () => {
    mockWaybillCountDocuments.mockResolvedValue(7);
    const res = await request(app).get("/waybills/count");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(7);
  });
});

describe("GET /admin/analytics/custom-waybills", () => {
  it("returns total amount and count for a date range", async () => {
    mockWaybillFind.mockResolvedValue([{ amount: 200 }, { amount: 300 }]);
    const res = await request(app)
      .get("/admin/analytics/custom-waybills")
      .query({ from: "2026-01-01", to: "2026-12-31" });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.total).toBe(500);
  });

  it("returns zero total when no waybills match the date range", async () => {
    mockWaybillFind.mockResolvedValue([]);
    const res = await request(app)
      .get("/admin/analytics/custom-waybills")
      .query({ from: "2025-01-01", to: "2025-01-31" });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.total).toBe(0);
  });
});

// ============================================================
// generateInvoice helper
// ============================================================

describe("generateInvoice", () => {
  it("resolves with a file path when the stream finishes", async () => {
    const order = {
      name: "Bob",
      email: "bob@example.com",
      phone: "0200000002",
      product: "bulk-purchase",
      quantity: 10,
      orderType: "monthly",
      delivery: "2026-04-01",
      region: "Ashanti",
      district: "Kumasi Metro",
      streetAddress: "2 Side St",
      paymentMethod: "cash"
    };
    const invoicePromise = generateInvoice(order, 1);
    resolveStream();
    const filePath = await invoicePromise;
    expect(typeof filePath).toBe("string");
    expect(filePath).toContain("invoice-1.pdf");
  });

  it("rejects when the stream emits an error", async () => {
    const order = {
      name: "Error Test",
      email: "err@example.com",
      phone: "0200000003",
      product: "sachet-water",
      quantity: 2,
      orderType: "one-time",
      delivery: "2026-04-15",
      region: "Volta",
      district: "Ho West",
      streetAddress: "3 Error Rd",
      paymentMethod: "cash"
    };
    const invoicePromise = generateInvoice(order, 99);
    const results = fs.createWriteStream.mock.results;
    const stream = results[results.length - 1].value;
    setImmediate(() => stream.emit("error", new Error("write failed")));
    await expect(invoicePromise).rejects.toThrow("write failed");
  });
});
