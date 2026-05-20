const fs = require('fs');
const path = require('path');

const version = process.env.VERSION;
if (!version) {
  console.error("Error: VERSION environment variable is not set.");
  process.exit(1);
}

const pub_date = new Date().toISOString();
const notes = `Hylo v${version} Release.`;
const serverUrlPrefix = `https://ainx.ink/apps/hylo`;

const assetsDir = 'release-assets';
if (!fs.existsSync(assetsDir)) {
  console.error(`Error: Directory '${assetsDir}' does not exist.`);
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const platforms = {};

function getSignature(fileName) {
  const sigFile = fileName + '.sig';
  const sigPath = path.join(assetsDir, sigFile);
  if (fs.existsSync(sigPath)) {
    return fs.readFileSync(sigPath, 'utf8').trim();
  }
  return '';
}

files.forEach(file => {
  if (file.endsWith('.sig') || file === 'updater.json') return;
  
  // macOS Universal update bundle
  if (file.includes('universal.app.tar.gz') || (file.includes('darwin') && file.endsWith('.tar.gz'))) {
    const sig = getSignature(file);
    if (sig) {
      platforms['darwin-aarch64'] = { signature: sig, url: `${serverUrlPrefix}/${file}` };
      platforms['darwin-x86_64'] = { signature: sig, url: `${serverUrlPrefix}/${file}` };
      console.log(`Mapped macOS asset: ${file}`);
    }
  } 
  // Windows NSIS update bundle
  else if (file.includes('x64-setup.nsis.zip') || file.includes('x64.nsis.zip') || file.includes('x64-setup.zip')) {
    const sig = getSignature(file);
    if (sig) {
      platforms['windows-x86_64'] = { signature: sig, url: `${serverUrlPrefix}/${file}` };
      console.log(`Mapped Windows asset: ${file}`);
    }
  } 
  // Linux AppImage update bundle
  else if (file.includes('amd64.AppImage.tar.gz') || (file.includes('linux') && file.endsWith('.AppImage.tar.gz'))) {
    const sig = getSignature(file);
    if (sig) {
      platforms['linux-x86_64'] = { signature: sig, url: `${serverUrlPrefix}/${file}` };
      console.log(`Mapped Linux asset: ${file}`);
    }
  }
});

const updater = {
  version: `v${version}`,
  notes,
  pub_date,
  platforms
};

const outputPath = path.join(assetsDir, 'updater.json');
fs.writeFileSync(outputPath, JSON.stringify(updater, null, 2));
console.log('Successfully generated updater.json:');
console.log(JSON.stringify(updater, null, 2));
