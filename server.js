// server.js
import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// === Konfiguracija Minimax API pristupa ===
const MINIMAX_BASE_URL = "https://moj.minimax.hr/api/v2";
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;

// === Funkcija za dobivanje tokena ===
async function getAccessToken() {
  try {
    console.log("🧩 Debug Minimax auth pokušaj:");
    console.log("CLIENT_ID:", CLIENT_ID ? "OK" : "❌ missing");
    console.log("CLIENT_SECRET:", CLIENT_SECRET ? "OK" : "❌ missing");
    console.log("USERNAME:", USERNAME ? "OK" : "❌ missing");
    console.log("PASSWORD:", PASSWORD ? "OK" : "❌ missing");

    const response = await axios.post(`${MINIMAX_BASE_URL}/token`, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username: USERNAME,
      password: PASSWORD,
      grant_type: "password",
    });

    console.log("✅ Token uspješno dohvaćen!");
    return response.data.access_token;
  } catch (err) {
    console.error("❌ Greška kod autentifikacije:", err.response?.data || err.message);
    throw new Error("Greška kod autentifikacije prema Minimaxu");
  }
}

// === Testna ruta ===
app.get("/", (req, res) => {
  res.send("✅ MCP Minimax server s debugom radi!");
});

// === Endpoint za partnere ===
app.get("/partners", async (req, res) => {
  try {
    const token = await getAccessToken();
    const response = await axios.get(`${MINIMAX_BASE_URL}/partners`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// === Pokretanje servera ===
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server pokrenut na portu ${port}`));
