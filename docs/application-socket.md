# Socket.IO application channel

The API can expose Socket.IO at `/api/v1/socket.io` when
`APPLICATION_SOCKET_ENABLED=true`. It defaults off. The channel accepts
WebSocket transport from the configured `CORS_ORIGINS` and authenticates with a
fresh Better Auth session. Connections close at session expiry or after five
minutes, whichever comes first. The client will need to reconnect and
authenticate again after a server-initiated disconnect.

The channel currently only establishes a connection. TranslationKey realtime
continues to use its authenticated SSE endpoint. This change does not deploy or
enable Socket.IO in production.

Before adding notifications or support chat, authorize each operation and
delivery against current access. Derive room membership on the server.
Persist messages and notifications in the database and fetch missed items on
reconnect. For more than one API replica, use a shared Socket.IO adapter for
cross-replica delivery. Verify WebSocket upgrades and origin checks through
the deployment proxy before enabling the flag.
