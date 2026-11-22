'use strict';

/**
 * Records the end-to-end demo and converts it for the README.
 *
 *   npm run demo                 -> reports/demo/
 *   npm run demo -- <outputDir>  -> custom folder
 *
 * Produces:
 *   paynest-e2e-demo.mp4  full quality (H.264)
 *   paynest-e2e-demo.gif  lightweight preview that plays inline on GitHub
 *
 * Requires ffmpeg on PATH (preinstalled on most CI images; `apt-get install ffmpeg`).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(root, process.argv[2] || 'reports/demo');
const resultsDir = path.join(root, 'demo-results');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: process.platform === 'win32', ...opts });
  if (result.status !== 0) {
    console.error(`\n✖ ${cmd} ${args.join(' ')} failed (exit ${result.status})`);
    process.exit(result.status || 1);
  }
}

function findVideo(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findVideo(full);
      if (found) return found;
    } else if (entry.name.endsWith('.webm')) {
      return full;
    }
  }
  return null;
}

if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) {
  console.error('✖ ffmpeg is required to convert the recording. Install it and retry.');
  process.exit(1);
}

fs.rmSync(resultsDir, { recursive: true, force: true });
console.log('▶ Recording the end-to-end demo (Chromium, slowed down)...');
run('npx', ['playwright', 'test', '--config=playwright.demo.config.js']);

const video = findVideo(resultsDir);
if (!video) {
  console.error('✖ No video was recorded.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const mp4 = path.join(outDir, 'paynest-e2e-demo.mp4');
const gif = path.join(outDir, 'paynest-e2e-demo.gif');

console.log('▶ Converting to MP4...');
run('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
  '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart', mp4]);

console.log('▶ Converting to GIF...');
run('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-vf',
  'fps=8,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
  '-loop', '0', gif]);

const size = (f) => `${(fs.statSync(f).size / 1024).toFixed(0)} KB`;
console.log(`✔ Demo ready:\n  ${path.relative(root, mp4)} (${size(mp4)})\n  ${path.relative(root, gif)} (${size(gif)})`);
