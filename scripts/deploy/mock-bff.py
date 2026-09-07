import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    posts = 0
    def log_message(self, *_):
        pass
    def do_GET(self):
        self.respond(401 if self.path.startswith('/api/v1/private') else 200)
    def do_POST(self):
        Handler.posts += 1
        self.respond(503)
    def respond(self, status):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
        data = json.dumps({'path': self.path, 'method': self.command, 'body': body,
            'authorization': self.headers.get('Authorization'),
            'idempotencyKey': self.headers.get('Idempotency-Key'),
            'correlationId': self.headers.get('X-Correlation-Id'), 'posts': Handler.posts}).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Retry-After', '2')
        self.end_headers()
        self.wfile.write(data)
HTTPServer(('0.0.0.0', 80), Handler).serve_forever()
