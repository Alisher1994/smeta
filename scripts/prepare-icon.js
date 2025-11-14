const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

async function ensureDir(p){
  await fs.promises.mkdir(p, { recursive: true }).catch(()=>{});
}

(async () => {
  try{
    const projectRoot = process.cwd();
    const assetsDir = path.join(projectRoot, 'assets');
    await ensureDir(assetsDir);

  const externalPng = 'C:/Users/LOQ/Documents/icon.png';
    const localPng = path.join(assetsDir, 'icon.png');
    const icoOut = path.join(assetsDir, 'icon.ico');

    let source = localPng;
    const hasLocal = fs.existsSync(localPng) && fs.statSync(localPng).size > 0;
    const hasExternal = fs.existsSync(externalPng);

    // Prefer external file if present
    if (hasExternal){
      await fs.promises.copyFile(externalPng, localPng).catch(()=>{});
      source = localPng;
      console.log(`[icon] Using external PNG: ${externalPng} -> ${localPng}`);
    } else if (hasLocal) {
      source = localPng;
      console.log('[icon] Using existing assets/icon.png');
    } else {
      console.warn('[icon] No PNG icon found. Using default Electron icon. Place PNG at assets/icon.png or C:/Users/LOQ/Documents/icon.png');
      process.exit(0);
    }

    const buf = await pngToIco(source);
    await fs.promises.writeFile(icoOut, buf);
    console.log(`[icon] Generated ICO: ${icoOut}`);
  } catch (e){
    console.warn('[icon] Failed to prepare icon, continuing with default icon:', e.message);
    process.exit(0);
  }
})();
