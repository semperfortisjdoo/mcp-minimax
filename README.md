# Minimax MCP Server

MCP (Model Context Protocol) server za integraciju sa Minimax API-jem. Omogućava dohvat organizacija, partnera i računa te kreiranje novih računa.

## 🚀 Značajke

- ✅ **Token Caching** - Optimizovano autentikacija sa cacheiranjem tokena
- ✅ **Rate Limiting** - Zaštita od prekomjerne upotrebe (100 req/15min po IP)
- ✅ **CORS podrška** - Konfigurabilan CORS za frontend integracije
- ✅ **Validacija ulaza** - Kompletna validacija svih parametara
- ✅ **Structured Logging** - JSON formatirani logovi za lakše praćenje
- ✅ **Timeout zaštita** - Automatski timeout na fetch pozivima
- ✅ **Health Check** - `/health` endpoint za monitoring
- ✅ **Graceful Shutdown** - Pravilno gašenje servera
- ✅ **Error Handling** - Detaljan error handling sa informativnim porukama

## 📋 Preduvjeti

- Node.js 18+ (zbog ES modules i native fetch)
- Minimax API kredencijali

## 🔧 Instalacija

1. Klonirajte repozitorij:
```bash
git clone <repository-url>
cd mcp-minimax
```

2. Instalirajte dependencies:
```bash
npm install
```

3. Kreirajte `.env` fajl na osnovu `.env.example`:
```bash
cp .env.example .env
```

4. Popunite `.env` fajl sa vašim Minimax kredencijalima:
```env
client_id=your_client_id
client_secret=your_client_secret
username=your_username
password=your_password
MINIMAX_AUTH_URL=https://api.minimax.hr/oauth/token
MINIMAX_API_URL=https://api.minimax.hr
```

## 🏃 Pokretanje

```bash
npm start
```

Server će se pokrenuti na portu `10000` (ili PORT iz .env fajla).

## 📡 API Endpoints

### Manifest Endpoints

- `GET /` - MCP manifest
- `GET /manifest` - MCP manifest
- `GET /mcp/manifest` - MCP manifest

### Health & Monitoring

- `GET /health` - Health check endpoint (status, uptime, token cache info)
- `GET /ping` - Simple ping/pong

### Minimax API Endpoints

#### Dohvati organizacije
```http
GET /orgs
```

Vraća sve organizacije dostupne trenutnom korisniku.

#### Dohvati partnere
```http
GET /partners?orgId=123
GET /partners?org=naziv_organizacije
GET /partners
```

Parametri:
- `orgId` (number, optional) - ID organizacije
- `org` (string, optional) - Naziv organizacije (ili dio naziva)

Ako niti jedan parametar nije proslijeđen, vraća listu dostupnih organizacija.

#### Dohvati račune
```http
GET /invoices?orgId=123
```

Parametri:
- `orgId` (number, **required**) - ID organizacije

#### Kreiraj račun
```http
POST /createInvoice
Content-Type: application/json

{
  "orgId": 123,
  "partnerName": "Naziv partnera",
  "itemName": "Naziv artikla",
  "quantity": 1,
  "price": 100.00,
  "vatRate": 25
}
```

Svi parametri su **obavezni**.

Validacija:
- `orgId` - mora biti pozitivan broj
- `partnerName` - mora postojati u organizaciji
- `itemName` - ne smije biti prazan
- `quantity` - mora biti > 0
- `price` - mora biti ≥ 0
- `vatRate` - mora biti između 0 i 100

## 🛡️ Sigurnost

### Rate Limiting
- 100 zahtjeva po IP adresi na 15 minuta
- Konfigurabilan u `server.js` (linija 59)

### CORS
- Podrazumijevano omogućen za sve origine (`*`)
- Može se ograničiti postavljanjem `CORS_ORIGIN` env varijable

### Environment Variables
- Svi osjetljivi podaci se drže u `.env` fajlu
- `.env` je u `.gitignore` i neće biti commitovan
- Server validira sve potrebne env varijable na startu

## 🔍 Logging

Server koristi structured JSON logging:

```json
{
  "level": "info",
  "message": "HTTP Request",
  "method": "GET",
  "path": "/orgs",
  "status": 200,
  "duration": "145ms",
  "ip": "::1",
  "timestamp": "2025-11-10T12:34:56.789Z"
}
```

Nivoi logova:
- `info` - Normalne operacije
- `warn` - Upozorenja
- `error` - Greške sa stack trace-om

## 🐛 Error Handling

Svi endpoint-i vraćaju strukturirane error poruke:

```json
{
  "error": "Opis greške",
  "details": "Dodatni detalji (ako su dostupni)"
}
```

HTTP status kodovi:
- `400` - Bad Request (nevaljani parametri)
- `404` - Not Found (entitet nije pronađen)
- `500` - Internal Server Error
- `503` - Service Unavailable (timeout ili Minimax API nedostupan)

## 📊 Performance

### Token Caching
Access token se kešira i ponovno koristi dok ne istekne. Ovo dramatično smanjuje broj autentikacijskih zahtjeva i poboljšava performanse.

### Timeout Protection
Svi fetch pozivi imaju timeout:
- Auth endpoint: 10 sekundi
- Ostali API pozivi: 30 sekundi

## 🧪 Testiranje

### Brzo testiranje
```bash
# Health check
curl http://localhost:10000/health

# Ping
curl http://localhost:10000/ping

# Dohvati organizacije
curl http://localhost:10000/orgs
```

## 📝 Development

### Dodavanje novog endpoint-a
1. Dodaj definiciju u `manifestJSON.tools` (linija 97)
2. Implementiraj endpoint handler
3. Dodaj validaciju ako je potrebna
4. Testiraj

### Promjena rate limit konfiguracije
Izmjeni `limiter` konfiguraciju (linija 59-65):
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Window u milisekundama
  max: 100, // Maksimalan broj zahtjeva
  // ...
});
```

## 🤝 Contributing

Pull request-ovi su dobrodošli! Za veće promjene, molimo prvo otvorite issue.

## 📄 Licenca

MIT
