import fs from 'node:fs';
import path from 'node:path';

const pkgPath = require.resolve('@dicebear/styles/package.json');
const stylesDir = path.join(path.dirname(pkgPath), 'src');

const styles: Record<string, unknown> = {};

for (const file of fs.readdirSync(stylesDir)) {
  if (!file.endsWith('.json')) continue;

  const styleName = file.replace('.json', '');

  styles[styleName] = JSON.parse(
    fs.readFileSync(path.join(stylesDir, file), 'utf8'),
  );
}

const output = `
// Auto-generated. Do not edit.

export const allStyles = ${JSON.stringify(styles, null, 2)} as const;
`;

fs.writeFileSync(path.resolve('./src/dicebear-styles.map.ts'), output);

console.log(`Generated ${Object.keys(styles).length} DiceBear styles`);
