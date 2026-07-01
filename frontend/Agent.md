# AGENT.md

This file is read by AI coding assistants (Claude Code, Cursor, Copilot, etc.) before making changes to this repository. Follow it strictly.

## Project

Video editor web app (CapCut-style), built with Next.js (App Router) + TypeScript + Tailwind CSS. Runs client-side; video processing may later move to a Web Worker / ffmpeg.wasm or a backend service.

## Core rule: Clean Architecture

Code is organized in layers. Dependencies only point **inward**. Outer layers may depend on inner layers; inner layers must never import from outer layers.

```
┌──────────────────────────────────────────┐
│ Frameworks & Drivers (outermost)          │  Next.js pages/routes, React components,
│                                            │  DOM/video APIs, ffmpeg.wasm, HTTP clients
├──────────────────────────────────────────┤
│ Interface Adapters                        │  Hooks, controllers/presenters, mappers,
│                                            │  state stores, DTOs <-> domain converters
├──────────────────────────────────────────┤
│ Application / Use Cases                   │  splitClip(), deleteClip(), exportProject()
│                                            │  orchestration logic, no framework imports
├──────────────────────────────────────────┤
│ Domain / Entities (innermost)             │  Clip, Project, Track — pure business rules,
│                                            │  zero dependencies on React, Next.js, DOM
└──────────────────────────────────────────┘
```

### Folder structure

```
frontend/
  app/                      # Next.js routing only — no business logic
    page.tsx
    layout.tsx

  src/
    domain/                 # Innermost layer. Pure TypeScript, no imports from
      entities/              # outer layers, no React/Next/DOM/browser APIs.
        Clip.ts
        Project.ts
      value-objects/
        Timecode.ts
      errors/
        DomainError.ts

    application/             # Use cases. Depend only on domain + repository
      use-cases/              # interfaces (never concrete implementations).
        SplitClip.ts
        DeleteClip.ts
        ExportProject.ts
      ports/                  # Interfaces the outer layer must implement
        VideoRepository.ts
        ExportService.ts

    adapters/                 # Glue between application and frameworks
      presenters/
        ClipPresenter.ts
      stores/                 # Zustand/Redux/Context state, maps domain <-> UI state
        useEditorStore.ts
      mappers/
        clipMapper.ts

    infrastructure/            # Concrete implementations of ports; framework/browser specific
      video/
        BrowserVideoRepository.ts   # implements VideoRepository using <video>/File API
      export/
        FfmpegExportService.ts      # implements ExportService using ffmpeg.wasm

    components/                 # "Frameworks & Drivers" — React only, no business logic
      VideoEditor.tsx
      Toolbar.tsx
      PreviewPlayer.tsx
      Timeline.tsx

    lib/                        # Small framework-agnostic utilities (formatting, math)
      formatTimecode.ts
```

### Layer rules (non-negotiable)

1. **`domain/`** — Plain TypeScript classes/functions and types only.
   - No `"use client"`, no React, no Next.js, no `fetch`, no DOM, no `File`/`Blob` APIs.
   - Contains entities (`Clip`, `Project`, `Track`) and their invariants (e.g. "a clip's `end` must be greater than its `start`", "splitting requires the split point to be strictly inside the clip").
   - Must be testable with plain unit tests and zero mocking.

2. **`application/`** — Use cases that orchestrate domain entities to fulfil one user intent each (`SplitClip`, `DeleteClip`, `ExportProject`).
   - Depends on `domain/` and on **interfaces** defined in `application/ports/`, never on concrete infrastructure.
   - No React, no Next.js, no direct `ffmpeg` or browser API calls.
   - One class/function per use case. Input and output are plain data (DTOs), not React state.

3. **`adapters/`** — Translates between the UI world and the application/domain world.
   - State stores (Zustand, Context, Redux) live here, not inside components.
   - Presenters/mappers convert domain entities to view models (e.g. pixel positions, formatted timecodes) and back.
   - May import from `application/` and `domain/`. Must not be imported by them.

4. **`infrastructure/`** — Concrete implementations of the interfaces (`ports`) declared in `application/`.
   - This is the only layer allowed to talk to `<video>`, `File`/`Blob`, `ffmpeg.wasm`, `localStorage`, or any external API.
   - Swappable: e.g. `BrowserVideoRepository` today, a server-based one later, without touching `application/` or `domain/`.

5. **`components/` and `app/`** — React/Next.js only. Thin.
   - Components call use cases through hooks/stores in `adapters/`, never construct domain logic inline.
   - No business rules in `.tsx` files (no clip-splitting math, no validation logic inside a component body).
   - A component decides *when* to call something; it never decides *how* the domain rule works.

### Dependency direction checklist (verify before committing)

- [ ] Does anything in `domain/` import from `application/`, `adapters/`, `infrastructure/`, `components/`, React, or Next.js? → **Forbidden. Fix it.**
- [ ] Does anything in `application/` import a concrete class from `infrastructure/`? → **Forbidden.** Depend on the `ports/` interface instead, inject the implementation from the outside (constructor/factory in `adapters/` or `app/`).
- [ ] Does a `.tsx` component contain domain logic (splitting math, validation, id generation)? → **Move it to `domain/` or `application/`.**
- [ ] Is a new business rule about to be added directly inside a store or component? → **Put it in `domain/entities` or a use case instead**, then call it from the store/component.

### Example: how "split a clip" should be wired

```
components/Timeline.tsx
  -> calls useEditorStore().splitClipAt(time)         (adapters/stores)
       -> calls SplitClip use case (application/use-cases/SplitClip.ts)
            -> operates on Clip entity (domain/entities/Clip.ts)
            -> returns new Clip[] (plain data)
       -> store maps result into UI state, triggers re-render
```

`SplitClip.ts` (application layer) never imports React. `Clip.ts` (domain layer) never imports `SplitClip.ts` or anything else outward.

## Additional conventions

- **TypeScript strict mode** stays on. No `any` unless justified with a comment.
- **Naming**: use cases are verbs (`SplitClip`, `ExportProject`); entities are nouns (`Clip`, `Project`); ports are interfaces suffixed by role (`VideoRepository`, `ExportService`).
- **Testing**: `domain/` and `application/` should have unit tests with no mocking of browser APIs required. `infrastructure/` gets integration tests / manual verification.
- **No premature abstraction**: if a port only ever has one real implementation, still define the interface once business logic depends on it — but don't split trivial UI-only components into layers they don't need.
- **Styling**: Tailwind utility classes stay in `components/`; never leak class name logic into `domain/` or `application/`.
- **State**: no business calculations inside `useState`/`useEffect` bodies — call a use case and store the result.

## Before opening a PR / finishing a task

1. Re-check the dependency direction checklist above.
2. Confirm new business logic lives in `domain/` or `application/`, not in a component or store.
3. Run `npm run build` and `npm run lint` — both must pass.
4. If you added a new port (interface) in `application/ports/`, confirm there's a matching implementation in `infrastructure/` and that it's wired up in `adapters/` or `app/`, not imported directly into `application/`.