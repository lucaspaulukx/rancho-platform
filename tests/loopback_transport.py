"""HTTP transport for the IPv4-only local lab; preserve URL/Host/cookies and timeouts."""
import http.client
import urllib.request


class LoopbackConnection(http.client.HTTPConnection):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        connect = self._create_connection

        def connection(address, *options, **named):
            host, port = address
            if host.lower() == 'localhost':
                address = ('127.0.0.1', port)
            return connect(address, *options, **named)

        self._create_connection = connection


class LoopbackHandler(urllib.request.HTTPHandler):
    def http_open(self, request):
        return self.do_open(LoopbackConnection, request)


def loopback_opener(cookies=None):
    handlers = [urllib.request.ProxyHandler({}), LoopbackHandler()]
    if cookies is not None:
        handlers.append(urllib.request.HTTPCookieProcessor(cookies))
    return urllib.request.build_opener(*handlers)
