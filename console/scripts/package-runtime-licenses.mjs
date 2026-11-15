import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
const destination = new URL('dist/licenses/npm/', root);
const releaseNotices = {
  'react-remove-scroll-bar@2.3.8': {
    file: new URL('./licenses/react-remove-scroll-bar-2.3.8.txt', import.meta.url),
    source:
      'https://github.com/theKashey/react-remove-scroll-bar/blob/7301c160fda44cb8cf2b9fdfde61efad35736196/LICENSE',
  },
};

const packages = {};
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev) continue;
  const entries = await readdir(new URL(path, root), { withFileTypes: true }).catch((error) => {
    if (entry.optional && error.code === 'ENOENT') return null;
    throw error;
  });
  if (!entries) continue;

  const name = path.split('node_modules/').at(-1);
  const key = `${name}@${entry.version}`;
  if (!entry.license) throw new Error(`Missing license declaration for ${key}`);
  const directory = new URL(key + '/', destination);
  await mkdir(directory, { recursive: true });
  const files = entries
    .filter(
      (file) =>
        file.isFile() &&
        /^(license|licence|notice|copying|copyright|authors)([._-]|$)/i.test(file.name),
    )
    .map((file) => file.name)
    .sort();
  if (files.length) {
    for (const filename of files) {
      await copyFile(new URL(path + '/' + filename, root), new URL(filename, directory));
    }
  } else {
    const notice = releaseNotices[key];
    if (!notice) throw new Error(`No license text provided for ${key}`);
    await copyFile(notice.file, new URL('LICENSE', directory));
    files.push('LICENSE');
  }
  packages[key] = {
    license: entry.license,
    files,
    ...(releaseNotices[key] ? { source: releaseNotices[key].source } : {}),
  };
}

await writeFile(new URL('index.json', destination), JSON.stringify(packages, null, 2) + '\n');
