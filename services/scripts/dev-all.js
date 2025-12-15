const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, args, opts = {}){
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, Object.assign({ stdio: 'inherit', shell: false }, opts));
    p.on('close', (code) => {
      if(code === 0) resolve(0); else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
    p.on('error', reject);
  });
}

async function ensureInstalls(){
  const root = path.join(__dirname, '..');
  const uiPath = path.join(root, 'public', 'app-react');

  // ensure services deps
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  if(!fs.existsSync(path.join(root, 'node_modules'))){
    console.log('Installing services dependencies...');
    await new Promise((resolve, reject) => {
      const p = spawn(npmCmd, ['install'], { cwd: root, stdio: 'inherit', shell: true });
      p.on('close', (c) => c === 0 ? resolve() : reject(new Error('npm install failed')));
      p.on('error', reject);
    });
  }

  // ensure ui deps
  if(fs.existsSync(uiPath) && !fs.existsSync(path.join(uiPath, 'node_modules'))){
    console.log('Installing UI dependencies (public/app-react)...');
    await new Promise((resolve, reject) => {
      const p = spawn(npmCmd, ['install'], { cwd: uiPath, stdio: 'inherit', shell: true });
      p.on('close', (c) => c === 0 ? resolve() : reject(new Error('npm install (ui) failed')));
      p.on('error', reject);
    });
  }
}

async function main(){
  try{
    await ensureInstalls();
  }catch(e){
    console.error('Install step failed:', e);
    process.exit(1);
  }

  const root = path.join(__dirname, '..');
  // spawn via shell command strings for cross-platform reliability
  const backend = spawn('npm run dev', { cwd: root, stdio: 'inherit', shell: true });
  // Wait for backend to be ready before starting UI to avoid proxy ECONNREFUSED
  const http = require('http');

  function waitForHealth(url, attempts = 60, interval = 500) {
    return new Promise((resolve, reject) => {
      let tries = 0;
      const timer = setInterval(() => {
        tries++;
        const req = http.get(url, (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
            clearInterval(timer);
            resolve();
          } else {
            if (tries >= attempts) {
              clearInterval(timer);
              reject(new Error('health check failed: status ' + res.statusCode));
            }
          }
          res.on('data', () => {});
          res.on('end', () => {});
        });
        req.on('error', () => {
          if (tries >= attempts) {
            clearInterval(timer);
            reject(new Error('health check failed (error)'));
          }
        });
        req.setTimeout(interval - 50, () => req.destroy());
      }, interval);
    });
  }

  let ui;
  function shutdown(code){
    try{ backend.kill(); }catch(e){}
    try{ if (ui) ui.kill(); }catch(e){}
    process.exit(code||0);
  }

  backend.on('close', (c)=>{ console.log('backend exited', c); shutdown(c); });

  (async () => {
    try {
      console.log('Waiting for backend health...');
      await waitForHealth('http://127.0.0.1:3000/health', 120, 500);
      console.log('Backend healthy — starting UI');
      ui = spawn('npm --prefix public/app-react run dev', { cwd: root, stdio: 'inherit', shell: true });
      ui.on('close', (c)=>{ console.log('ui exited', c); shutdown(c); });
    } catch (e) {
      console.error('Failed waiting for backend health:', e);
      shutdown(1);
    }
  })();

  process.on('SIGINT', ()=> shutdown(0));
  process.on('SIGTERM', ()=> shutdown(0));
}

main();
