# Contributing

Thanks for helping improve ATP Susunin.

## Development Guidelines

- Keep domain logic framework-free and side-effect-free.
- Put use cases in `application` and external integrations in `infrastructure`.
- Read configuration from environment variables through the config layer.
- Prefer small, focused pull requests.
- Add tests when changing domain rules, application behavior, or API contracts.
- Keep public documentation and code comments in English.

## Pull Request Checklist

- The change is scoped to one feature, fix, or refactor.
- Backend code passes `go test ./...`.
- Frontend code passes `npm run typecheck`.
- Environment variables are documented in `.env.example` when added.
- Public-facing behavior is reflected in `README.md` when relevant.

## Reporting Issues

Please include:

- What you expected to happen.
- What happened instead.
- Steps to reproduce.
- Operating system, browser, Node.js version, Go version, and FFmpeg version when relevant.
