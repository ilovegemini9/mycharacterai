# mycharacter

A dark-fantasy character discovery and chat frontend built with React, TypeScript, Vite, and Wouter.

## Current experience
- Discover characters and filter by genre or search
- Open a character conversation with a starter greeting and message composer
- Save characters and revisit chats during the current page session
- Create custom characters with name, role, description, greeting, and category
- Responsive layout for desktop and mobile

## Run locally
```bash
pnpm install
pnpm dev
```

## Demo limitation
This commit creates the frontend experience. Chat replies are currently demo placeholders, and custom characters are held in page state. A real AI provider, persistent database, authentication, image uploads, and publishing flow must be connected before production use.

## Build checks
```bash
pnpm check
pnpm build
```
