const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ===== App data helpers (fresh install behavior) =====
function getBaseDir() {
  // Store app data under userData so it's isolated per installation and can be removed on uninstall
  const userData = app.getPath('userData');
  return path.join(userData, 'SMETA_APP');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

function backupDataFolder(base) {
  try {
    const dataDir = path.join(base, 'data');
    if (fs.existsSync(dataDir)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backup = path.join(base, `data_backup_${stamp}`);
      fs.renameSync(dataDir, backup);
      return backup;
    }
  } catch {}
  return null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load local file
  const indexPath = path.join(__dirname, 'index.html');
  win.loadFile(indexPath);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Helper: convert dataURL to buffer and ext
function dataUrlToBuffer(dataUrl) {
  const matches = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
  if (!matches) return null;
  const mime = matches[1];
  const ext = matches[2] === 'jpeg' ? 'jpg' : matches[2];
  const b64 = matches[3];
  const buf = Buffer.from(b64, 'base64');
  return { buf, ext, mime };
}

// Save project and images into user's Documents/SMETA_APP
ipcMain.handle('save-project-to-disk', async (event, project) => {
  try {
    const docs = app.getPath('documents');
    const base = path.join(docs, 'SMETA_APP');
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });

    const imagesDir = path.join(base, 'images');
    const dataDir = path.join(base, 'data');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // Work on a copy to write JSON with relative image paths
    const projectToSave = JSON.parse(JSON.stringify(project));

    function handleImageField(fieldValue, folderPrefix) {
      if (!fieldValue || typeof fieldValue !== 'string') return fieldValue;
      if (!fieldValue.startsWith('data:')) return fieldValue; // already a path
      const info = dataUrlToBuffer(fieldValue);
      if (!info) return fieldValue;
      const fname = `${folderPrefix}_${Date.now()}_${Math.floor(Math.random()*10000)}.${info.ext}`;
      const fpath = path.join(imagesDir, fname);
      fs.writeFileSync(fpath, info.buf);
      return path.join('images', fname).replace(/\\/g, '/');
    }

    // Iterate plan groups
    if (projectToSave.data && projectToSave.data.plan && projectToSave.data.plan.groups) {
      projectToSave.data.plan.groups.forEach(group => {
        group.rows.forEach(row => {
          if (row.photo && row.photo.startsWith('data:')) {
            row.photo = handleImageField(row.photo, `plan_photo_${row.id}`);
          }
        });
      });
    }

    // Iterate fact groups
    if (projectToSave.data && projectToSave.data.fact && projectToSave.data.fact.groups) {
      projectToSave.data.fact.groups.forEach(group => {
        group.rows.forEach(row => {
          if (row.photo && row.photo.startsWith('data:')) {
            row.photo = handleImageField(row.photo, `fact_photo_${row.id}`);
          }
          if (row.receipts && Array.isArray(row.receipts)) {
            const newReceipts = [];
            row.receipts.forEach((r, idx) => {
              if (r && r.startsWith('data:')) {
                newReceipts.push(handleImageField(r, `fact_receipt_${row.id}_${idx}`));
              } else {
                newReceipts.push(r);
              }
            });
            row.receipts = newReceipts;
          }
        });
      });
    }

    // Save JSON file
    const outPath = path.join(dataDir, 'current_object.json');
    fs.writeFileSync(outPath, JSON.stringify(projectToSave, null, 2), 'utf8');

    return { ok: true, path: base };
  } catch (err) {
    console.error('save-project error', err);
    return { ok: false, error: err.message };
  }
});

// Load project from Documents/SMETA_APP/data/current_object.json and return object with images as data URLs
ipcMain.handle('load-project-from-disk', async () => {
  try {
    const base = getBaseDir();
    ensureDir(base);

    // On first run of this version, start clean: back up old data and don't auto-load
    const metaFile = path.join(base, 'meta.json');
    const meta = readJson(metaFile) || {};
    const ver = app.getVersion();
    if (meta.lastRunVersion !== ver) {
      backupDataFolder(base);
      meta.lastRunVersion = ver;
      meta.firstRunAt = new Date().toISOString();
      writeJson(metaFile, meta);
      // signal fresh-start to renderer so it can also clear localStorage
      return { __fresh: true };
    }
    const dataFile = path.join(base, 'data', 'current_object.json');
    if (!fs.existsSync(dataFile)) return null;
    const raw = fs.readFileSync(dataFile, 'utf8');
    const project = JSON.parse(raw);

    // Helper to convert file to data URL
    function fileToDataUrl(relPath) {
      try {
        const full = path.join(base, relPath);
        if (!fs.existsSync(full)) return relPath;
        const buf = fs.readFileSync(full);
        const ext = path.extname(full).toLowerCase().replace('.', '');
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        return `data:${mime};base64,` + buf.toString('base64');
      } catch (e) {
        return relPath;
      }
    }

    if (project.data && project.data.plan && project.data.plan.groups) {
      project.data.plan.groups.forEach(group => {
        group.rows.forEach(row => {
          if (row.photo && typeof row.photo === 'string' && !row.photo.startsWith('data:')) {
            row.photo = fileToDataUrl(row.photo);
          }
        });
      });
    }

    if (project.data && project.data.fact && project.data.fact.groups) {
      project.data.fact.groups.forEach(group => {
        group.rows.forEach(row => {
          if (row.photo && typeof row.photo === 'string' && !row.photo.startsWith('data:')) {
            row.photo = fileToDataUrl(row.photo);
          }
          if (row.receipts && Array.isArray(row.receipts)) {
            row.receipts = row.receipts.map(r => (r && typeof r === 'string' && !r.startsWith('data:')) ? fileToDataUrl(r) : r);
          }
        });
      });
    }

    return project;
  } catch (err) {
    console.error('load-project error', err);
    return null;
  }
});

// Capture a region of the current window and save to Documents/SMETA_APP/exports
ipcMain.handle('capture-page-region', async (event, payload) => {
  try {
    const { rect, filename } = payload || {};
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    const image = await win.webContents.capturePage(rect || undefined);
    const png = image.toPNG();
    const docs = app.getPath('documents');
    const base = path.join(docs, 'SMETA_APP', 'exports');
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
    const safe = (filename && filename.replace(/[^\w\p{L}\.\-]+/gu, '_')) || `export_${Date.now()}.png`;
    const outPath = path.join(base, safe);
    fs.writeFileSync(outPath, png);
    return { ok: true, path: outPath };
  } catch (e) {
    console.error('capture-page-region error', e);
    return { ok: false, error: e.message };
  }
});

// Print the current page to PDF using Electron's printToPDF
ipcMain.handle('print-to-pdf', async (event, payload) => {
  try {
    const { defaultPath } = payload || {};
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    // Generate PDF buffer
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'none' },
      pageSize: 'A4',
      landscape: false
    });
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Сохранить как PDF',
      defaultPath: defaultPath || 'export.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    await fs.promises.writeFile(filePath, pdf);
    return { ok: true, path: filePath };
  } catch (e) {
    console.error('print-to-pdf error', e);
    return { ok: false, error: e.message };
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
// Renderer (DOM) code was moved to the web files; main process should not access localStorage or DOM.

