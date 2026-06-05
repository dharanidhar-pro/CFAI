import fs from "fs";
import path from "path";

const dir = "dist/assets";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), "utf-8");
  const idx = content.indexOf("fetch=");
  if (idx !== -1) {
    console.log(`Found fetch= in ${file} at ${idx}`);
    console.log(content.substring(Math.max(0, idx - 50), idx + 50));
  }
  const idx2 = content.indexOf(".fetch=");
  if (idx2 !== -1) {
    console.log(`Found .fetch= in ${file} at ${idx2}`);
    console.log(content.substring(Math.max(0, idx2 - 50), idx2 + 50));
  }
  const idx3 = content.indexOf("fetch =");
  if (idx3 !== -1) {
    console.log(`Found fetch = in ${file} at ${idx3}`);
    console.log(content.substring(Math.max(0, idx3 - 50), idx3 + 50));
  }
}
