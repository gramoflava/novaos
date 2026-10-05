import hashlib
import http.client
import json
import tempfile
import threading
import unittest
from pathlib import Path

from novascore import APIError, Store, make_server


def result(challenge, initials='ABC', score=100):
    ticket = challenge['ticket']
    nonce = 0
    while not hashlib.sha256(f'{ticket}:{initials}:{score}:{nonce}'.encode()).hexdigest().startswith('0' * challenge['difficulty']):
        nonce += 1
    return {'ticket': ticket, 'nonce': str(nonce), 'initials': initials, 'score': score}


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = str(Path(self.directory.name) / 'test.sqlite')
        self.now = 1000
        self.store = Store(self.path, clock=lambda: self.now, difficulty=1, min_age=1)

    def tearDown(self):
        self.store.close()
        self.directory.cleanup()

    def submit(self, game, initials, score):
        challenge = self.store.challenge(game)
        self.now += 2
        return self.store.submit(result(challenge, initials, score))

    def test_fake_score_without_a_ticket_is_rejected(self):
        with self.assertRaises(APIError) as error:
            self.store.submit({'ticket': '0' * 48, 'nonce': '0', 'initials': 'ABC', 'score': 9999})
        self.assertEqual(error.exception.status, 410)
        self.assertEqual(self.store.leaderboard('game2048')['entries'], [])

    def test_proof_binds_score_initials_and_single_redemption(self):
        challenge = self.store.challenge('game2048')
        self.now += 2
        data = result(challenge, score=100)
        response = self.store.submit(data)
        self.assertEqual(response, self.store.submit(data))
        with self.assertRaises(APIError):
            self.store.submit(result(challenge, 'DEF', 200))
        self.assertEqual(len(self.store.leaderboard('game2048')['entries']), 1)

    def test_expiration_minimum_age_and_wrong_proof(self):
        challenge = self.store.challenge('game2048')
        data = result(challenge)
        with self.assertRaises(APIError) as early:
            self.store.submit(data)
        self.assertEqual(early.exception.status, 425)
        self.now += 2
        tampered = {**data, 'score': 104}
        # Make an unequivocally invalid proof rather than rely on collision probability.
        while hashlib.sha256(f"{data['ticket']}:ABC:104:{tampered['nonce']}".encode()).hexdigest().startswith('0'):
            tampered['nonce'] = str(int(tampered['nonce']) + 1)
        with self.assertRaises(APIError) as wrong:
            self.store.submit(tampered)
        self.assertEqual(wrong.exception.status, 400)
        self.now += 7200
        with self.assertRaises(APIError) as expired:
            self.store.submit(data)
        self.assertEqual(expired.exception.status, 410)

    def test_strict_score_limits_schema_and_initials(self):
        for game, score in [('game2048', 101), ('minesweeper-easy', 10000), ('minesweeper-hard', 9998), ('wordl-4', 3001), ('asteroids', 31), ('explorers', 1)]:
            with self.subTest(game=game, score=score), self.assertRaises(APIError):
                self.submit(game, 'ABC', score)
        challenge = self.store.challenge('game2048')
        self.now += 2
        for data in [result(challenge, '<b>', 100), {**result(challenge), 'profile': 'no'}, {**result(challenge), 'score': True}]:
            with self.assertRaises(APIError):
                self.store.submit(data)
        with self.assertRaises(APIError):
            self.store.challenge('unknown')

    def test_best_score_only_and_persistence(self):
        self.submit('game2048', 'ABC', 100)
        first = self.store.leaderboard('game2048')['entries'][0]
        self.submit('game2048', 'ABC', 40)
        self.assertEqual(first, self.store.leaderboard('game2048')['entries'][0])
        self.submit('game2048', 'ABC', 200)
        self.submit('wordl-5', 'ABC', 500)
        self.store.close()
        self.store = Store(self.path)
        self.assertEqual(self.store.leaderboard('game2048')['entries'][0]['score'], 200)
        self.assertEqual(self.store.leaderboard('wordl-5')['entries'][0]['score'], 500)

    def test_explorers_keep_first_date_and_return_duplicate(self):
        status, first = self.submit('explorers', 'ABC', 0)
        self.assertEqual(status, 201)
        status, duplicate = self.submit('explorers', 'ABC', 0)
        self.assertEqual(status, 409)
        self.assertEqual(duplicate['existing'], first)
        self.assertEqual(self.store.leaderboard('explorers')['entries'], [first])

    def test_explorers_have_no_total_limit_and_stable_pagination(self):
        with self.store.db:
            self.store.db.executemany('INSERT INTO explorers(initials, achieved) VALUES (?, ?)', ((str(n), 1000 + n) for n in range(1100)))
        collected, after = [], 0
        while True:
            page = self.store.leaderboard('explorers', after)
            collected.extend(page['entries'])
            if page['next'] is None:
                break
            after = page['next']
        self.assertEqual(len(collected), 1100)
        self.assertEqual(len({e['initials'] for e in collected}), 1100)

    def test_rate_limits_expire_without_persistent_identifiers(self):
        for _ in range(30):
            self.store.limit('test-address', True)
        with self.assertRaises(APIError) as limited:
            self.store.limit('test-address', True)
        self.assertEqual(limited.exception.status, 429)
        self.store.limit('test-address', False)
        self.assertNotIn('test-address', str(self.store.rates))
        self.now += 61
        self.store.limit('test-address', True)
        tables = {row[0] for row in self.store.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertEqual(tables, {'scores', 'explorers'})


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = Store(':memory:', difficulty=1, min_age=0)
        cls.server = make_server(cls.store, {'https://nova.test'}, port=0)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.store.close()

    def request(self, method, path, body=None, origin='https://nova.test', headers=None):
        connection = http.client.HTTPConnection(*self.server.server_address, timeout=5)
        request_headers = {'Content-Type': 'application/json', **(headers or {})}
        if origin:
            request_headers['Origin'] = origin
        connection.request(method, path, body=json.dumps(body) if body is not None else None, headers=request_headers)
        response = connection.getresponse()
        raw = response.read()
        outcome = response.status, dict(response.getheaders()), json.loads(raw) if raw else None
        connection.close()
        return outcome

    def test_full_http_roundtrip_and_cors(self):
        status, headers, challenge = self.request('POST', '/v1/challenges', {'game': 'game2048'})
        self.assertEqual(status, 201)
        self.assertEqual(headers['Access-Control-Allow-Origin'], 'https://nova.test')
        self.assertNotIn('Set-Cookie', headers)
        self.assertEqual(self.request('POST', '/v1/results', result(challenge))[0], 201)
        status, _, board = self.request('GET', '/v1/boards/game2048')
        self.assertEqual(status, 200)
        self.assertEqual(board['entries'][0]['initials'], 'ABC')
        self.assertEqual(self.request('OPTIONS', '/v1/results')[0], 204)

    def test_bad_origins_bodies_and_routes(self):
        self.assertEqual(self.request('POST', '/v1/challenges', {'game': 'game2048'}, origin='https://evil.test')[0], 403)
        self.assertEqual(self.request('POST', '/v1/challenges', {'game': 'game2048'}, origin=None)[0], 403)
        self.assertEqual(self.request('POST', '/v1/challenges', {'game': ['game2048']})[0], 400)
        self.assertEqual(self.request('POST', '/v1/challenges', {'padding': 'x' * 3000})[0], 413)
        self.assertEqual(self.request('POST', '/v1/challenges', {}, headers={'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.request('GET', '/v1/boards/explorers?after=-1')[0], 400)
        self.assertEqual(self.request('GET', '/v1/boards/explorers?after=999999999999999999999')[0], 400)
        self.assertEqual(self.request('POST', '/v1/import', {})[0], 404)
        self.assertEqual(self.request('GET', '/v1/health')[0], 200)


if __name__ == '__main__':
    unittest.main()
