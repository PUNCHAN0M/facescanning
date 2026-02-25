const { execSync } = require('child_process');
const os = require('os');

try {
  if (os.platform() === 'win32') {
    console.log('🚀 Starting Production Environment (Windows Mode)');
    execSync(
      'docker-compose --env-file server/.env.prod -f server/docker-compose.prod.yml up --build -d',
      { stdio: 'inherit' },
    );
  } else {
    console.log('🚀 Starting Production Environment (Linux/Mac Mode)');
    execSync('./scripts/linux/start-prod.sh', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('❌ Error starting prod environment:', error.message);
  process.exit(1);
}
