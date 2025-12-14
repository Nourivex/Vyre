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
  const ui = spawn('npm --prefix public/app-react run dev', { cwd: root, stdio: 'inherit', shell: true });

  function shutdown(code){
    try{ backend.kill(); }catch(e){}
    try{ ui.kill(); }catch(e){}
    process.exit(code||0);
  }

  backend.on('close', (c)=>{ console.log('backend exited', c); shutdown(c); });
  ui.on('close', (c)=>{ console.log('ui exited', c); shutdown(c); });

  process.on('SIGINT', ()=> shutdown(0));
  process.on('SIGTERM', ()=> shutdown(0));
}

main();
