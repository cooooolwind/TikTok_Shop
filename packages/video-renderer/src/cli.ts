import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { RenderInput } from './types.js';

async function main() {
  const inputPath = readArg('--input');
  const outputPath = readArg('--output');
  if (!inputPath || !outputPath) {
    throw new Error('Usage: render -- --input <input.json> --output <output.mp4>');
  }

  const input = JSON.parse((await readFile(inputPath, 'utf8')).replace(/^\uFEFF/, '')) as RenderInput;
  validateInput(input);

  const serveUrl = await bundle({
    entryPoint: fileURLToPath(new URL('./index.js', import.meta.url)),
  });
  const composition = await selectComposition({
    serveUrl,
    id: 'TransitionVideo',
    inputProps: { input },
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { input },
  });
}

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function validateInput(input: RenderInput) {
  if (!input.segments?.length) throw new Error('Render input requires at least one segment');
  for (const segment of input.segments) {
    if (!segment.video_url) throw new Error(`Segment ${segment.index} is missing video_url`);
    if (!Number.isFinite(segment.duration) || segment.duration <= 0) {
      throw new Error(`Segment ${segment.index} has an invalid duration`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
