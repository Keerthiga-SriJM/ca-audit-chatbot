# CA Audit Desk & Intelligence REST API Reference

> **Universal REST API for 10-Year Financial Due Diligence, RAG Audit Intelligence, Google Meet Scheduling, and Multi-Client Dispatch.**

This project is now fully exposed as a high-performance, cross-origin accessible **REST API**. You can integrate and consume it from **any external substance, application, or service** (React, Vue, mobile apps, Python backends, ERPs, CRMs, Zapier, Telegram/WhatsApp bots, or CLI tools).

---

## 🌟 Key Features

- **🌐 Cross-Origin Resource Sharing (CORS):** Full CORS support (`*` or custom origin) with preflight `OPTIONS` handling on all `/api/*` routes.
- **🔐 Flexible Authentication:** Optional `API_KEY` protection via `X-API-Key` or `Authorization: Bearer <key>`. Public access by default when `API_KEY` is empty.
- **🧠 10-Year Financial RAG Chatbot:** Ask financial questions by `clientId` OR `clientName`. Automatically pulls verified income, profit, loss, and semantic document vectors.
- **📅 Autonomous Google Meet Scheduling:** Parses dates, times, topics, and attendee emails directly to Google Calendar and generates Meet links.
- **📄 Multiformat Document Ingestion:** Upload files (PDF, Excel, CSV, TXT) via `multipart/form-data` or send raw CSV/JSON text payloads directly.
- **📮 1-Click Postman Collection:** Instant download & import via `GET /api/postman.json`.
- **📄 OpenAPI 3.0 Specification:** Standard OpenAPI 3.0.3 schema at `GET /api/openapi.json` for Swagger UI, Insomnia, or SDK generators.
- **🧪 Interactive API Docs Portal:** Full interactive test console & code generators at `/docs`.

## ⚡ The Single API & Active Master Key

You can interact with this entire project using **ONE Master API Key** and **ONE Single Universal Endpoint**:

- **Master API Key:** `ca_live_541c806cb70ae18dab3721e1e6740c5b`
- **Single Universal Endpoint:** `POST /api/chat` *(or alias: `POST /api/agent`)*
- **Header:** `X-API-Key: ca_live_541c806cb70ae18dab3721e1e6740c5b` (or `Authorization: Bearer ca_live_541c806cb70ae18dab3721e1e6740c5b`)

With just this single endpoint, you can:
1. **Audit 10-Year Client Financials:** Send questions like `"What was Apex Enterprises' profit in 2020?"` — the engine automatically detects the client, pulls verified numbers, semantic embeddings, and generates the audit reply.
2. **Autonomously Schedule Google Meets:** Send `"Schedule an audit meeting on 15 October at 3:00 PM with palanitce@gmail.com"` — it generates the Google Meet link, creates the Google Calendar event, and emails invites automatically!
3. **Query Lead Auditor & Firm Info:** Send `"Who is the auditor?"` — returns CA Keerthiga Sri J.M.'s credentials, firm address, and services.
4. **Discover Clients:** Send `{"action": "list_clients"}` or `"What clients are available?"` — returns registered client IDs and names.

---

## 🚀 Quickstart & Sharing the API

### 1. Running Locally
Ensure your dev server is running:
```bash
npm run dev
```
The API is available at `http://localhost:3000/api`.

### 2. Sharing Over the Internet (Tunnels)
To share your local API with remote devices, clients, or test servers instantly:

#### Using Cloudflare Tunnel (Free, no account needed):
```bash
npx untun@latest tunnel http://localhost:3000
```
#### Using LocalTunnel:
```bash
npx localtunnel --port 3000
```
#### Using ngrok:
```bash
ngrok http 3000
```
Once generated, replace `http://localhost:3000` with your tunnel URL (e.g. `https://xyz-abc.loca.lt`) in your external applications!

