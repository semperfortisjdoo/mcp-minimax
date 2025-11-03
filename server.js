import express from "express";
import fetch from "node-fetch";
import { URLSearchParams } from "url";

const app = express();
const port = process.env.PORT || 10000;

// ---------------------------------------------------
// 🔧 Helper: autentifikacija prema Minimaxu
async function getAccessToken() {
  const {
    client_id,
    client_secret,
    username,
    password,
    MINIMAX_AUTH_URL,
  } = process.env;

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

// ---------------------------------------------------
// 🧩 MCP MANIFEST ENDPOINT (ChatGPT ga čita)
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json({
    schemaVersion: "1.0",
    name: "Minimax MCP Server",
    version: "1.0.0",
    description:
      "MCP server za dohvat organizacija, partnera i računa iz Minimax API-ja.",
    tools: [
      {
        name: "getOrgs",
        description: "Dohvaća sve organizacije dostupne korisniku u Minimaxu.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "getPartners",
        description:
          "Dohvaća popis partnera (kontakata) za odabranu organizaciju.",
        inputSchema: {
          type: "object",
          properties: {
            orgId: { type: "number", description: "ID organizacije" },
            org: {
              type: "string",
              description: "Naziv organizacije (alternativa orgId)",
            },
          },
          required: [],
        },
      },
      {
        name: "getInvoices",
        description: "Dohvaća popis računa za odabranu organizaciju.",
        inputSchema: {
          type: "object",
          properties: {
            orgId: { type: "number", description: "ID organizacije" },
          },
          required: ["orgId"],
        },
      },
    ],
  });
});

// ---------------------------------------------------
// 🔁 /manifest endpoint (za potpunu kompatibilnost)
app.get("/manifest", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json({
    schemaVersion: "1.0",
    name: "Minimax MCP Server",
    version: "1.0.0",
    description:
      "MCP server za dohvat organizacija, partnera i računa iz Minimax API-ja.",
    tools: [
      {
        name: "getOrgs",
        description: "Dohvaća sve organizacije dostupne korisniku u Minimaxu.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "getPartners",
        description:
          "Dohvaća popis partnera (kontakata) za odabranu organizaciju.",
        inputSchema: {
          type: "object",
          properties: {
            orgId: { type: "number", description: "ID organizacije" },
            org: {
              type: "string",
              description: "Naziv organizacije (alternativa orgId)",
            },
          },
          required: [],
        },
      },
      {
        name: "getInvoices",
        description: "Dohvaća popis računa za odabranu organizaciju.",
        inputSchema: {
          type: "object",
          properties: {
            orgId: { type: "number", description: "ID organizacije" },
          },
          required: ["orgId"],
        },
      },
    ],
  });
});

// ---------------------------------------------------
// 📊 Dohvati sve organizacije
app.get("/orgs", async (req, res) => {
  try {
    const token = await getAccessToken();
    const orgsResponse = await fetch(
      `${process.env.MINIMAX_API_URL}/api/currentuser/orgs`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const orgsText = await orgsResponse.text();
    res.setHeader("Content-Type", "application/json");
    res.send(orgsText);
  } catch (err) {
    console.error("💥 /orgs error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------
// 👥 Dohvati partnere (kontakte)
app.get("/partners", async (req, res) => {
  try {
    const token = await getAccessToken();
    const orgsResponse = await fetch(
      `${process.env.MINIMAX_API_URL}/api/currentuser/orgs`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const orgsData = await orgsResponse.json();

    const { org, orgId } = req.query;
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
      return res.status(404).json({
        error: "Organizacija nije pronađena.",
      });

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

// ---------------------------------------------------
// 📄 Dohvati račune (invoices)
app.get("/invoices", async (req, res) => {
  try {
    const token = await getAccessToken();
    const { orgId } = req.query;
    if (!orgId)
      return res.status(400).json({ error: "Nedostaje orgId parametar." });

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

app.listen(port, () => console.log(`🚀 Server pokrenut na portu ${port}`));
