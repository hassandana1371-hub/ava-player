// Use a trusted NSIS 3 compiler; electron-builder's verified NSIS toolset works.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),appDir=path.join(root,'dist','win-unpacked');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
if(!process.env.NSIS_MAKENSIS)throw Error('Set NSIS_MAKENSIS to a trusted makensis binary');
if(!fs.existsSync(path.join(appDir,'AVA Player.exe')))throw Error('Build the Windows --dir package first');
const files=[],dirs=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){walk(p);dirs.push(path.relative(appDir,p));}else files.push(path.relative(appDir,p));}}
walk(appDir);
const safe=p=>p.replaceAll('\\','/').replaceAll('$','$$').replaceAll('"','$\\"');
const manifest=path.join(root,'dist','uninstall-files.nsh');
fs.writeFileSync(manifest,[...files.map(p=>`Delete "$INSTDIR/${safe(p)}"`),...dirs.map(p=>`RMDir "$INSTDIR/${safe(p)}"`)].join('\n'));
execFileSync(process.env.NSIS_MAKENSIS,['-V2',`-DAPP_VERSION=${version}`,`-DAPP_DIR=${appDir}`,`-DOUT_FILE=${path.join(root,'dist',`AVA Player Setup ${version}.exe`)}`,`-DICON_FILE=${path.join(root,'assets','ava.ico')}`,`-DUNINSTALL_INCLUDE=${manifest}`,path.join(root,'build','installer.nsi')],{stdio:'inherit',env:{...process.env,NSISDIR:process.env.NSISDIR||path.resolve(path.dirname(process.env.NSIS_MAKENSIS),'..')}});
console.log('Created Windows installer with a file-specific uninstall manifest.');
