// Run from any directory: node extension/cloud/setup.cjs
// No Apple credentials or third-party JavaScript dependencies are needed.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
if (Number(process.versions.node.split('.')[0]) < 20) {
  throw Error('Node.js 20 or later is required');
}
const cwd = path.resolve(__dirname, '..');
const commands = [
  ['ios/scripts/sync-resources.cjs'],
  ['safari/build.cjs'],
  ...['content.js', 'background.js', 'capture-bridge.js', 'capture-geometry.js',
    'ios/NLSCMobile/Resources/content.js', 'ios/NLSCMobile/Resources/ios-bridge.js',
    'ios/NLSCMobile/Resources/mobile-ui.js', 'safari/nlsc-mobile.user.js'].map(file => ['--check', file]),
  ['--test', 'background.test.cjs', 'capture-bridge.test.cjs', 'capture.test.cjs',
    'options.test.cjs', 'ios/ios.test.cjs', 'safari/safari.test.cjs']
];
for (const args of commands) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Cloud development setup verified. iOS compilation uses GitHub Actions macOS.');
