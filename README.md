# Harsh's Journal

A private archive of my life. React + TypeScript (frontend), Express + MongoDB (backend).


just personal project not intended for anything

## Structure

    backend/
      config/       env + database + cloudinary settings
      controller/   request handlers
      models/       Mongoose schemas
      routes/       URL -> controller wiring
      utility/      middleware and helpers
      server.ts     app entry

    frontend/
      src/
        api/        api.ts (main axios instance) + one file per feature
        components/ reusable UI
        config/     theme and constants
        pages/      one file per screen
        App.tsx
        index.css   design tokens
        main.tsx    Vite entry (required)

## Run it (two terminals)

Backend:

    cd backend
    cp .env.example .env
    npm install
    npm run dev

Frontend:

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173

## Checks

    cd backend && npm run typecheck
    cd frontend && npx tsc -b
