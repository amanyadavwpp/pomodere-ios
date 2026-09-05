import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const app = path.join(root, 'ios/App/App');

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function prepare() {
  if (process.platform !== 'darwin') throw new Error('Run iOS preparation on a Mac with Xcode 26 or newer.');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Capacitor 8 requires Node.js 22 or newer.');
  if (!await exists(path.join(app, 'Info.plist'))) throw new Error('First run npm run build, then npx cap add ios from the project folder.');

  const delegatePath = path.join(app, 'AppDelegate.swift');
  const original = await readFile(delegatePath, 'utf8');
  const marker = '// BEGIN POMODERE PRIVACY SHIELD';
  let delegate = original.includes(marker) ? original.slice(0, original.indexOf(marker)).trimEnd() : original;
  if (!original.includes(marker)) {
    const backupPath = path.join(root, 'ios-support/AppDelegate.original.swift.backup');
    if (!await exists(backupPath)) await writeFile(backupPath, original);
  }
  if (!delegate.includes('PomoderePrivacyShield.install()')) {
    const launchMethod = /func application\([\s\S]*?didFinishLaunchingWithOptions[\s\S]*?\)\s*->\s*Bool\s*\{/;
    if (!launchMethod.test(delegate)) throw new Error('Could not identify the native launch method. Merge ios-support/PrivacyShield.swift manually rather than overwriting your AppDelegate.');
    delegate = delegate.replace(launchMethod, '$&\n        PomoderePrivacyShield.install()');
  }
  const shield = await readFile(path.join(root, 'ios-support/PrivacyShield.swift'), 'utf8');
  await writeFile(delegatePath, `${delegate.trimEnd()}\n\n${shield}`);
  await copyFile(path.join(root, 'ios-support/PrivacyInfo.xcprivacy'), path.join(app, 'PrivacyInfo.xcprivacy'));

  const info = path.join(app, 'Info.plist');
  execFileSync('/usr/bin/plutil', ['-replace', 'UIUserInterfaceStyle', '-string', 'Light', info]);
  execFileSync('/usr/bin/plutil', ['-replace', 'UIViewControllerBasedStatusBarAppearance', '-bool', 'YES', info]);

  const icons = path.join(app, 'Assets.xcassets/AppIcon.appiconset');
  await mkdir(icons, { recursive: true });
  await sharp(path.join(root, 'resources/app-icon.svg')).resize(1024, 1024).flatten({ background: '#f2e9df' }).removeAlpha().png().toFile(path.join(icons, 'pomodere-icon.png'));
  await writeFile(path.join(icons, 'Contents.json'), JSON.stringify({
    images: [{ idiom: 'universal', platform: 'ios', size: '1024x1024', filename: 'pomodere-icon.png' }],
    info: { author: 'xcode', version: 1 },
  }, null, 2) + '\n');

  console.log('Prepared the iOS icon, light appearance, and native app-switcher privacy shield.');
  console.log('Next: npx cap sync ios, then npx cap open ios.');
  console.log('In Xcode, add App/PrivacyInfo.xcprivacy to the App target and its Copy Bundle Resources.');
  console.log('Choose your signing team and a unique bundle identifier. See IOS.md for the full checklist.');
}

prepare().catch((error) => { console.error(error.message); process.exitCode = 1; });