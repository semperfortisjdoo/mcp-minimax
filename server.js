import express from "express";
import fetch from "node-fetch";
import { URLSearchParams } from "url";
import cors from "cors";
import rateLimit from "express-rate-limit";

const app = express();
const port = process.env.PORT || 10000;

// ----------------------------
// 🔒 ENV Validation
// ----------------------------
const requiredEnvVars = [
  "client_id",
  "client_secret",
  "username",
  "password",
  "MINIMAX_AUTH_URL",
  "MINIMAX_API_URL",
];

function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("✅ All required environment variables are set");
}

validateEnv();

// ----------------------------
// 📝 Structured Logging
// ----------------------------
const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({ level: "info", message, ...meta, timestamp: new Date().toISOString() }));
  },
  error: (message, meta = {}) => {
    console.error(JSON.stringify({ level: "error", message, ...meta, timestamp: new Date().toISOString() }));
  },
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({ level: "warn", message, ...meta, timestamp: new Date().toISOString() }));
  },
};

// ----------------------------
// 🛡️ Middleware Setup
// ----------------------------
// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuta
  max: 100, // Limit svaki IP na 100 requesta po windowMs
  message: { error: "Previše zahtjeva, pokušajte ponovo kasnije." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// JSON Parser
app.use(express.json());

// Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("HTTP Request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
});

// ----------------------------
// 🧩 Manifest JSON
// ----------------------------
const manifestJSON = {
  schemaVersion: "1.0",
  name: "Minimax MCP Server",
  version: "1.0.0",
  description:
    "MCP server za dohvat organizacija, partnera i računa iz Minimax API-ja.",
  tools: [
    {
      name: "getOrgs",
      description: "Dohvaća sve organizacije dostupne korisniku u Minimaxu.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "getPartners",
      description: "Dohvaća popis partnera (kontakata) za odabranu organizaciju.",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "number", description: "ID organizacije" },
          org: { type: "string", description: "Naziv organizacije (alternativa orgId)" },
        },
        required: [],
      },
    },
    {
      name: "getInvoices",
      description: "Dohvaća popis računa za odabranu organizaciju.",
      inputSchema: {
        type: "object",
        properties: { orgId: { type: "number", description: "ID organizacije" } },
        required: ["orgId"],
      },
    },
    {
      name: "createInvoice",
      description: "Kreira novi izlazni račun u statusu predložak (Draft).",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "number", description: "ID organizacije" },
          partnerName: { type: "string", description: "Naziv partnera" },
          itemName: { type: "string", description: "Naziv artikla" },
          quantity: { type: "number", description: "Količina" },
          price: { type: "number", description: "Jedinična cijena" },
          vatRate: { type: "number", description: "Stopa PDV-a" },
        },
        required: ["orgId", "partnerName", "itemName", "quantity", "price", "vatRate"],
      },
    },
  ],
};

// ----------------------------
// 🔐 Token Cache & Authentication
// ----------------------------
let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  // Proveri da li postoji važeći cached token
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    logger.info("Using cached access token");
    return cachedToken;
  }

  const { client_id, client_secret, username, password, MINIMAX_AUTH_URL } = process.env;

  const authParams = new URLSearchParams();
  authParams.append("grant_type", "password");
  authParams.append("client_id", client_id);
  authParams.append("client_secret", client_secret);
  authParams.append("username", username);
  authParams.append("password", password);

  try {
    const tokenResponse = await fetchWithTimeout(MINIMAX_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: authParams,
    }, 10000);

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      logger.error("Authentication failed", { status: tokenResponse.status, response: text });
      throw new Error(`Auth failed with status ${tokenResponse.status}: ${text}`);
    }

    const data = await tokenResponse.json();
    if (!data.access_token) {
      logger.error("No access_token in response", { response: data });
      throw new Error("No access_token returned");
    }

    // Cache token - expires_in je u sekundama, konvertuj u milisekunde
    // Ostavi 60s buffer prije expiry
    const expiresIn = (data.expires_in || 3600) * 1000;
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + expiresIn - 60000;

    logger.info("New access token obtained", { expiresIn: data.expires_in });
    return cachedToken;
  } catch (err) {
    logger.error("getAccessToken error", { error: err.message, stack: err.stack });
    throw err;
  }
}

