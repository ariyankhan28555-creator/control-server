# Bypass AI Pro

A self-hosted, multi-provider AI assistant with a futuristic web interface, voice input/output, web research and server-side key management.

This project uses legitimate provider APIs. It does not bypass access controls, subscription limits or security mechanisms of any third-party service.

## Features

- **AI providers:** Groq, Google Gemini (native API), DeepSeek, OpenRouter (OpenAI-compatible).
- **Switching:** change provider, model and fallback chain from Settings. Keys never leave the server.
- **Streaming:** Server-Sent Events for token-by-token replies; non-streaming mode also supported.
- **Personality:** Hindi, Hinglish and English; Jarvis / Friend / Expert / Creative presets; editable system prompt.
- **Voice:** Web Speech recognition (English + Hindi), ElevenLabs TTS with voice and speed controls, browser speech fallback, stop button, continuous conversation mode.
- **Research:** Tavily search, advanced/deep mode, AI summaries, numbered source chips with URLs.
- **Interface:** dark futuristic theme, responsive mobile/Android/desktop layout, sidebar history, new/delete/clear chat, markdown with code copy buttons, loading and streaming indicators.
- **Server:** Express + helmet + CORS allowlist + rate limits + validation + centralised error handling + health check.

## Project structure

```
bypass-ai-pro/
├── server.js                 Express app and bootstrap
├── config/
│   ├── config.js             Environment-driven constants and catalogs
│   └── settings.js           Server-side settings/secret store
├── middleware/
│   ├── rateLimiter.js        Per-endpoint rate limits
│   └── errorHandler.js       Validation, AppError, redaction, 404
├── routes/
│   ├── health.js             GET /api/health
│   ├── config.js             GET/PUT/PATCH/DELETE /api/config, voices
│   ├── chat.js               POST /api/chat (SSE + JSON)
│   ├── search.js             POST /api/search, POST /api/search/research
│   └── tts.js                POST /api/tts, GET /api/tts/voices
├── services/
│   ├── aiService.js          System prompt, sources, fallback orchestration
│   ├── searchService.js      Tavily client
│   ├── ttsService.js         ElevenLabs client
│   └── providers/            Groq, Gemini, DeepSeek, OpenRouter, factory
├── utils/                    Validation and provider error helpers
├── public/                   index.html, style.css, app.js
├── deploy/                   nginx and Render examples
├── Dockerfile
├── .env.example
└── README.md
```

## 1. Install

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y nodejs npm git
node --version
git clone <your-repository-url> bypass-ai-pro
cd bypass-ai-pro
cp .env.example .env
npm install
```

Requires Node.js 18.17+ (Node 20 recommended). If your distro ships an old version:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Windows (PowerShell)

```powershell
winget install OpenJS.NodeJS.LTS
git clone <your-repository-url> bypass-ai-pro
cd bypass-ai-pro
copy .env.example .env
npm install
npm start
```

Open `http://localhost:3000`. If you installed Node with the `.msi`, restart PowerShell so `node` and `npm` are on PATH.

### Android — Termux

```bash
pkg update -y
pkg upgrade -y
pkg install -y nodejs git termux-api
termux-setup-storage
cd ~/storage/shared
git clone <your-repository-url> bypass-ai-pro
cd bypass-ai-pro
cp .env.example .env
npm install
npm start
```

Then open **Chrome** on the phone and visit `http://localhost:3000` (the server and browser are on the same device). To reach it from another device on the same Wi-Fi, find the phone IP with `ifconfig` or `ip addr` and open `http://<phone-ip>:3000`.

Notes:

- Termux may assign the app a restricted port range on some Android versions. If port 3000 is refused, try `PORT=8080 npm start` and open `http://localhost:8080`.
- Keep Termux awake while using the app (`termux-wake-lock`), or the server may be suspended.
- For editing `.env`, use `nano .env` (install with `pkg install nano`).
- Microphone access in Chrome on Android requires HTTPS or localhost. `localhost` is treated as a secure context, so voice input works locally.

## 2. Configure API keys

You can either edit `.env` before starting, or open the app and use **Settings**. Keys submitted in Settings are written only to `data/settings.json` on the server (mode `0600`) and are never returned to the browser. The browser only receives booleans such as `"groq": true`.

Example `.env`:

```env
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
ELEVENLABS_API_KEY=sk_...
```

Get keys from:

- Groq: https://console.groq.com/keys
- Google Gemini: https://aistudio.google.com/app/apikey
- DeepSeek: https://platform.deepseek.com/api_keys
- OpenRouter: https://openrouter.ai/keys
- Tavily: https://tavily.com/
- ElevenLabs: https://elevenlabs.io/app/settings/api-keys

Restart the server after editing `.env`. Settings saved through the UI apply immediately.

### Provider-specific notes

- **Gemini** uses the native `generateContent` / `streamGenerateContent` API. It maps system instructions to `systemInstruction` and assistant messages to the `model` role. Some Gemini models expose a thinking budget; the app uses defaults that work across current models.
- **Groq, DeepSeek and OpenRouter** use OpenAI-compatible chat-completion endpoints. OpenRouter model IDs are namespaced, for example `openai/gpt-4o-mini`, and must be enabled in your OpenRouter account.
- **DeepSeek `deepseek-reasoner`** returns reasoning separately in some responses; only the final answer text is displayed.
- **Availability and model names change.** If a model is retired, choose another from Settings or edit the catalog in `config/config.js`. The server does not hard-code paid access or bypass quotas.
- **Tavily** free tiers have request limits. Deep research performs up to three searches; reduce usage or use basic mode if you hit limits.
- **ElevenLabs** requires credits and a valid voice ID. Without a key the app falls back to the browser's SpeechSynthesis API, which varies by device and browser.
- **Speech recognition** depends on the Web Speech API. Chrome and Edge support it best; Safari/Firefox support is partial. Hindi recognition requires the `hi-IN` option.

