import express from "express";
import fetch from "node-fetch";
import { URLSearchParams } from "url";

const app = express();
const port = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("✅ MCP Minimax server aktivan i povezan s /HR/API!");
});

app.get("/partners", async (req, res) => {
  const {
    client_id,
    client_secret,
    username,
    password,
    MINIMAX_AUTH_URL,
    MINIMAX_API_URL,
  } = process.env;

  console.log("🔍 DEBUG: Pokrećem Minimax auth...");
  console.log("client_id:", client_id ? "OK" : "❌ missing");
  console.log("client_secret:", client_secret ? "OK" : "❌ missing");
  console.log("username:", username ? "OK" : "❌ missing");
  console.log("password:", password ? "OK" : "❌ missing");
  console.log("MINIMAX_AUTH_URL:", MINIMAX_AUTH_URL);
  console.log("MINIMAX_API_URL:", MINIMAX_API_URL);

  try {
    // 1️⃣ Autentifikacija
    const authParams = new URLSearchParams();
    authParams.append("grant_type", "password");
    authParams.append("client_id", client_id);
    authParams.append("client_secret", client_secret);
    authParams.append("username", username);
    authParams.append("password", password);

    console.log("📡 Šaljem auth request...");
    const tokenResponse = await fetch(MINIMAX_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: authParams,
    });

    const tokenText = await tokenResponse.text();
    console.log("📥 Auth response:", tokenText);

    if (!tokenResponse.ok) {
      return res.status(401).json({
        error: "❌ Greška kod autentifikacije prema Minimaxu",
        details: tokenText,
      });
    }

    const tokenData = JSON.parse(tokenText);
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(500).json({
        error: "❌ Token nije vraćen",
        details: tokenData,
      });
    }

    console.log("✅ Autentifikacija OK, token primljen.");

    // 2️⃣ Dohvati trenutnog korisnika
    const currentUserResponse = await fetch(
      `${MINIMAX_API_URL}/api/currentuser`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const currentUserText = await currentUserResponse.text();
    console.log("📥 currentuser:", currentUserText);

    // 3️⃣ Dohvati sve organizacije korisnika
    const orgsResponse = await fetch(`${MINIMAX_API_URL}/api/currentuser/orgs`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const orgsText = await orgsResponse.text();
    console.log("📥 orgs:", orgsText);

    if (!orgsResponse.ok) {
      return res.status(500).json({
        error: "❌ Ne mogu dohvatiti organizacije korisnika",
        details: orgsText,
      });
    }

    const orgsData = JSON.parse(orgsText);
    if (!orgsData || !orgsData.length) {
      return res.status(404).json({
        error: "❌ Korisnik nema organizacija",
        details: orgsData,
      });
    }

    const organisationId = orgsData[0].organisationId;
    console.log("🏢 Prva organizacija ID:", organisationId);

    // 4️⃣ Dohvati kontakte (partnere) te organizacije
    const contactsResponse = await fetch(
      `${MINIMAX_API_URL}/api/orgs/${organisationId}/contacts`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const contactsText = await contactsResponse.text();
    console.log("📥 contacts:", contactsText);

    if (!contactsResponse.ok) {
      return res.status(500).json({
        error: "❌ Greška kod dohvaćanja kontakata",
        details: contactsText,
      });
    }

    res.setHeader("Content-Type", "application/json");
    res.send(contactsText);
  } catch (err) {
    console.error("💥 Neočekivana greška:", err);
    res.status(500).json({
      error: "Greška u komunikaciji s Minimaxom",
      details: err.message,
    });
  }
});

app.listen(port, () => console.log(`🚀 Server pokrenut na portu ${port}`));
