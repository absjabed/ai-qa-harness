# {{PROJECT}} — local paths (optional)

Only what the team has. The context-builder asks for these in its inventory step and checks it can read each
one before relying on it. Paths only — never a connection string or a password.

| Source | Local path | Notes |
|---|---|---|
| Application source code | | Read for validation rules, states, error conditions |
| API documentation — OpenAPI / Swagger file | | |
| Database schema scripts | | |
| Integration contracts | | |
| Documents too large or too confidential to keep in `context/sources/` | | |
