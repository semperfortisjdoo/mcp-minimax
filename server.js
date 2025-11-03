// === 2. Funkcija za dobivanje tokena ===
async function getAccessToken() {
  try {
    // LOG — siguran ispis (ne prikazujemo lozinku)
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
