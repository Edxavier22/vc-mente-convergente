import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}\b/,/\bsb_secret_[A-Za-z0-9_-]{20,}\b/,/\bAKIA[0-9A-Z]{16}\b/];
const findings=[];
for(const file of files){if(file==='scripts/secret-scan.mjs')continue;let text;try{text=readFileSync(file,'utf8')}catch{continue}if(patterns.some(re=>re.test(text)))findings.push(file);for(const jwt of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){try{if(JSON.parse(Buffer.from(jwt.split('.')[1],'base64url')).role==='service_role')findings.push(file)}catch{}}}
if(findings.length){console.error('Secret scan failed in:',[...new Set(findings)].join(', '));process.exit(1)}console.log(`Secret scan passed (${files.length} files; private keys, GitHub/AWS/Supabase secrets and service-role JWTs).`);
