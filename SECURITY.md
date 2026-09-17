# Security Policy

## The threat model, stated plainly

This project gives an MCP client **full interactive control of a Windows PC**:
screen, keyboard, filesystem, registry, and an unrestricted PowerShell.

**Whoever holds a machine's token can do anything that user account can do.**
Treat the tokens in `machine.json` exactly like you would treat the password to
that computer.

## What is *not* a security boundary

- **The `run_command` denylist.** It exists to catch fat-fingered `rm -rf /`
  style mistakes. It is a regex list applied to a string that is then handed to
  a shell, so it loses to `-enc <base64>`, caret escaping (`sh^utdown`),
  `cd ..`, and any number of rewrites. Do not build access-control on it.
- **`BRIDGE_READONLY=1`.** It blocks the write tools in this bridge. It does
  not sandbox the desktop channel, which can still type into any application.
- **Obscurity of the hostname.** Cloudflare hostnames are enumerable via
  Certificate Transparency logs. Assume the URL is public.

## What actually protects you

1. **The bearer token.** 32 bytes of `secrets.token_urlsafe`, compared in
   constant time, required on every endpoint except `/` and `/health`.
2. **DNS-rebinding protection.** `BRIDGE_ALLOWED_HOSTS` / `BRIDGE_ALLOWED_ORIGINS`
   are injected per machine; a request with an unexpected `Host` gets a 421.
3. **Cloudflare Access** in front of the hostname — strongly recommended. This
   is the only layer that stops an attacker who already has the token.
4. **Per-machine tokens.** A leak is contained to one box.

## Handling tokens

- `machine.json`, `tunnel.json`, `config.yml`, `cert.pem` and `.bridge_token`
  are gitignored. Keep them that way.
- Tokens are passed to child processes via **environment variables**, never on
  the command line, because `argv` is readable by any process on the machine.
- The startup banner prints only a fingerprint (`abcd...wxyz`).
- `?token=` query-string auth was removed in v1.1: query strings are recorded
  in uvicorn's access log and in Cloudflare's logs.

## Rotating a token

```cmd
:: edit C:\mcp-bridge\machine.json, replace bridge_token / desktop_token
C:\mcp-bridge\launch.cmd restart
```

Old tokens stop working immediately. Update your `machines.json` fleet list.

## Reporting a vulnerability

Open a GitHub issue for anything non-sensitive. For something that would put
existing users at risk, use GitHub's **private vulnerability reporting**
(Security → Report a vulnerability) instead of a public issue.

Please include the version/commit, what you observed, and a reproduction if you
have one. This is a hobby project maintained in spare time — expect a reply in
days, not hours.
