module.exports = {
  appId: 'cl.inacap.cear.robolab.coppelia',
  productName: 'SIMPY - CEAR',
  electronDist: process.env.SIMPY_ELECTRON_DIST || undefined,
  directories: { output: 'dist/installer' },
  files: ['desktop/**', 'package.json'],
  extraResources: [{
    from: 'dist/SIMPY - CEAR',
    to: 'robolab',
    filter: ['app/**/*', 'runtime/**/*', 'examples/**/*']
  }],
  asar: true,
  artifactName: 'SIMPY-CEAR-Setup-${version}-${arch}.${ext}',
  win: { icon: 'assets/simpy.ico', target: [{ target: 'nsis', arch: ['x64'] }] },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    deleteAppDataOnUninstall: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true
  },
  publish: [{
    provider: 'github',
    owner: 'ccFierro',
    repo: 'SIMPY-CEAR'
  }]
};