### 3. Deploying to Production
You can deploy this repository to any Node.js host that allows persistent server processes:
- **Railway / Render / Fly.io / AWS EC2 / DigitalOcean Droplet**: Set the environment variables from `.env` and run `npm run build && npm run start`.

---

## 🔑 Generating & Sharing API Keys

You can generate custom API keys for your users and client applications directly from the API portal or programmatically:

### 1. Generating Keys via UI
1. Open **[http://localhost:3000/docs](http://localhost:3000/docs)** (or click **🔑 API Keys** in the top navigation).
2. Click **Manage API Keys**.
3. Enter a label/name (e.g. `Client Partner App`, `Mobile App User`) and click **+ Create New API Key**.
4. Click **📋 Copy Key** to copy the generated key (`ca_live_...`).
5. Share this key with your user!

### 2. Generating Keys via API
- **Endpoint:** `POST /api/keys`
- **Request Body:**
  ```json
  { "name": "Mobile Client Application" }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "key": "ca_live_bb816a31e21cc2c6669a827178b6202b",
    "keyRecord": {
      "id": "...",
      "name": "Mobile Client Application",
      "prefix": "ca_live_bb81...202b",
      "isActive": true
    }
  }
  ```

### 3. How Users Use Their Key
Users must attach their key to every API request using either:
```http
X-API-Key: ca_live_your_generated_key_here
```
or
```http
Authorization: Bearer ca_live_your_generated_key_here
```

### 4. Revoking or Deleting Keys
- **Revoke/Deactivate:** `PATCH /api/keys` with `{ "id": "KEY_ID", "isActive": false }`
- **Permanently Delete:** `DELETE /api/keys?id=KEY_ID`


---

## 📡 Endpoints Reference

### 1. API Discovery & Health

#### `GET /api`
Returns service metadata, provider engine (Ollama/Gemini), database status, active auditor profile, and endpoint directory.

#### `GET /api/health`
Lightweight health and latency check for Docker/Kubernetes/Render liveness probes.

---

### 2. Audit Chat & RAG Intelligence

#### `POST /api/chat`
Answers financial questions using verified 10-year client figures and document excerpts, or schedules a Google Meet.

**Request Body (`application/json`):**
```json
{
  "clientName": "Apex Enterprises",
  "message": "What was the total profit over the 10 years, and which year had the highest loss?"
}
```
*Alternatively, you can provide `clientId: "UUID"` and `messages: [{ role: "user", content: "..." }]`.*

**Response (`200 OK`):**
```json
{
  "success": true,
  "reply": "The total profit over the 10 years was ₹5,540,000. The highest loss occurred in FY 2020 with a loss of ₹120,000.",
  "isMeetingAction": false,
  "client": {
    "id": "8432314a-f3c2-4876-90bf-c29013689408",
    "name": "Apex Enterprises",
    "email": "finance@apex.com"
  },
  "citations": [
    "10-YEAR FINANCIAL SUMMARY FOR APEX ENTERPRISES..."
  ],
  "financials": [
    { "year": 2015, "income": 1000000, "profit": 150000, "loss": 0 },
    { "year": 2016, "income": 1200000, "profit": 180000, "loss": 0 }
  ]
}
```

#### Meeting Scheduling via Chat
Send a natural-language booking query to the same endpoint:
```json
{
  "clientName": "Apex Enterprises",
  "message": "Schedule a Google Meet about the FY 2024 tax audit tomorrow at 3 PM for 45 minutes with palanitce@gmail.com"
}
```
The response returns a confirmed meeting status, Google Meet link, and Google Calendar event synchronization!

---

### 3. Document Ingestion & Vector Indexing

#### `POST /api/ingest`
Supports both file uploads (`multipart/form-data`) and direct JSON text payloads.

**Option A: Direct JSON Payload (`application/json`):**
```json
{
  "clientName": "Apex Enterprises",
  "fileName": "audit_10yr.csv",
  "text": "Year,Income,Profit,Loss\n2020,3500000,500000,0\n2021,4200000,650000,0\n2022,4900000,750000,0\n2023,5600000,880000,0\n2024,6500000,1050000,0"
}
```

**Option B: File Upload (`multipart/form-data`):**
- `file`: PDF, Excel (.xlsx/.xls), CSV, or TXT file
- `clientId` or `clientName`: Client identifier

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Successfully ingested and embedded 5 financial years for Apex Enterprises.",
  "client": { "id": "...", "name": "Apex Enterprises", "email": "finance@apex.com" },
  "years": 5,
  "chunks": 8,
  "firstYear": 2020,
  "lastYear": 2024,
  "auditor": "CA Keerthiga Sri J.M."
}
```

---

### 4. Client Registry

#### `GET /api/clients?stats=true`
Lists all registered clients. Pass `stats=true` to include count of audited financial years and document chunks.

#### `POST /api/clients`
Registers a new audit client.
```json
{
  "name": "Zenith Retail Corp",
  "email": "finance@zenithretail.com"
}
```

#### `GET /api/clients/:id`
Fetches a single client with complete 10-year ledger figures and vector chunk stats.

#### `DELETE /api/clients/:id`
Deletes a client and all associated financial records and vector embeddings.

---

### 5. 10-Year Financial Records

#### `GET /api/financials?clientName=Apex%20Enterprises&order=asc`
Retrieves verified 10-year financial rows along with calculated totals (`totalIncome`, `totalProfit`, `totalLoss`, `netProfit`).

#### `POST /api/financials`
Upserts yearly financial figures programmatically.
```json
{
  "clientName": "Apex Enterprises",
  "records": [
    { "year": 2024, "income": 6500000, "profit": 1050000, "loss": 0 },
    { "year": 2023, "income": 5600000, "profit": 880000, "loss": 0 }
  ]
}
```

---

### 6. Google Meet & Calendar Synchronization

#### `POST /api/calendar/sync`
Directly creates or updates an event in Google Calendar with a Google Meet link.
```json
{
  "topic": "10-Year Statutory Audit Review",
  "start": "2026-10-10T14:30:00",
  "durationMinutes": 45,
  "attendees": ["client@apex.com", "palanitce@gmail.com"],
  "action": "create"
}
```

#### `GET /api/calendar/sync?q=Audit`
Searches scheduled consultations.

---

### 7. Email & Voice

#### `POST /api/email/send`
Dispatches branded meeting invite email with RFC 5545 iCalendar (`.ics`) invite.

#### `POST /api/voice/transcribe`
Transcribes audio recordings (`audio/webm` or base64) into text.

---

## 💻 Integration Code Samples

### JavaScript / TypeScript (Using Fetch)
```javascript
const response = await fetch("http://localhost:3000/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // "X-API-Key": "your_api_key_here" // if configured
  },
  body: JSON.stringify({
    clientName: "Apex Enterprises",
    message: "What was the highest profit year in the 10-year records?"
  })
});

const data = await response.json();
console.log("Chatbot Reply:", data.reply);
```

### Python (Using `requests`)
```python
import requests

url = "http://localhost:3000/api/chat"
payload = {
    "clientName": "Apex Enterprises",
    "message": "What was the profit in 2022?"
}

res = requests.post(url, json=payload)
data = res.json()
print("Auditor AI:", data["reply"])
```

### Ready-To-Use Client SDKs in Repository
- **TypeScript / Node.js:** [`sdk/ca-audit-client.ts`](file:///d:/PiBi/ca-audit-chatbot/sdk/ca-audit-client.ts)
- **Python:** [`examples/python_client.py`](file:///d:/PiBi/ca-audit-chatbot/examples/python_client.py)
- **cURL:** [`examples/curl_examples.sh`](file:///d:/PiBi/ca-audit-chatbot/examples/curl_examples.sh)
- **Interactive UI Portal:** Navigate to `http://localhost:3000/docs` in your browser!
