"use strict";
// Uploads the installer to the public source repository after the code is pushed.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const project = path.join(__dirname, '..');
const version = require(path.join(project, 'package.json')).version;
const notesPath = path.join(__dirname, 'release-notes', `${version}.md`);
const releaseNotes = fs.existsSync(notesPath)
  ? fs.readFileSync(notesPath, 'utf8')
  : 'Instalador Windows x64 de SIMPY - CEAR. CoppeliaSim se instala por separado.';
const repository = 'ccFierro/SIMPY-CEAR';
const token = process.env.SIMPY_CEAR_RELEASE_TOKEN || process.env.ROBOTICALAB_COPPELIA_RELEASE_TOKEN;
const dryRun = process.argv.includes('--dry-run');
const publish = process.argv.includes('--publish');
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Repositorio de publicaciones inválido.');
if (!token && !dryRun) throw new Error('Configura SIMPY_CEAR_RELEASE_TOKEN con permiso Contents: write para el repositorio.');
const directory = path.join(project, 'dist', 'installer');
const names = [
  `SIMPY-CEAR-Setup-${version}-x64.exe`,
  `SIMPY-CEAR-Setup-${version}-x64.exe.blockmap`,
  'latest.yml'
];
const assets = names.map(name => ({ name, file: path.join(directory, name) }));
assets.push({ name: `SIMPY-CEAR-UR3-scene-${version}.ttt`, file: path.join(project, 'scenes', 'UR3_CEAR_motion.ttt') });
for (const asset of assets) if (!fs.existsSync(asset.file)) throw new Error(`Falta ${asset.file}; genera primero el instalador y guarda la escena.`);
if (!fs.readFileSync(path.join(directory, 'latest.yml'), 'utf8').includes(`version: ${version}`)) {
  throw new Error('latest.yml no coincide con la versión del paquete.');
}
if (dryRun) {
  process.stdout.write(`Publicación preparada: ${repository} · v${version}\n${assets.map(asset => asset.name).join('\n')}\n`);
  process.exit(0);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CEAR-RoboLab-release',
      ...options.headers
    }
  });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.json();
}

async function main() {
  const base = `https://api.github.com/repos/${repository}`;
  const info = await request(base);
  if (info.private) throw new Error('El repositorio debe ser público para que los estudiantes actualicen sin autenticarse.');
  let release;
  const existing = await fetch(`${base}/releases/tags/v${version}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
  });
  if (existing.status === 404) {
    release = await request(`${base}/releases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: `v${version}`, name: `SIMPY - CEAR ${version}`, draft: true, prerelease: false,
        body: releaseNotes
      })
    });
  } else if (existing.ok) release = await existing.json();
  else throw new Error(`GitHub ${existing.status}: ${(await existing.text()).slice(0, 500)}`);
  if (!release.draft) throw new Error('La versión ya está publicada. Incrementa la versión antes de generar otra.');
  for (const { name, file } of assets) {
    const content = fs.readFileSync(file);
    const existingAsset = release.assets.find(asset => asset.name === name);
    if (existingAsset) {
      const digest = `sha256:${createHash('sha256').update(content).digest('hex')}`;
      if (existingAsset.digest === digest) { process.stdout.write(`Ya estaba subido: ${name}\n`); continue; }
      throw new Error(`El borrador ya contiene otra versión de ${name}; usa una versión nueva o revisa el borrador.`);
    }
    const url = release.upload_url.replace(/\{.*$/, '') + `?name=${encodeURIComponent(name)}`;
    await request(url, {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(content.length) }, body: content
    });
    process.stdout.write(`Subido: ${name}\n`);
  }
  if (publish) {
    await request(`${base}/releases/${release.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: false })
    });
    process.stdout.write(`Versión publicada: ${release.html_url}\n`);
  } else {
    process.stdout.write(`Borrador listo: ${release.html_url}\n`);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
