import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const screens=JSON.parse(await readFile(path.join(root,'docs/screens.json'),'utf8'));
const ts=await readFile(path.join(root,'prototype/src/app.ts'),'utf8');
const js=await readFile(path.join(root,'prototype/app.js'),'utf8');
const api=await readFile(path.join(root,'docs/03-api.md'),'utf8');
assert.equal(screens.length,25);
assert.equal(new Set(screens.map(s=>s.id)).size,25);
assert.equal(new Set(screens.map(s=>s.route)).size,25);
for(const s of screens){
 for(const key of ['id','route','title','role','goal','features','ui','loading','empty','error','success','validation','api'])assert.ok(s[key]?.length>0,s.id+' missing '+key);
 assert.ok(ts.includes(s.route),s.id+' missing route');
 for(const entry of s.api.split('; ')){const endpoint=entry.split('?')[0];assert.ok(api.includes(endpoint),'API absent: '+endpoint);}
}
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|https?:\/\/(?!localhost)/.test(js),'Unexpected external request in runtime');
for(const file of ['START.html','README.md','docs/01-koncepcja.md','docs/02-ekrany.md','docs/03-api.md','docs/04-weryfikacja.md','prototype/index.html','prototype/styles.css','prototype/screen-data.js','prototype/app.js','prototype/src/app.ts','prototype/tsconfig.json','serve.mjs','build-docs.mjs'])await access(path.join(root,file));
const html=await readFile(path.join(root,'prototype/index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g))await access(path.join(root,'prototype',match[1]));
new Function(js);
new Function(await readFile(path.join(root,'prototype/screen-data.js'),'utf8'));
console.log('PASS: 25 unique screens; 4 states each; all linked API endpoints documented; local assets; JS syntax; no external runtime requests; required files.');
