const { execSync } = require('child_process');
const os = require('os');

try {
  if (os.platform() === 'win32') {
    console.log('🧹 Clean Branches (Windows Mode)');
    execSync('.\\scripts\\windows\\clean-branches.bat', { stdio: 'inherit' });
  } else {
    console.log('🧹 Clean Branches (Linux/Mac Mode)');
    execSync('./scripts/linux/clean-branches.sh', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('❌ Error clean branches:', error.message);
  process.exit(1);
}
