import unittest
from migration.engines import isolated_shape
from migration.tool import MigrationError


class EngineIsolationTests(unittest.TestCase):
    def shape(self):
        return {'HostConfig': {'NetworkMode': 'container:owned-anchor', 'LogConfig': {'Type': 'none'}},
                'Mounts': [{'Type': 'volume', 'Name': 'owned-copy'}]}

    def test_accepts_only_exact_owned_namespace_and_volume(self):
        isolated_shape(self.shape(), 'owned-anchor', {'owned-copy'})

    def test_rejects_egress_host_published_ports_privilege_and_logs(self):
        for key, value in [('NetworkMode', 'bridge'), ('NetworkMode', 'host'),
                           ('PortBindings', {'8080/tcp': [{'HostPort': '8080'}]}),
                           ('Privileged', True), ('LogConfig', {'Type': 'json-file'})]:
            with self.subTest(key=key, value=value):
                shape = self.shape(); shape['HostConfig'][key] = value
                with self.assertRaises(MigrationError):
                    isolated_shape(shape, 'owned-anchor', {'owned-copy'})

    def test_rejects_source_volume_bind_and_docker_socket(self):
        for mount in [{'Type': 'volume', 'Name': 'source-db'}, {'Type': 'bind', 'Source': '/var/run/docker.sock'}]:
            shape = self.shape(); shape['Mounts'] = [mount]
            with self.assertRaises(MigrationError):
                isolated_shape(shape, 'owned-anchor', {'owned-copy'})


if __name__ == '__main__':
    unittest.main()
