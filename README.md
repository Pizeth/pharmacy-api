# Pharmacy API

NestJS and TypeScript backend for the [Pharmacy Client](https://github.com/Pizeth/pharmacy-client). It serves the Razeth HR portal and its administration tools.

- Better Auth sessions and CASL authorization.
- Document tracking, workflow history, and attachments.
- Administration APIs for users, roles, translation keys, and social providers.
- PostgreSQL persistence through Prisma and server-side queries for admin tables.

## Local development

Use Node.js 22, npm, and a development PostgreSQL database. Set `DATABASE_URL` for Prisma, `BETTER_AUTH_SECRET` for session signing, `BETTER_AUTH_URL` to the API origin, and `FRONTEND_URL` to the permitted client origin. Configure any additional integrations required by the feature you are developing through your local environment or secret manager.

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

The API defaults to port 3000. Point the client at `http://localhost:3000` and allow `http://localhost:8080` as the frontend origin. Run migrations against your development database.

Run `npm test` for the unit suite and `npm run build` for a production build. Read [AGENTS.md](AGENTS.md) for contribution and deployment rules.

## License

The project source code is available under the [MIT License](LICENSE). Third-party components and assets retain their respective licenses.