// ----------------------------
// 🌐 Fetch with Timeout
// ----------------------------
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw err;
  }
}

// ----------------------------
// 🛠️ Validation Helpers
// ----------------------------
function validateOrgId(orgId) {
  const parsed = parseInt(orgId);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error("Invalid orgId: must be a positive number");
  }
  return parsed;
}

function validateInvoiceData(data) {
  const { orgId, partnerName, itemName, quantity, price, vatRate } = data;

  if (!orgId || !partnerName || !itemName) {
    throw new Error("Missing required fields: orgId, partnerName, itemName");
  }

  if (typeof quantity !== "number" || quantity <= 0) {
    throw new Error("Invalid quantity: must be a positive number");
  }

  if (typeof price !== "number" || price < 0) {
    throw new Error("Invalid price: must be a non-negative number");
  }

  if (typeof vatRate !== "number" || vatRate < 0 || vatRate > 100) {
    throw new Error("Invalid vatRate: must be between 0 and 100");
  }

  return {
    orgId: validateOrgId(orgId),
    partnerName: partnerName.trim(),
    itemName: itemName.trim(),
    quantity,
    price,
    vatRate,
  };
}

// ----------------------------
// 🌐 Manifest Routes (za ChatGPT/Claude)
// ----------------------------
app.get("/", (req, res) => {
  res.json(manifestJSON);
});

app.get("/manifest", (req, res) => {
  res.json(manifestJSON);
});

app.get("/mcp/manifest", (req, res) => {
  res.json(manifestJSON);
});

// ----------------------------
// 🏥 Health Check
// ----------------------------
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    tokenCached: !!cachedToken,
  });
});

