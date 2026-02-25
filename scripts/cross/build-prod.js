const { execSync } = require('child_process');
const os = require('os');

try {
  if (os.platform() === 'win32') {
    console.log('📦 Building Production Environment (Windows Mode)');
    execSync(
      'docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml build',
      { stdio: 'inherit' },
    );
  } else {
    console.log('📦 Building Production Environment (Linux/Mac Mode)');
    execSync('./scripts/linux/build-prod.sh', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('❌ Error building prod environment:', error.message);
  process.exit(1);
}
