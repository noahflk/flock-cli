# Flock API

Base URL: `http://localhost:{port}`

All routes except `/health` require the `x-flock-secret` header. Rate limited to 120 req/min per IP.

Errors return `{ code, message, cause? }`.

---

## Health

### `GET /health`

No auth required.

**Response** `200`

```json
{ "ok": true }
```

---

## Repos

### `GET /repos`

**Response** `200`

```json
{
  "repos": [
    { "name": "my-repo", "path": "/path/to/repo", "origin": "git@..." }
  ]
}
```

### `POST /repos`

Clone a repository using a GitHub slug (`owner/repo`).

**Request**

```json
{
  "slug": "acme/widget"
}
```

**Response** `201`

```json
{
  "name": "widget",
  "path": "/home/you/repos/widget"
}
```

---

## Sessions

### `GET /sessions`

| Query Param | Type   | Description                                      |
| ----------- | ------ | ------------------------------------------------ |
| `repo`      | string | Filter by repo name                              |
| `status`    | string | Comma-separated: `idle`, `running`, `archived`   |

**Response** `200`

```json
{
  "sessions": [
    {
      "id": "uuid",
      "type": "local | worktree",
      "repo": "my-repo",
      "workspaceName": "feature-x",
      "status": "idle",
      "model": "claude",
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000,
      "messageCount": 5
    }
  ]
}
```

### `POST /sessions`

**Request**

```json
{
  "repo": "my-repo",
  "type": "local | worktree",
  "model": "claude | codex"
}
```

`model` defaults to `"claude"`.

**Response** `201` — returns `SessionSummary` (same shape as list item above).

### `DELETE /sessions/{sessionId}`

Archives a session.

| Query Param | Type    | Description                              |
| ----------- | ------- | ---------------------------------------- |
| `force`     | boolean | Force archive even with uncommitted work |

Returns `409` if running, or if worktree has uncommitted changes and `force` is not set.

**Response** `200`

```json
{ "id": "uuid", "archived": true, "warnings": [] }
```

---

## Messages

### `GET /sessions/{sessionId}/messages`

| Query Param | Type | Default | Description |
| ----------- | ---- | ------- | ----------- |
| `limit`     | int  | 50      | Page size   |
| `offset`    | int  | 0       | Page offset |

**Response** `200`

```json
{
  "messages": [
    { "id": "uuid", "role": "user | assistant", "content": "...", "createdAt": 1700000000000 }
  ],
  "total": 42
}
```

Assistant failures are returned as ordinary `assistant` messages. There is no separate error field; failed runs use `content` prefixed with `[ERROR] `.

### `POST /sessions/{sessionId}/messages`

Dispatches a message. The assistant response is generated asynchronously.

**Request**

```json
{ "content": "your prompt here" }
```

**Response** `202`

```json
{
  "userMessage": { "id": "uuid", "role": "user", "content": "...", "createdAt": 1700000000000 },
  "status": "running"
}
```

Poll `GET /sessions/{sessionId}/messages` for the assistant reply. If the run fails, the eventual assistant message will look like `{ "role": "assistant", "content": "[ERROR] ..." }`.

Returns `409` if session is archived or already running (`SESSION_BUSY`).

### `POST /sessions/{sessionId}/cancel`

Cancels a running message.

**Response** `200`

```json
{ "id": "uuid", "cancelled": true }
```

Returns `404` if no running process for the session.
