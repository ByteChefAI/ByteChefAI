# AI Fridge Chef

A Progressive Web App prototype for a fridge-based meal planner and budget-friendly recipe generator.

## Features

- Upload a photo of your fridge or type ingredients manually
- Instant AI-style recipe generation and step-by-step cooking mode
- Fake premium subscription flow for grocery lists, meal plans, and calorie guidance
- Offline caching with service worker support
- Installable PWA experience with manifest and icons

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and add your Groq AI API key:

```bash
cp .env.example .env
```

3. Start the app:

```bash
npm start
```

4. Open the app in your browser:

```bash
http://localhost:3000
```

If port `3000` is busy, the app will automatically try the next free port.

## Files

- `index.html` — main user interface
- `styles.css` — responsive styling
- `app.js` — app interactions and recipe simulation
- `manifest.json` — PWA metadata
- `service-worker.js` — offline caching and network fallback
- `server.js` — Express server for local hosting

## Notes

- The recipe generator is a mock demo; you can replace it with a real AI backend later.
- The subscription flow is a placeholder for later payment API integration.
- The app supports install and offline use through the service worker.

