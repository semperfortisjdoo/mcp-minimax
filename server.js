// server.js
import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// === 1. Konfiguracija Minimax API pristupa ===
const MINIMAX_BASE_URL = "https://moj.minimax.hr/api/v2";
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;

// === 2. Funkcija za dobivanje tokena ===
async function getAccessToken() {
  try {
    const response = await axios.post(`${MINIMAX_BASE_URL}/token`, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username: USERNAME,
      password: PASSWORD,
      grant_type: "password",
    });
    return response.data.access_token;
  } catch (err) {
    console.error("❌ Pogreška pri dohvaćanju tokena:", err.response?.data || err.message);
    throw new Error("Greška kod autentifikacije prema Minimaxu");
  }
}

// === 3. Testna ruta ===
app.get("/", (req, res) => {
  res.send("✅ MCP Minimax server s API integracijom radi!");
});

// === 4. Endpoint: getPartners ===
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

// === 5. Endpoint: createInvoice (pojednostavljena verzija) ===
app.post("/invoice", async (req, res) => {
  try {
    const token = await getAccessToken();
    const invoiceData = req.body;

    const response = await axios.post(`${MINIMAX_BASE_URL}/invoices`, invoiceData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    res.json({ message: "Račun uspješno kreiran!", data: response.data });
  } catch (err) {
    console.error("❌ Greška kod kreiranja računa:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// === 6. Endpoint za ChatGPT (MCP standard) ===
app.post("/invoke", async (req, res) => {
  const { tool, params } = req.body;

  try {
    if (tool === "getPartners") {
      const token = await getAccessToken();
      const response = await axios.get(`${MINIMAX_BASE_URL}/partners`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json(response.data);
    }

    if (tool === "createInvoice") {
      const token = await getAccessToken();
      const response = await axios.post(`${MINIMAX_BASE_URL}/invoices`, params, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      return res.json(response.data);
    }

    res.status(400).json({ error: "Nepoznati alat ili pogrešni parametri" });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// === 7. Pokretanje servera ===
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server pokrenut na portu ${port}`));
