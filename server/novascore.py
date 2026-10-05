"""NovaScore: standard-library-only HTTP + SQLite, behind an HTTPS proxy."""
import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

GAMES = {
    'minesweeper-easy': 9999, 'minesweeper-medium': 9999, 'minesweeper-hard': 9999,
    'wordl-4': 3000, 'wordl-5': 4000, 'wordl-6': 5200, 'wordl-7': 6600,
    'game2048': 1000000, 'colorlines-4': 1000000, 'colorlines-5': 1000000,
    'columns-classic': 10000000, 'novarun-lunar': 1000000,
    'novarun-classic': 1000000, 'asteroids': 10000000, 'explorers': 0,
}
INITIALS = re.compile(r'[A-Z0-9?]{1,3}\Z')
TOKEN = re.compile(r'[a-f0-9]{48}\Z')
NONCE = re.compile(r'[0-9]{1,10}\Z')


class APIError(Exception):
    def __init__(self, status, message, **details):
        self.status = status
        self.body = {'error': message, **details}


class Store:
    def __init__(self, path, clock=time.time, difficulty=3, min_age=1, max_age=7200):
        self.clock, self.difficulty = clock, difficulty
        self.min_age, self.max_age = min_age, max_age
        self.lock = threading.RLock()
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA busy_timeout=5000')
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS scores (
                game TEXT NOT NULL, initials TEXT NOT NULL, score INTEGER NOT NULL,
                achieved INTEGER NOT NULL, PRIMARY KEY(game, initials)
            );
            CREATE INDEX IF NOT EXISTS ranked ON scores(game, score DESC, achieved);
            CREATE TABLE IF NOT EXISTS explorers (
                id INTEGER PRIMARY KEY, initials TEXT NOT NULL UNIQUE, achieved INTEGER NOT NULL
            );
        ''')
        # Tickets/rate limits expire in RAM. No IPs, cookies or profiles in SQLite.
        self.tickets = {}
        self.rates = {}
        self.rate_secret = secrets.token_bytes(32)

    def close(self):
        self.db.close()

    def limit(self, address, write):
        now = self.clock()
        key = hmac.new(self.rate_secret, address.encode(), hashlib.sha256).digest()
        with self.lock:
            self.rates = {k: v for k, v in self.rates.items() if now - v[0] < 60}
            # Two limits: writes can't consume the entire budget for reads.
            start, reads, writes = self.rates.get(key, (now, 0, 0))
            if reads >= 180 or (write and writes >= 30) or (key not in self.rates and len(self.rates) >= 10000):
                raise APIError(429, 'Please wait before trying again.')
            self.rates[key] = (start, reads + 1, writes + int(write))

    def challenge(self, game):
        if game not in GAMES:
            raise APIError(400, 'Unknown game.')
        now = self.clock()
        with self.lock:
            self.tickets = {k: v for k, v in self.tickets.items() if now - v['created'] <= self.max_age}
            if len(self.tickets) >= 10000:
                raise APIError(503, 'Uplink busy. Try again later.')
            ticket = secrets.token_hex(24)
            self.tickets[ticket] = {'game': game, 'created': now, 'result': None}
        return {'ticket': ticket, 'difficulty': self.difficulty,
                'waitMs': int(self.min_age * 1000), 'expiresIn': self.max_age}

    def submit(self, data):
        allowed = {'ticket', 'nonce', 'initials', 'score'}
        if not isinstance(data, dict) or set(data) != allowed:
            raise APIError(400, 'Invalid result fields.')
        ticket, nonce, initials, score = (data[k] for k in ('ticket', 'nonce', 'initials', 'score'))
        if not isinstance(ticket, str) or not TOKEN.fullmatch(ticket):
            raise APIError(400, 'Invalid ticket.')
        if not isinstance(nonce, str) or not NONCE.fullmatch(nonce):
            raise APIError(400, 'Invalid proof.')
        if not isinstance(initials, str) or not INITIALS.fullmatch(initials):
            raise APIError(400, 'Use 1–3 letters or numbers.')
        if type(score) is not int or score < 0:
            raise APIError(400, 'Invalid score.')
        with self.lock:
            run = self.tickets.get(ticket)
            if not run or self.clock() - run['created'] > self.max_age:
                raise APIError(410, 'Ticket expired. Try again.')
            game = run['game']
            if score > GAMES[game] or (game != 'explorers' and score == 0):
                raise APIError(400, 'Score outside game limits.')
            if game.startswith('minesweeper') and score % 10 != 9:
                raise APIError(400, 'Invalid Minesweeper score.')
            if game == 'game2048' and score % 4:
                raise APIError(400, 'Invalid 2048 score.')
            if game == 'asteroids' and score % 10:
                raise APIError(400, 'Invalid Asteroids score.')
            payload = f'{ticket}:{initials}:{score}:{nonce}'
            proof = hashlib.sha256(payload.encode()).hexdigest()
            if not proof.startswith('0' * self.difficulty):
                raise APIError(400, 'Invalid proof.')
            if self.clock() - run['created'] < self.min_age:
                raise APIError(425, 'Ticket is not ready yet.')
            if run['result']:
                # Network retries return the same answer; altered results cannot reuse a ticket.
                old_payload, status, result = run['result']
                if payload != old_payload:
                    raise APIError(409, 'Ticket already used.')
                return status, result
            achieved = int(self.clock() * 1000)
            with self.db:
                if game == 'explorers':
                    row = self.db.execute('SELECT initials, achieved FROM explorers WHERE initials=?', (initials,)).fetchone()
                    if row:
                        status, result = 409, {'error': 'Initials already registered.', 'existing': {'initials': row[0], 'date': row[1]}}
                    else:
                        self.db.execute('INSERT INTO explorers(initials, achieved) VALUES (?, ?)', (initials, achieved))
                        status, result = 201, {'initials': initials, 'date': achieved}
                else:
                    self.db.execute('''INSERT INTO scores VALUES (?, ?, ?, ?)
                        ON CONFLICT(game, initials) DO UPDATE SET score=excluded.score, achieved=excluded.achieved
                        WHERE excluded.score > scores.score''', (game, initials, score, achieved))
                    # Each game retains its best 100 initials, with the public top 10 returned.
                    self.db.execute('''DELETE FROM scores WHERE game=? AND initials NOT IN
                        (SELECT initials FROM scores WHERE game=? ORDER BY score DESC, achieved, initials LIMIT 100)''', (game, game))
                    status, result = 201, {'saved': True}
            run['result'] = (payload, status, result)
            return status, result

    def leaderboard(self, game, after=0):
        if game not in GAMES:
            raise APIError(400, 'Unknown game.')
        with self.lock:
            if game == 'explorers':
                rows = self.db.execute('SELECT id, initials, achieved FROM explorers WHERE id>? ORDER BY id LIMIT 501', (after,)).fetchall()
                return {'entries': [{'initials': r[1], 'date': r[2]} for r in rows[:500]],
                        'next': rows[499][0] if len(rows) > 500 else None}
            rows = self.db.execute('SELECT initials, score, achieved FROM scores WHERE game=? ORDER BY score DESC, achieved, initials LIMIT 10', (game,)).fetchall()
            return {'entries': [{'initials': r[0], 'score': r[1], 'date': r[2]} for r in rows]}


def make_server(store, origins, host='127.0.0.1', port=8787, trust_proxy=False):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def log_message(self, *_args):
            pass  # Deliberately no access logs or request payload logs.

        def send_json(self, status, data):
            raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
            self.send_response(status)
            if self.headers.get('Origin') in origins:
                self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Vary', 'Origin')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Connection', 'close')
            if status == 429:
                self.send_header('Retry-After', '60')
            self.end_headers()
            self.wfile.write(raw)
            self.close_connection = True

        def do_OPTIONS(self):
            if self.headers.get('Origin') not in origins:
                self.send_json(403, {'error': 'Origin not allowed.'})
                return
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Max-Age', '3600')
            self.send_header('Vary', 'Origin')
            self.send_header('Content-Length', '0')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.close_connection = True

        def dispatch(self):
            try:
                origin = self.headers.get('Origin')
                if origin and origin not in origins:
                    raise APIError(403, 'Origin not allowed.')
                if self.command == 'POST' and not origin:
                    raise APIError(403, 'Origin required.')
                address = self.client_address[0]
                if trust_proxy:
                    # Proxy must overwrite X-Real-IP and keep this port private.
                    address = self.headers.get('X-Real-IP', address)[:128]
                store.limit(address, self.command == 'POST')
                url = urlsplit(self.path)
                if self.command == 'GET' and url.path == '/v1/health':
                    self.send_json(200, {'ok': True})
                elif self.command == 'GET' and url.path.startswith('/v1/boards/'):
                    try:
                        after = int(parse_qs(url.query).get('after', ['0'])[0])
                        if after < 0 or after > 2**63 - 1:
                            raise ValueError()
                    except ValueError:
                        raise APIError(400, 'Invalid page cursor.') from None
                    self.send_json(200, store.leaderboard(url.path.removeprefix('/v1/boards/'), after))
                elif self.command == 'POST' and url.path in ('/v1/challenges', '/v1/results'):
                    if self.headers.get('Transfer-Encoding'):
                        raise APIError(400, 'Chunked requests are not accepted.')
                    if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                        raise APIError(415, 'JSON required.')
                    try:
                        length = int(self.headers.get('Content-Length', '-1'))
                    except ValueError:
                        raise APIError(400, 'Invalid length.') from None
                    if length < 1 or length > 2048:
                        raise APIError(413, 'Request too large or empty.')
                    self.connection.settimeout(5)
                    try:
                        body = json.loads(self.rfile.read(length))
                    except (ValueError, UnicodeError):
                        raise APIError(400, 'Invalid JSON.') from None
                    if url.path == '/v1/challenges':
                        if not isinstance(body, dict) or set(body) != {'game'} or not isinstance(body['game'], str):
                            raise APIError(400, 'Invalid challenge fields.')
                        self.send_json(201, store.challenge(body['game']))
                    else:
                        status, result = store.submit(body)
                        self.send_json(status, result)
                else:
                    raise APIError(404, 'Not found.')
            except APIError as error:
                self.send_json(error.status, error.body)
            except (ConnectionError, TimeoutError):
                self.close_connection = True
            except Exception:
                self.send_json(503, {'error': 'Uplink unavailable.'})

        do_GET = dispatch
        do_POST = dispatch

    server = ThreadingHTTPServer((host, port), Handler)
    server.daemon_threads = True
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', default=os.environ.get('NOVASCORE_DB', 'data/novascore.sqlite'))
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8787)
    parser.add_argument('--origins', default=os.environ.get('NOVASCORE_ORIGINS', 'https://novaos.gramoflava.xyz'))
    parser.add_argument('--trust-proxy', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    Path(args.database).parent.mkdir(parents=True, exist_ok=True)
    store = Store(args.database)
    server = make_server(store, set(args.origins.split(',')), args.host, args.port, args.trust_proxy)
    print(f'NovaScore listening on {args.host}:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        store.close()


if __name__ == '__main__':
    main()
