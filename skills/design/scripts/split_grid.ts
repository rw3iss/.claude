import sharp from "sharp";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

export async function splitGrid(inputPath: string, outputDir: string): Promise<string[]> {
  mkdirSync(outputDir, { recursive: true });
  const img = sharp(inputPath);
  const meta = await img.metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`could not read dimensions of ${inputPath}`);
  }
  if (meta.width < 2 || meta.height < 2) {
    throw new Error(`grid dimensions too small: ${meta.width}x${meta.height}`);
  }
  // MJ grids are 2x2 but preserve the aspect ratio, so dimensions may be
  // non-square (e.g. 2688x1792 for --ar 3:2). Split along each axis independently.
  const halfW = Math.floor(meta.width / 2);
  const halfH = Math.floor(meta.height / 2);
  const regions = [
    { name: "01.png", left: 0,     top: 0     },
    { name: "02.png", left: halfW, top: 0     },
    { name: "03.png", left: 0,     top: halfH },
    { name: "04.png", left: halfW, top: halfH },
  ];
  const out: string[] = [];
  for (const r of regions) {
    const dest = join(outputDir, r.name);
    await sharp(inputPath)
      .extract({ left: r.left, top: r.top, width: halfW, height: halfH })
      .png()
      .toFile(dest);
    out.push(dest);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error("usage: split_grid.ts <input.png> <output-dir>");
    process.exit(2);
  }
  splitGrid(input, output)
    .then((files) => console.log(JSON.stringify({ status: "ok", files })))
    .catch((err) => {
      console.error(JSON.stringify({ status: "error", message: String(err) }));
      process.exit(1);
    });
}
