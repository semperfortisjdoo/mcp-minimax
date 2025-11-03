import express from "express";
import fetch from "node-fetch";

const app = express();
const port = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("✅ MCP Minimax server aktivan!");
});

app.get("/partners", async (req, res) => {
  const { CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD, MINIMAX_AUTH_URL, MINIMAX_API_URL } = process.env;

  console.log("🔍 Debug auth attempt...");
  console.log("CLIENT_ID:", CLIENT_ID ? "OK" : "❌ missing");
  console.log("CLIENT_SECRET:", CLIENT_SECRET ? "OK" : "❌ missing");
  console.log("USERNAME:", USERNAME ? "OK" : "❌ missing");
  console.log("PASSWORD:", PASSWORD ? "OK" : "❌ missing");

  try {
    const tokenResponse = await fetch(MINIMAX_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        username: USERNAME,
        password: PASSWORD,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("❌ Auth error:", tokenData);
      return res.status(401).json({ error: "Greška kod autentifikacije prema Minimaxu", details: tokenData });
    }

    const accessToken = tokenData.access_token;
    console.log("✅ Auth OK");

    const partnersResponse = await fetch(`${MINIMAX_API_URL}/partners`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const partners = await partnersResponse.json();
    res.json(partners);

  } catch (error) {
    console.error("❌ Greška:", error);
    res.status(500).json({ error: "Greška u komunikaciji s Minimaxom", details: error.message });
  }
});

app.listen(port, () => console.log(`🚀 Server pokrenut na portu ${port}`));
