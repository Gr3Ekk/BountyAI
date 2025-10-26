# ☁️ BountyAI Cloudflare Worker

Serverless Worker that powers the Launch Copilot by proxying to Cloudflare Workers AI using the `@cf/meta/llama-3.1-8b-instruct-fp8-fast` model with dual-pass safety checks from `@cf/meta/llama-guard-3-8b`.

## 📦 Prerequisites

- Node.js 20+
- npm 10+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) credentials configured (`wrangler login`)
- A Cloudflare account with Workers AI enabled

## ⚙️ Environment Variables

This worker expects the following secrets/bindings:

| Name | Type | Purpose |
| --- | --- | --- |
| `AI` | [Workers AI binding](https://developers.cloudflare.com/workers-ai/get-started/bindings/) | Grants access to the Workers AI API. Configured automatically by Wrangler via `[ai]` in `wrangler.toml`. |
| `WORKER_AUTH_TOKEN` | Secret (optional) | Shared bearer token checked against the `Authorization: Bearer <token>` header. Leave unset to allow anonymous access. |

Configure the optional secret:

```bash
cd cloudflare
wrangler secret put WORKER_AUTH_TOKEN
```

## 🚀 Local Development

```bash
cd cloudflare
npm install
npm run dev
```

The development server exposes the worker at `http://127.0.0.1:8787`. Point `VITE_CLOUDFLARE_WORKER_URL` in the frontend `.env` file to this address for local testing.

## ☁️ Deployment

```bash
cd cloudflare
npm run deploy
```

Deployment prints the production URL (for example `https://bountyai-launch-copilot.your-account.workers.dev`). Copy that URL into `frontend/.env` as `VITE_CLOUDFLARE_WORKER_URL` so the Manager Copilot talks to the live worker.

## 🧠 Model Contract

- **Primary model**: `@cf/meta/llama-3.1-8b-instruct-fp8-fast`
- **Safety model**: `@cf/meta/llama-guard-3-8b` (runs on user input and assistant output)
- **Response format**: JSON object containing `reply`, optional `insights`, optional `recommendation`, optional `references`.
- **Context enrichment**: Mission metadata and attachment summaries are injected as system messages before relaying the manager conversation.

The worker enforces safety checks and propagates descriptive errors if a request is blocked by Llama Guard or if the AI response cannot be parsed.

## 📊 Neuron Budget Tips

- A typical turn (1.2k prompt + 400 completion tokens) consumes ~19 neurons. The Workers Free plan grants 10,000 neurons/day (~520 turns).
- Mission context and attachments increase prompt length—trim large notes or disable attachment summaries if you approach the free-tier ceiling.
- Wrangler logs include usage metrics; monitor the [Workers AI dashboard](https://dash.cloudflare.com/) for daily consumption.

## 🔁 API Contract (Frontend ⇄ Worker)

**Request** `POST /`
```json
{
  "messages": [
    { "role": "user", "content": "Draft a briefing" }
  ],
  "missionContext": {
    "projectTitle": "Launch deck refresh",
    "candidateTeams": [
      { "teamId": "team_alpha", "teamName": "Alpha Pilots", "skillMatch": 0.9 }
    ]
  }
}
```

**Response** `200 OK`
```json
{
  "reply": "Recommended next steps...",
  "insights": [
    {
      "id": "squad-alpha",
      "title": "Alpha Pilots fit",
      "detail": "Skill match 90% · capacity 2",
      "priority": "success"
    }
  ],
  "recommendation": {
    "teamId": "team_alpha",
    "teamName": "Alpha Pilots",
    "confidence": 0.88,
    "summary": "Strong alignment on UI/UX"
  }
}
```

Errors include `400` (invalid payload), `401` (auth failed), `503` (safety block), and `500` (model/parsing errors).
