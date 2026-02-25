const { execSync } = require('child_process');
const os = require('os');

try {
  if (os.platform() === 'win32') {
    console.log('🛑 Stopping Production Environment (Windows Mode)');
    execSync(
      'docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml down',
      { stdio: 'inherit' },
    );
  } else {
    console.log('🛑 Stopping Production Environment (Linux/Mac Mode)');
    execSync('./scripts/linux/stop-prod.sh', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('❌ Error stopping prod environment:', error.message);
  process.exit(1);
}
