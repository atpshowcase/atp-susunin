# ATP Susunin

ATP Susunin is an open-source browser video editor with a Next.js frontend and a Go backend for native FFmpeg exports.

## Features

- Upload and preview local video files in the browser.
- Split, reorder, and delete timeline clips.
- Add text overlays with layer-aware placement.
- Export edited videos through the Go FFmpeg service.
- Environment-specific configuration for development, staging, and production.

## Architecture

The project follows a lightweight clean architecture layout.

- `domain`: pure business rules and types.
- `application`: use cases and ports.
- `infrastructure`: external adapters such as FFmpeg, file storage, and HTTP clients.
- `transport`: delivery adapters such as the backend HTTP API.
- `app` / composition root: wires configuration and dependencies together.

## Requirements

- Go 1.21+
- Node.js 20+
- npm
- Docker and Docker Compose for containerized backend runs
- FFmpeg when running the backend outside Docker

## Environment

Root environment files are provided for backend and Docker Compose:

- `.env.dev`
- `.env.stag`
- `.env.prod`
- `.env.example`

Frontend environment files live in `frontend/` because Next.js loads public variables from the application directory:

- `frontend/.env.development`
- `frontend/.env.staging`
- `frontend/.env.production`
- `frontend/.env.example`

Replace the example staging and production URLs before deploying.

## Local Development

Start the backend with Docker:

```bash
docker compose --env-file .env.dev up --build
```

Use `.env.stag` or `.env.prod` in the same command to switch backend configuration for staging or production-like runs.

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

For staging frontend runs:

```bash
npm run dev:staging
npm run build:staging
```

The frontend runs on `http://localhost:3000` and talks to the backend URL configured by `NEXT_PUBLIC_EXPORT_API_URL`.

## Backend Without Docker

```bash
cd backend
go run ./...
```

Make sure `BACKEND_PORT`, `CORS_ALLOWED_ORIGINS`, `FFMPEG_BINARY`, and `EXPORT_FONT_PATHS` are set in your shell when you do not use Docker Compose.

## Validation

```bash
cd backend
go test ./...

cd ../frontend
npm run typecheck
npm run build
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.

## License

ATP Susunin is released under the [MIT License](LICENSE).
