# WorkPilot AI

Static MVP plus optional AI backend.

## Run without AI

Open `index.html` in a browser. The app uses local generators.

## Run with live AI using Groq

From this folder:

```bash
GROQ_API_KEY="your_groq_api_key_here" node server.js
```

Then open:

```text
http://127.0.0.1:8787
```

Optional:

```bash
GROQ_MODEL="llama-3.1-8b-instant" PORT=8787 GROQ_API_KEY="your_groq_api_key_here" node server.js
```

## How it works

- Browser calls `/api/generate`.
- The bottom-right helper calls `/api/assist`.
- `server.js` sends the request to Groq using the secret API key from the server environment.
- The frontend never receives or stores the API key.
- If the server or key is missing, the app falls back to local generation.

## Important before launch

- Add real authentication and database storage.
- Add payment provider integration.
- Add rate limits and abuse protection.
- Add production legal pages and privacy policy.
- Do not put `GROQ_API_KEY` inside frontend JavaScript.
