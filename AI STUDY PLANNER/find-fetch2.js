import fs from "fs";
import path from "path";

const dir = "dist/assets";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), "utf-8");
  const regex = /fetch\s*=/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    console.log(`Regex match in ${file} at ${match.index}:`);
    console.log(content.substring(Math.max(0, match.index - 50), match.index + 50));
  }
}
