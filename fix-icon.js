const fs = require('fs');
const filepath = 'd:/Documentos/GEMINI/ASCENDA WEB/js/controllers/symptoms-controller.js';
let content = fs.readFileSync(filepath, 'utf8');

const regex = /<div class="symptom-header-v12">\s*<span class="symptom-icon-v12">.*?<\/span>\s*<span class="symptom-name-v12">\$\{name\}<\/span>\s*<\/div>/g;

const replacement = `<div class="symptom-header-v12">
                            <span class="symptom-icon-v12">💡</span>
                            <span class="symptom-name-v12">\${name}</span>
                            <button class="btn-icon" style="margin-left:auto; color:var(--text-muted); font-size:1.1rem; border:none; background:none; cursor:pointer; padding: 4px;" onclick="App.deleteCustomSymptom('\${name}', event)">🗑️</button>
                        </div>`;

content = content.replace(regex, replacement);
fs.writeFileSync(filepath, content, 'utf8');
console.log('Fixed symptom header block');
