import express from "express";
import fetch from "node-fetch";
import { URLSearchParams } from "url";

const app = express();
const port = process.env.PORT || 10000;

// testni endpoint
app.get("/", (req, res) => {
  res.send("✅ MCP Minimax server aktivan!");
});

// partners endpoint
app.get("/partners", async (req, res) => {
  const {
    client_id,
    client_secret,
    username,
    password,
    MINIMAX_AUTH_URL,
    MINIMAX_API_URL,
  } = process.env;

  console.log("🔍 DEBUG INFO — pokušaj autentifikacije:");
  console.log("client_id:", client_id ? "OK" : "❌ MISSING");
  console.log("client_secret:", client_secret ? "OK" : "❌ MISSING");
  console.log("username:", username ? "OK" : "❌ MISSING");
  console.log("password:", password ? "OK" : "❌ MISSING");
  console.log("MINIMAX_AUTH_URL:", MINIMAX_AUTH_URL);
  console.log("MINIMAX_API_URL:", MINIMAX_API_URL);

  try {
    const params = new URLSearchParams();
    params.append("grant_type", "password");
    params.append("client_id", client_id);
    params.append("client_secret", client_secret);
    params.append("username", username);
    params.append("password", password);

    console.log("📡 Sending auth request to:", MINIMAX_AUTH_URL);
    console.log("📤 Payload (without password):", {
      grant_type: "password",
      client_id,
      client_secret: client_secret ? "(hidden)" : "❌",
      username,
      password: password ? "(hidden)" : "❌",
    });

    const tokenResponse = await fetch(MINIMAX_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    const tokenText = await tokenResponse.text();
    console.log("📥 Auth raw response:", tokenText);

    if (!tokenResponse.ok) {
      console.error("❌ Auth request failed with status:", tokenResponse.status);
      return res.status(401).json({
        error: "Greška kod autentifikacije prema Minimaxu",
        details: tokenText,
      });
    }

    const tokenData = JSON.parse(tokenText);
    const accessToken = tokenData.access_token;
    console.log("✅ Token OK:", !!accessToken);

    const partnersResponse = await fetch(`${MINIMAX_API_URL}/partners`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const partnersText = await partnersResponse.text();
    console.log("📥 Partners response:", partnersText);

    res.setHeader("Content-Type", "application/json");
    res.send(partnersText);
  } catch (err) {
    console.error("💥 Unhandled error:", err);
    res.status(500).json({
      error: "Greška u komunikaciji s Minimaxom",
      details: err.message,
    });
  }
});

app.listen(port, () => console.log(`🚀 Server pokrenut na portu ${port}`));