app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// ----------------------------
// 🏢 Dohvati organizacije
// ----------------------------
app.get("/orgs", async (req, res) => {
  try {
    const token = await getAccessToken();
    const orgsResponse = await fetchWithTimeout(
      `${process.env.MINIMAX_API_URL}/api/currentuser/orgs`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!orgsResponse.ok) {
      const text = await orgsResponse.text();
      logger.error("Failed to fetch orgs", { status: orgsResponse.status, response: text });
      return res.status(orgsResponse.status).json({ error: "Failed to fetch organizations", details: text });
    }

    const orgsData = await orgsResponse.json();
    res.json(orgsData);
  } catch (err) {
    logger.error("/orgs error", { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// 👥 Dohvati partnere (Optimizovano)
// ----------------------------
app.get("/partners", async (req, res) => {
  try {
    const token = await getAccessToken();
    const { org, orgId } = req.query;

    let organisationId = null;

    // Ako imamo orgId, direktno ga koristimo
    if (orgId) {
      organisationId = validateOrgId(orgId);
    }
    // Ako imamo org name, moramo dohvatiti sve org da pronađemo ID
    else if (org) {
      const orgsResponse = await fetchWithTimeout(
        `${process.env.MINIMAX_API_URL}/api/currentuser/orgs`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!orgsResponse.ok) {
        const text = await orgsResponse.text();
        logger.error("Failed to fetch orgs", { status: orgsResponse.status, response: text });
        return res.status(orgsResponse.status).json({ error: "Failed to fetch organizations" });
      }

      const orgsData = await orgsResponse.json();
      const match = orgsData.Rows?.find((r) =>
        r.Organisation?.Name?.toLowerCase().includes(org.toLowerCase())
      );

      if (match) {
        organisationId = match.Organisation.ID;
      }
    }
    // Ako nemamo ni orgId ni org, vrati info
    else {
      const orgsResponse = await fetchWithTimeout(
        `${process.env.MINIMAX_API_URL}/api/currentuser/orgs`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const orgsData = await orgsResponse.json();
      return res.json({
        info: "Navedi ?org=ime ili ?orgId=broj da dohvatim kontakte.",
        availableOrgs: orgsData.Rows?.map((r) => ({
          id: r.Organisation?.ID,
          name: r.Organisation?.Name,
        })) || [],
      });
    }

    if (!organisationId) {
      return res.status(404).json({ error: "Organizacija nije pronađena." });
    }

    const contactsResponse = await fetchWithTimeout(
      `${process.env.MINIMAX_API_URL}/api/orgs/${organisationId}/contacts`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!contactsResponse.ok) {
      const text = await contactsResponse.text();
      logger.error("Failed to fetch contacts", { status: contactsResponse.status, response: text });
      return res.status(contactsResponse.status).json({ error: "Failed to fetch contacts", details: text });
    }

    const contactsData = await contactsResponse.json();
    res.json(contactsData);
  } catch (err) {
    logger.error("/partners error", { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// 📄 Dohvati račune
// ----------------------------
app.get("/invoices", async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: "Nedostaje orgId parametar." });
    }

    const validOrgId = validateOrgId(orgId);
    const token = await getAccessToken();

    const invoicesResponse = await fetchWithTimeout(
      `${process.env.MINIMAX_API_URL}/api/orgs/${validOrgId}/invoices`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!invoicesResponse.ok) {
      const text = await invoicesResponse.text();
      logger.error("Failed to fetch invoices", { status: invoicesResponse.status, response: text });
      return res.status(invoicesResponse.status).json({ error: "Failed to fetch invoices", details: text });
    }

    const invoicesData = await invoicesResponse.json();
    res.json(invoicesData);
  } catch (err) {
    logger.error("/invoices error", { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// 🧾 Kreiraj novi izlazni račun (predložak)
// ----------------------------
app.post("/createInvoice", async (req, res) => {
  try {
    // Validacija input podataka
    const validatedData = validateInvoiceData(req.body);
    const { orgId, partnerName, itemName, quantity, price, vatRate } = validatedData;

    const token = await getAccessToken();

    // 1️⃣ Pronađi partnera po imenu
    const partnersResponse = await fetchWithTimeout(
      `${process.env.MINIMAX_API_URL}/api/orgs/${orgId}/contacts`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!partnersResponse.ok) {
      const text = await partnersResponse.text();
      logger.error("Failed to fetch partners", { status: partnersResponse.status, response: text });
      return res.status(partnersResponse.status).json({ error: "Failed to fetch partners", details: text });
    }

    const partnersData = await partnersResponse.json();
    const matchedPartner = partnersData.Rows?.find((p) =>
      p.Name?.toLowerCase().includes(partnerName.toLowerCase())
    );

    if (!matchedPartner) {
      return res.status(404).json({
        error: `Partner '${partnerName}' nije pronađen u organizaciji ${orgId}.`,
        availablePartners: partnersData.Rows?.slice(0, 10).map((p) => p.Name) || [],
      });
    }

    const partnerId = matchedPartner.ID;

    // 2️⃣ Kreiraj račun
    const invoiceData = {
      DocumentType: "IssuedInvoice",
      DocumentStatus: "Draft",
      Partner: { ID: partnerId },
      Items: [
        {
          ItemName: itemName,
          Quantity: quantity,
          UnitPrice: price,
          VatRate: vatRate,
          VatType: "S",
        },
      ],
      Note: "Račun kreiran automatski putem MCP servera (predložak).",
    };

    const response = await fetchWithTimeout(
      `${process.env.MINIMAX_API_URL}/api/orgs/${orgId}/invoices`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invoiceData),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      logger.error("Failed to create invoice", { status: response.status, response: text });
      return res.status(response.status).json({ error: "Neuspješno kreiranje računa.", details: text });
    }

    const createdInvoice = await response.json();
    logger.info("Invoice created successfully", { invoiceId: createdInvoice.ID, orgId, partnerId });
    res.json(createdInvoice);
  } catch (err) {
    logger.error("/createInvoice error", { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// 🚫 Global Error Handler
// ----------------------------
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// ----------------------------
// 🚀 Pokreni server
// ----------------------------
app.listen(port, () => {
  logger.info(`Server started on port ${port}`, { port, nodeEnv: process.env.NODE_ENV || "development" });
  console.log(`🚀 Server pokrenut na portu ${port}`);
});

// ----------------------------
// 🛑 Graceful Shutdown
// ----------------------------
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  process.exit(0);
});
