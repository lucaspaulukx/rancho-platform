// Private metadata on stdout: caller encrypts it and disables Docker logging.
// Never follow symlinks or include file contents in the manifest.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(process.argv[2] || '/data');
const entries = [];
async function visit(relative) {
  const file = path.join(root, relative);
  const stat = fs.lstatSync(file);
  const entry = { path: relative || '.', mode: stat.mode & 0o7777, uid: stat.uid, gid: stat.gid };
  if (stat.isSymbolicLink()) {
    entry.type = 'symlink'; entry.target = fs.readlinkSync(file);
  } else if (stat.isDirectory()) {
    entry.type = 'directory';
  } else if (stat.isFile()) {
    entry.type = 'file'; entry.bytes = stat.size;
    const hash = crypto.createHash('sha256');
    for await (const block of fs.createReadStream(file)) hash.update(block);
    entry.sha256 = hash.digest('hex');
  } else {
    throw new Error('Special filesystem entries require an explicit backup policy.');
  }
  entries.push(entry);
  if (entries.length > 1000000) throw new Error('Manifest entry limit exceeded.');
  if (entry.type === 'directory') {
    for (const name of fs.readdirSync(file).sort()) await visit(path.join(relative, name));
  }
}
visit('').then(() => process.stdout.write(JSON.stringify(entries))).catch(() => {
  process.stderr.write('Volume manifest failed; private paths withheld.\n'); process.exitCode = 1;
});
