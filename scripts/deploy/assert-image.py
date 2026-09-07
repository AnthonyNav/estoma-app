import json
import re
import time
import urllib.request
import urllib.error

BASE = 'http://frontend:8080'
def get(path, data=None, headers=None):
    req = urllib.request.Request(BASE + path, data=data, headers=headers or {})
    try:
        response = urllib.request.urlopen(req, timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    return response.status, response.headers, response.read()
for attempt in range(30):
    try:
        assert get('/healthz')[0] == 200
        break
    except (OSError, AssertionError):
        if attempt == 29:
            raise
        time.sleep(.2)

for path in ['/', '/wash/supervision/manual', '/index.html']:
    status, headers, body = get(path)
    assert status == 200 and b'<app-root' in body, path
    assert 'camera=(self)' in headers['Permissions-Policy'], path
    assert headers['X-Content-Type-Options'] == 'nosniff', path
    assert headers['Cache-Control'] == 'no-cache', path
status, _, body = get('/version.json')
assert status == 200 and json.loads(body)['commit']
status, _, index = get('/')
asset = re.search(rb'src="([^\"]+\.js)"', index).group(1).decode()
status, headers, _ = get('/' + asset)
assert status == 200 and 'immutable' in headers['Cache-Control']
assert get('/missing.js')[0] == 404
assert get('/api')[0] == 404
status, headers, body = get('/api/v1/private')
assert status == 401 and json.loads(body)['path'] == '/api/v1/private'
assert headers['Cache-Control'] == 'no-store'
status, headers, body = get('/api/v1/test.json?probe=1', b'{"synthetic":true}', {
    'Authorization': 'Bearer synthetic-token', 'Idempotency-Key': 'synthetic-intent',
    'X-Correlation-Id': 'synthetic-correlation', 'Content-Type': 'application/json'})
result = json.loads(body)
assert status == 503 and headers['Retry-After'] == '2'
assert result == {'path': '/api/v1/test.json?probe=1', 'method': 'POST',
    'body': '{"synthetic":true}', 'authorization': 'Bearer synthetic-token',
    'idempotencyKey': 'synthetic-intent', 'correlationId': 'synthetic-correlation', 'posts': 1}
assert json.loads(get('/api/v1/count')[2])['posts'] == 1
print('Image smoke passed: SPA, camera/security/cache, health/version, API401/503, unchanged POST and no replay.')
