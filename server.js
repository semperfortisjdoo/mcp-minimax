// server.js
import express from "express";

const app = express();
app.use(express.json());

// testni endpoint
app.get("/", (req, res) => {
  res.send("✅ MCP Minimax server je uspješno pokrenut!");
});

// endpoint koji ChatGPT koristi (placeholder)
app.post("/invoke", (req, res) => {
  res.json({ message: "Server radi, ali još nema povezan Minimax API." });
});

// Render automatski dodjeljuje port kroz varijablu PORT
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server pokrenut na portu ${port}`));
