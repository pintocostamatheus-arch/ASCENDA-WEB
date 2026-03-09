const fs = require('fs');
const filepath = 'd:/Documentos/GEMINI/ASCENDA WEB/js/services/journey.js';
let content = fs.readFileSync(filepath, 'utf8');

const oldMethod = /async getPhotoUrl\(id\) \{[\s\S]*?\/\/ 3\. Base64 legado[\s\S]*?return photo && photo\.image \? photo\.image : null;\s*\},/;

const newMethod = `async getPhotoUrl(id) {
        // 1. IndexedDB — fonte primária, funciona offline
        try {
            const url = await PhotoStorageService.getPhoto(id);
            if (url) return url;
        } catch (e) {
            console.warn(\`JourneyService.getPhotoUrl: IndexedDB falhou para foto \${id}:\`, e.message);
        }

        const journey = this.get();
        const photo = journey.photos.find(p => p.id === id);

        // 2. Tenta gerar nova URL assinada do Supabase Storage (resolve URLs expiradas/quebradas)
        if (photo && window.SupabaseService && window.AuthService && AuthService.isLoggedIn()) {
            try {
                const client = SupabaseService.getClient();
                const user = await SupabaseService.getUser();
                if (client && user) {
                    const path = \`\${user.id}/photo_\${id}.jpg\`;
                    const { data } = await client.storage
                        .from('journey-photos')
                        .createSignedUrl(path, 60 * 60 * 24 * 365);
                    if (data?.signedUrl) {
                        // Atualiza silenciosamente o cloudUrl no localStorage para a próxima vez
                        photo.cloudUrl = data.signedUrl;
                        this.save(journey);
                        console.log(\`JourneyService.getPhotoUrl: URL renovada para foto \${id}.\`);
                        return data.signedUrl;
                    }
                }
            } catch (e) {
                console.warn(\`JourneyService.getPhotoUrl: renovação de URL falhou para foto \${id}:\`, e.message);
            }
        }

        // 3. Fallback: cloudUrl armazenado (pode estar expirado, mas é o último recurso online)
        if (photo && photo.cloudUrl) {
            console.log(\`JourneyService.getPhotoUrl: usando cloudUrl salvo para foto \${id}.\`);
            return photo.cloudUrl;
        }

        // 4. Base64 legado — compatibilidade com versões antigas
        return photo && photo.image ? photo.image : null;
    },`;

if (oldMethod.test(content)) {
    content = content.replace(oldMethod, newMethod);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('SUCCESS: getPhotoUrl updated.');
} else {
    console.error('ERROR: Pattern not found. No changes made.');
}
