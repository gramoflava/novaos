# NovaScore

A tiny optional API for NovaOS. **Python 3.10+ and SQLite from the Python standard
library only.** No pip, npm, framework, account, cookies or external service.
The static site and games continue to work if this API is offline.

## Run locally

From the repository root:

```sh
python3 server/novascore.py --origins http://localhost:8080,http://127.0.0.1:8080
python3 -m http.server 8080
```

Temporarily set `js/score-config.js` to `http://127.0.0.1:8787`, then open the
site through localhost/127.0.0.1 (Web Crypto requires a secure context).
Enable uplink in Scores, play a new game and save the result. Ordinary local
scores are intentionally never imported into the server. Restore the production
URL before publishing the static site.

Tests need no installed dependencies:

```sh
python3 -m unittest discover -s server -p 'test_*.py' -v
node --test tests/*.test.js
```

## Deploy on gramof.us

Use **https://novascore.gramof.us** behind the existing HTTPS reverse proxy.
Keep port 8787 on loopback; don't expose an additional public port.

1. Point the subdomain's DNS at the server and obtain an HTTPS certificate.
2. Create a dedicated service user and copy `novascore.py` to `/opt/novascore`:

   ```sh
   sudo useradd --system --no-create-home --shell /usr/sbin/nologin novascore
   sudo install -d -o root -g root /opt/novascore
   sudo install -m 0644 server/novascore.py /opt/novascore/novascore.py
   sudo install -m 0644 server/deploy/novascore.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now novascore
   ```

3. Adapt `deploy/nginx.conf` to the existing proxy configuration. The two limit
   zones belong in `http {}`. The certificate paths are examples. Disable access
   logs for this virtual host, and overwrite `X-Real-IP` as shown. Enable
   `--trust-proxy` **only** when that port is private and the proxy supplies this
   header itself. Without it the API uses the socket peer for rate limiting.
4. Set `NOVASCORE_ORIGINS` in the service to a comma-separated list of actual
   NovaOS origins. It defaults to the current `CNAME`,
   `https://novaos.gramoflava.xyz`. Include additional origins explicitly.
5. Check `/v1/health`, then test a fresh game through the real site.

The default client URL is in `js/score-config.js`; deploying the static site
before the API is ready is safe and shows “Uplink unavailable”. No live
credentials or server configuration are included in the repository.

The service creates `/var/lib/novascore/novascore.sqlite` with restrictive file
permissions. Back up the SQLite database with its backup API (or stop the service
before copying); copying the database alone while WAL is active can miss writes.
Restarting the service invalidates unfinished tickets, but preserves scoreboards.
To update: replace the Python file and restart the service. There is no build.
Schema and rule changes migrate on start, once, tracked by SQLite's
`PRAGMA user_version`. Version 1 adds the run duration, converts Minesweeper
records to solve times in milliseconds, and clears Wordl boards (their time bonus
is gone) and the retired `colorlines-4`. Back up the database before updating.

## What is stored / transmitted

The permanent database contains only the game's name, initials, best score, the
run's duration and the server-assigned achievement date; Explorers has only
initials and its first date. Numeric boards show the top 10 and retain the top 100
initials per game. Minesweeper ranks by solve time (lower is better); every other
board ranks by points, and equal points go to the shorter run (Wordl reports no
duration, so its ties go to whoever was first). A new result replaces an initials'
previous one only when it ranks higher. Explorers keeps every
unique initials indefinitely; pagination is automatically read to display everyone.

Technical requests carry a game ID and a short-lived random ticket/proof. These
are not user profiles. No gameplay, fingerprint, browser ID, client date, local
history or cookies is sent. HTTP necessarily exposes a source IP to the server;
rate limiting uses a process-keyed hash of that address in RAM for up to a minute,
never SQLite or access logs. Disable proxy access logs too, as in the example.

There is no endpoint to import a local leaderboard, clear the shared board, or
edit an existing result. Factory Reset clears the browser's scores, uplink choice,
Explorer acknowledgement and secret-game unlocks. It cannot delete public records.

## Protection and its boundary

- Only a new game's in-memory receipt is accepted by the client publish function.
  Editing `nova_scores`, calling `Scores.addScore` or calling `showScorePrompt`
  with invented arguments cannot populate an upload queue. Game reporters bind only
  while the original scripts load, then stay inside game closures; there is no
  public `startRun`/`finishRun` method to mint receipts from the console.
- Tickets are random, expire after two hours, belong to one game, and accept only
  one result. Retrying the identical proof returns the same response; changing
  any field after redemption is rejected. A challenge is obtained at run start
  when consent already exists; the first newly consented result obtains it after
  the save prompt. Nothing contacts the server before opting in.
- SHA-256 proof-of-work binds ticket + initials + score + duration; the server checks a
  minimal delay, ranges and game-specific score formats. These are plausibility
  limits, **not proof of game completion**. The proof is an abuse cost, not a
  secret signature. There are no secret keys embedded in browser JavaScript.
- Strict schemas, small request bodies, allowed origins, parameterized SQL,
  escaped/text-only UI, per-address rate limits, bounded ticket memory and proxy
  request/concurrency limits reduce accidental corruption and cheap spam.
- Anyone controlling their own browser or writing a custom HTTP client can still
  imitate a game. CORS does not authenticate players. Preventing that would
  require a server-authoritative game or verified replays, which would transmit
  more than scores and initials and add substantially more complexity.

New results that fail to uplink remain local. A retry queue exists only in the
current page's memory, is cleared when uplink is disabled, and is never recovered
from editable localStorage. The user can retry from Scores (up to 50 pending results per session). Explorers keeps its
registration dialog open on a network failure so the player can retry.
Acknowledge appears only after the server confirms those initials already exist;
it preserves that registration's original date. Changing initials hides it until
the server confirms another duplicate. Closing/acknowledging the dialog prevents a prompt on later
falls in the same browser. A skipped cinematic doesn't award Explorer status.
