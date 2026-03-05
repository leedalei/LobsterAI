const { execSync } = require('child_process');

const script = process.platform === 'linux'
  ? 'npm run start:electron:linux'
  : 'npm run start:electron';

execSync(script, { stdio: 'inherit' });
