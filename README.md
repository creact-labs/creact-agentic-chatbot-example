# @creact-labs/agentic-chatbot-example

A chat agent built with [CReact](https://github.com/creact-labs/creact).

## Features

- Web chat interface
- Conversation memory (persists across messages)
- Tool use (DuckDuckGo search, web browsing)
- Markdown rendering

## Setup

```bash
npm install
```

Create `.env` with your OpenAI API key:

```
OPENAI_API_KEY=sk-...
```

## Run

```bash
npm run dev
```

Open http://localhost:3000

## Project Structure

```
src/
├── components/
│   ├── chat/          # Chat handler, model, response
│   ├── completion/    # OpenAI completion
│   ├── memory/        # Conversation memory
│   ├── message/       # Message component
│   ├── server/        # HTTP server
│   └── tools/         # DuckDuckGo, Browser, Tool provider
├── providers/
│   ├── handlers/      # Resource handlers (http, completion, memory, chat)
│   ├── Provider.ts    # Main provider
│   └── FileBackend.ts # State persistence
└── app.tsx            # Entry point
```

## License

Apache-2.0