## 3. Run

```bash
npm start
```

Development with auto-restart:

```bash
npm run dev
```

Syntax check:

```bash
npm run check
```

Mobile full control (start/stop/restart even when the main server is down):

```bash
CONTROL_TOKEN=my-long-random-token npm run control
```

The control daemon listens on `CONTROL_PORT` (default `3100`) and keeps the main server alive. Every control request must send `x-control-token: my-long-random-token` (or `Authorization: Bearer ...`). Without `CONTROL_TOKEN`, control is limited to localhost.

```bash
curl -H 'x-control-token: my-long-random-token' http://PHONE_IP:3100/status
curl -H 'x-control-token: my-long-random-token' -X POST http://PHONE_IP:3100/start
curl -H 'x-control-token: my-long-random-token' -X POST http://PHONE_IP:3100/stop
curl -H 'x-control-token: my-long-random-token' -X POST http://PHONE_IP:3100/restart
curl -H 'x-control-token: my-long-random-token' http://PHONE_IP:3100/logs?lines=100
```

The main server also exposes the same token-protected controls at `/api/system/*`.

Health check:

```bash
curl http://localhost:3000/api/health
```

## 4. API reference

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Status, uptime, configured providers |
| GET | `/api/system/status` | Token-protected process/runtime status |
| GET | `/api/system/logs` | Token-protected recent logs |
| POST | `/api/system/restart` | Token-protected graceful restart |
| POST | `/api/system/shutdown` | Token-protected graceful stop |
| GET | `/api/config` | Public settings, key-presence flags, catalogs |
| PUT/PATCH | `/api/config` | Update settings and/or keys |
| DELETE | `/api/config` | Reset non-secret settings |
| GET | `/api/config/voices` | List ElevenLabs voices |
| POST | `/api/chat` | Chat; JSON or SSE depending on `stream` |
| POST | `/api/search` | Tavily web search |
| POST | `/api/search/research` | Search + AI summary |
| POST | `/api/tts` | Text to MP3 stream |
| GET | `/api/tts/voices` | List ElevenLabs voices |

Chat request:

```json
{
  "messages": [{ "role": "user", "content": "Namaste, how are you?" }],
  "sources": [],
  "stream": true
}
```

With `stream: true` the response is `text/event-stream` with events:

```
data: {"type":"delta","text":"Namaste"}
data: {"type":"done","text":"Namaste! ...","provider":"groq","model":"llama-3.3-70b-versatile"}
```

## 5. Production and HTTPS

`localhost` is a loopback address, not a public HTTPS URL. To use the app from the internet you need a public host, a domain and a TLS certificate.

### Option A — Render (fastest)

1. Push the project to GitHub/GitLab.
2. Create a Web Service and select `deploy/render.yaml`, or create manually with build `npm install` and start `npm start`.
3. Add your API keys as environment variables in the Render dashboard.
4. Set `NODE_ENV=production`, `TRUST_PROXY=true` and a health check path of `/api/health`.
5. Render provides a real HTTPS URL such as `https://bypass-ai-pro.onrender.com`.

Set `APP_URL` to that HTTPS URL so OpenRouter receives a correct referer.

### Option B — Railway / Fly.io / similar

Any Node host works: set the build command to `npm install`, start command to `npm start`, expose the container port `3000`, set `PORT`, and add secrets via the platform's secret manager. Set the health check to `/api/health`. These platforms also issue HTTPS URLs.

### Option C — VPS with nginx + Let's Encrypt

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d ai.example.com
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/bypass-ai-pro
sudo ln -s /etc/nginx/sites-available/bypass-ai-pro /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Update the domain and certificate paths in the config first. Run the app behind a process manager:

```bash
npm install -g pm2
pm2 start server.js --name bypass-ai-pro
pm2 save && pm2 startup
```

Then set these environment variables for production:

```env
NODE_ENV=production
TRUST_PROXY=true
APP_URL=https://ai.example.com
CORS_ORIGINS=https://ai.example.com
```

`CORS_ORIGINS` is only needed if a separate frontend origin calls this API. When empty, same-origin is used.

### Docker

```bash
docker build -t bypass-ai-pro .
docker run -d --name bypass-ai -p 3000:3000 --env-file .env bypass-ai-pro
```

Terminate TLS at nginx or a platform load balancer; do not expose Node directly to the internet.

## 6. Security checklist

- Keep API keys in environment variables or `data/settings.json`; never commit `.env`.
- Never paste keys into chat messages, logs or screenshots. The server redacts known secrets from error messages.
- Use HTTPS in production and enable HSTS at the reverse proxy.
- Set `TRUST_PROXY=true` behind a proxy so rate limiting sees real client IPs.
- Restrict `CORS_ORIGINS` to your own domains.
- Keep rate limits enabled; tighten them for public deployments.
- Run the app as a non-root user (the Dockerfile does this).
- Back up `data/settings.json` securely if you rely on UI-entered keys, or manage keys via environment secrets instead.
- On ephemeral platforms (Render free tier, many containers), UI-saved settings may not survive redeploys. Prefer environment variables there.
- Update dependencies regularly with `npm audit` and `npm update`.

## 7. Extending

- Add a provider: create a class in `services/providers/`, register it in `services/providers/index.js`, add constants in `config/config.js`, and add its key field in `config/settings.js` plus the Settings UI.
- Add an engine-specific limitation: override `buildRequest`, `extractText` or `parseDeltaPayload` in that provider class.
- Change rate limits or timeouts via environment variables without touching code.

## License

Use responsibly with valid API credentials and in accordance with each provider's terms of service.
