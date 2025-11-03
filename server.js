import express from "express";
import fetch from "node-fetch";
import { URLSearchParams } from "url";

const app = express();
const port = process.env.PORT || 10000;

// -------------------------------
// HELPER: autentifikacija
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

// -------------------------------
// Test endpoint
app.get("/", (req, res) => {
  res.send("✅ MCP Minimax server aktivan – podržava više organizacija!");
});

// -------------------------------
// Endpoint: dohvat svih organizacija
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

// -------------------------------
// Endpoint: dohvat partnera za organizaciju
// primjer: /partners?org=SEMPER%20FORTIS  ili  /partners?orgId=10037
app.get("/partners", async (req, res) => {
  try {
    const token = await getAccessToken();
    const orgsResponse = await fetch(
      `${process.env.MINIMAX_API_URL}/api/currentuser/orgs`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const orgsData = await orgsResponse.json();

    if (!orgsData.Rows || !orgsData.Rows.length) {
      return res.status(404).json({ error: "Nema dostupnih organizacija." });
    }

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
      // ako nije navedeno ništa, vrati listu svih
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
        hint: "Probaj ?org=dio_imena_organizacije",
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

app.listen(port, () => console.log(`🚀 Server pokrenut na portu ${port}`));
