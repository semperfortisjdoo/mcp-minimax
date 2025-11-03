import express from "express";
import fetch from "node-fetch";
import { URLSearchParams } from "url";

const app = express();
const port = process.env.PORT || 10000;

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
        required: ["orgId", "partnerName"],
      },
    },
  ],
};

// ----------------------------
// 🔐 Autentifikacija
// ----------------------------
async function getAccessToken() {
  const { client_id, client_secret, username, password, MINIMAX_AUTH_URL } = process.env;

  const authParams = new URLSearchParams();
  authParams.append("grant_type", "password");
  authParams.append("client_id", client_id);
  authParams.append("client_secret", client_secret);
  authParams.append("username", username);
  authParams.append("password", password);

  const tokenResponse = await fetch(MINIMAX_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: authParams,
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error("Auth failed: " + text);
  }

  const data = await tokenResponse.json();
  if (!data.access_token) throw new Error("No access_token returned");
  return data.access_token;
}

// ----------------------------
// 🌐 Manifest rute (za ChatGPT/Claude)
// ----------------------------
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(manifestJSON);
});

app.get("/manifest", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(manifestJSON);
});

app.get("/mcp/manifest", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(manifestJSON);
});

// ----------------------------
// 🏢 Dohvati organizacije
// ----------------------------
app.get("/orgs", async (req, res) => {
  try {
    const token = await getAccessToken();
    const orgsResponse = await fetch(`${process.env.MINIMAX_API_URL}/api/currentuser/orgs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const orgsText = await orgsResponse.text();
    res.setHeader("Content-Type", "application/json");
    res.send(orgsText);
  } catch (err) {
    console.error("💥 /orgs error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// 👥 Dohvati partnere
// ----------------------------
app.get("/partners", async (req, res) => {
  try {
    const token = await getAccessToken();
    const { org, orgId } = req.query;

    const orgsResponse = await fetch(`${process.env.MINIMAX_API_URL}/api/currentuser/orgs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const orgsData = await orgsResponse.json();

    let organisationId = null;

    if (orgId) {
      organisationId = parseInt(orgId);
    } else if (org) {
      const match = orgsData.Rows.find((r) =>
        r.Organisation.Name.toLowerCase().includes(org.toLowerCase())
      );
      if (match) organisationId = match.Organisation.ID;
    } else {
      return res.json({
        info: "Navedi ?org=ime ili ?orgId=broj da dohvatim kontakte.",
        availableOrgs: orgsData.Rows.map((r) => ({
          id: r.Organisation.ID,
          name: r.Organisation.Name,
        })),
      });
    }

    if (!organisationId)
      return res.status(404).json({ error: "Organizacija nije pronađena." });

    const contactsResponse = await fetch(
      `${process.env.MINIMAX_API_URL}/api/orgs/${organisationId}/contacts`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const contactsText = await contactsResponse.text();
    res.setHeader("Content-Type", "application/json");
    res.send(contactsText);
  } catch (err) {
    console.error("💥 /partners error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// 📄 Dohvati račune
// ----------------------------
app.get("/invoices", async (req, res) => {
  try {
    const token = await getAccessToken();
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "Nedostaje orgId parametar." });

    const invoicesResponse = await fetch(
      `${process.env.MINIMAX_API_URL}/api/orgs/${orgId}/invoices`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const invoicesText = await invoicesResponse.text();
    res.setHeader("Content-Type", "application/json");
    res.send(invoicesText);
  } catch (err) {
    console.error("💥 /invoices error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// 🧾 Kreiraj novi izlazni račun (predložak)
// ----------------------------
app.post("/createInvoice", express.json(), async (req, res) => {
  try {
    const token = await getAccessToken();

    const {
      orgId = 10037,
      partnerName = "Valamar",
      itemName = "Administrativne usluge",
      quantity = 1,
      price = 10,
      vatRate = 25,
    } = req.body;

    // 1️⃣ Pronađi partnera po imenu
    const partnersResponse = await fetch(
      `${process.env.MINIMAX_API_URL}/api/orgs/${orgId}/contacts`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const partnersData = await partnersResponse.json();
    const matchedPartner = partnersData.Rows?.find((p) =>
      p.Name.toLowerCase().includes(partnerName.toLowerCase())
    );

    if (!matchedPartner) {
      return res.status(404).json({
        error: `Partner '${partnerName}' nije pronađen u organizaciji ${orgId}.`,
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

    const response = await fetch(
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

    const text = await response.text();
    if (!response.ok) {
      console.error("❌ Greška pri kreiranju računa:", text);
      return res.status(400).send({ error: "Neuspješno kreiranje računa.", details: text });
    }

    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (err) {
    console.error("💥 /createInvoice error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// 🩵 Ping
// ----------------------------
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// ----------------------------
// 🚀 Pokreni server
// ----------------------------
app.listen(port, () => console.log(`🚀 Server pokrenut na portu ${port}`));
