# remix-express-vite-plugin

## Description

This repo contains the following packages:

- [`remix-express-dev-server`](./packages/remix-express-dev-server)
- [`remix-create-express-app`](./packages/remix-create-express-app)

These two packages work hand-in-hand to enable you to bundle your Express app
with your Remix app via _entry.server.tsx_. The Vite plugin manages the development
server and passes requests to your Express app.

## Installation

Install the following npm packages

```bash
npm install -D remix-express-dev-server
npm install remix-create-express-app
```

## Configuration

See the individual README files for more instructions.

## Example

There's also an example app showing how to configure the Vite plugin and
create the Express app.

- [`remix-vite-express`](./example/remix-vite-express)
