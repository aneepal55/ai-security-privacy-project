# AI Security & Privacy Chat

A Next.js chat interface with an API route ready for a retrieval-augmented generation pipeline.

## Local chat with Ollama

The chat page can send conversations to either Llama 3.2 or Mistral running locally through Ollama. Install Ollama, then download the models:

```bash
ollama pull llama3.2
ollama pull mistral
```

Keep Ollama running, then start the app:

```bash
npm run dev
```

Choose a model from the selector in the chat header. Ollama listens at `http://127.0.0.1:11434` by default. To use a different Ollama host, set `OLLAMA_BASE_URL` in a local `.env.local` file (for example, `OLLAMA_BASE_URL=http://127.0.0.1:11434`). This setting is server-side and is not exposed to the browser.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.
