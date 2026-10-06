# Examples

Run from the repository root after `npm install`. These examples use the existing RakNet transport (`DEFAULT`) and Microsoft device-code authentication. Use your own account and a server you have permission to access. Cached authentication lives in the ignored `auth/` folder; never upload it.

Set `BEDROCK_VERSION` and `BEDROCK_PROTOCOL` to the game version and numeric protocol matching the bundled schema and server. Changing these values does not upgrade the bundled schema. The upstream declaration targets `1.26.50`; the upstream Realm example uses protocol `2193`. This is inherited version information, not a verified claim of current server compatibility.

PowerShell setup:

```powershell
$env:BEDROCK_HOST = '127.0.0.1'
$env:BEDROCK_PORT = '19132'
$env:BEDROCK_VERSION = '1.26.50'
$env:BEDROCK_PROTOCOL = '2193'
$env:BEDROCK_ACCOUNT = 'my-example-profile'
node example/connect.js
```

Follow the sign-in instructions printed by Microsoft authentication. `BEDROCK_ACCOUNT` names the cached profile, not a password or access token.

- `connect.js`: authenticate, connect, observe login/world initialization, and close on Ctrl+C.
- `packet-counts.js`: print counts for five selected packet events every ten seconds without dumping packet contents.
- `local-relay.js`: listen only on `127.0.0.1:19133` and relay a local Minecraft client to `BEDROCK_HOST:BEDROCK_PORT`. Set `RELAY_PORT` to change the local port. It authenticates the upstream session using your configured profile.

```powershell
node example/packet-counts.js
node example/local-relay.js
```

Run one example at a time with a given profile. These are connection/inspection examples, not complete gameplay bots. No gameplay packets are sent by the examples themselves. Existing library resource-pack negotiation remains in place. Reconnects are manual. Live server authentication, native transport, and complete world spawning have not been validated.

The older `main.js` and `src/` Realm examples are inherited reference material with additional undeclared dependencies (`prompt-sync` and `ip`) and are not the recommended starting point.
