/* ============================================
   PHOTO STORAGE SERVICE (IndexedDB)
   Stores photo blobs separately from metadata.
   ============================================ */
window.PhotoStorageService = {
    DB_NAME: 'ascenda-photos',
    DB_VERSION: 1,
    STORE_NAME: 'photos',
    _db: null,
    _blobUrls: [],

    /** Revoke all outstanding blob URLs to free memory */
    revokeAll() {
        this._blobUrls.forEach(u => URL.revokeObjectURL(u));
        this._blobUrls = [];
    },

    async open() {
        if (this._db) return this._db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve(this._db);
            };

            request.onerror = (e) => {
                console.error('PhotoStorageService: IndexedDB open failed', e);
                reject(e);
            };
        });
    },

    async savePhoto(id, blob) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            tx.objectStore(this.STORE_NAME).put({ id, blob, savedAt: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e);
        });
    },

    async getPhoto(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const req = tx.objectStore(this.STORE_NAME).get(id);
            req.onsuccess = () => {
                const result = req.result;
                if (result && result.blob) {
                    const url = URL.createObjectURL(result.blob);
                    this._blobUrls.push(url);
                    resolve(url);
                } else {
                    resolve(null);
                }
            };
            req.onerror = (e) => reject(e);
        });
    },

    /** Get photo as Base64 data URL (for jsPDF which can't use Object URLs) */
    async getPhotoAsDataUrl(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const req = tx.objectStore(this.STORE_NAME).get(id);
            req.onsuccess = () => {
                const result = req.result;
                if (result && result.blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(result.blob);
                } else {
                    resolve(null);
                }
            };
            req.onerror = (e) => reject(e);
        });
    },

    async deletePhoto(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            tx.objectStore(this.STORE_NAME).delete(id);
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e);
        });
    },

    /** Convert a Base64 data URL to a Blob */
    dataUrlToBlob(dataUrl) {
        const [header, data] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)[1];
        const binary = atob(data);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return new Blob([array], { type: mime });
    },

    /** Compress a File to a Blob with smart sizing */
    compressToBlob(file, maxWidth = 800, quality = 0.75) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;

                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
};
