/* ============================================
   SUPABASE CLIENT SERVICE
   Inicializa o client e expõe helpers CRUD.
   ============================================ */
window.SupabaseService = {
    _client: null,

    // ─── CONFIGURAÇÃO ──────────────────────────
    // ⚠️ ATENÇÃO: COLOQUE AQUI OS DADOS DO SEU SUPABASE ⚠️
    SUPABASE_URL: 'https://etchujacrmflnkaglrdt.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_xpmC-6LBQw_n322yGlu-1A_Dj0K-0SA',

    // ─── INIT ──────────────────────────────────
    init() {
        if (this._client) return this._client;

        if (typeof supabase === 'undefined' || !supabase.createClient) {
            console.error('Supabase JS Client não carregado. Verifique o CDN.');
            return null;
        }

        this._client = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });

        console.log('SupabaseService: Client inicializado.');
        return this._client;
    },

    getClient() {
        return this._client || this.init();
    },

    // ─── AUTH HELPERS ──────────────────────────
    async getUser() {
        const client = this.getClient();
        if (!client) return null;
        const { data: { user } } = await client.auth.getUser();
        return user;
    },

    async getSession() {
        const client = this.getClient();
        if (!client) return null;
        const { data: { session } } = await client.auth.getSession();
        return session;
    },

    // ─── CRUD GENÉRICO ─────────────────────────

    /**
     * SELECT com filtro automático por user_id (RLS já garante, mas filtramos por clareza).
     * @param {string} table - Nome da tabela
     * @param {object} filters - Filtros opcionais {coluna: valor}
     * @param {string} orderBy - Coluna para ordenar (default: 'date')
     * @param {boolean} ascending - Direção da ordenação
     * @returns {Array} rows
     */
    async select(table, filters = {}, orderBy = 'date', ascending = true) {
        const client = this.getClient();
        if (!client) return [];

        let query = client.from(table).select('*');

        Object.entries(filters).forEach(([col, val]) => {
            query = query.eq(col, val);
        });

        if (orderBy) {
            query = query.order(orderBy, { ascending });
        }

        const { data, error } = await query;

        if (error) {
            console.error(`SupabaseService.select(${table}):`, error.message);
            return [];
        }
        return data || [];
    },

    /**
     * INSERT de um ou mais registros.
     * @param {string} table
     * @param {object|Array} rows - Objeto único ou array de objetos
     * @param {object} options - { onConflict: 'col', upsert: true }
     * @returns {object} { data, error }
     */
    async insert(table, rows, options = {}) {
        const client = this.getClient();
        if (!client) return { data: null, error: { message: 'Client não inicializado' } };

        const user = await this.getUser();
        if (!user) return { data: null, error: { message: 'Usuário não autenticado' } };

        // Injeta user_id automaticamente
        const addUserId = (row) => ({ ...row, user_id: user.id });
        const payload = Array.isArray(rows) ? rows.map(addUserId) : addUserId(rows);

        let query = client.from(table).insert(payload);

        if (options.onConflict) {
            // Usa upsert
            query = client.from(table).upsert(payload, { onConflict: options.onConflict });
        }

        const { data, error } = await query.select();

        if (error) {
            console.error(`SupabaseService.insert(${table}):`, error.message);
        }
        return { data, error };
    },

    /**
     * UPSERT — Insert or Update baseado em constraint.
     * @param {string} table
     * @param {object|Array} rows
     * @param {string} onConflict - Colunas do constraint (ex: 'user_id,date')
     */
    async upsert(table, rows, onConflict = 'user_id,date') {
        const client = this.getClient();
        if (!client) return { data: null, error: { message: 'Client não inicializado' } };

        const user = await this.getUser();
        if (!user) return { data: null, error: { message: 'Usuário não autenticado' } };

        const addUserId = (row) => ({ ...row, user_id: user.id });
        const payload = Array.isArray(rows) ? rows.map(addUserId) : addUserId(rows);

        const { data, error } = await client
            .from(table)
            .upsert(payload, { onConflict })
            .select();

        if (error) {
            console.error(`SupabaseService.upsert(${table}):`, error.message);
        }
        return { data, error };
    },

    /**
     * UPDATE com filtro.
     * @param {string} table
     * @param {object} updates - Campos a atualizar
     * @param {object} filters - Filtros {coluna: valor}
     */
    async update(table, updates, filters = {}) {
        const client = this.getClient();
        if (!client) return { data: null, error: { message: 'Client não inicializado' } };

        let query = client.from(table).update(updates);

        Object.entries(filters).forEach(([col, val]) => {
            query = query.eq(col, val);
        });

        const { data, error } = await query.select();

        if (error) {
            console.error(`SupabaseService.update(${table}):`, error.message);
        }
        return { data, error };
    },

    /**
     * DELETE com filtro.
     * @param {string} table
     * @param {object} filters - Filtros {coluna: valor}
     */
    async delete(table, filters = {}) {
        const client = this.getClient();
        if (!client) return { data: null, error: { message: 'Client não inicializado' } };

        let query = client.from(table).delete();

        Object.entries(filters).forEach(([col, val]) => {
            query = query.eq(col, val);
        });

        const { data, error } = await query;

        if (error) {
            console.error(`SupabaseService.delete(${table}):`, error.message);
        }
        return { data, error };
    },

    // ─── STORAGE (FOTOS) ───────────────────────

    /**
     * Upload de arquivo para o bucket journey-photos.
     * Path: {user_id}/{filename}
     */
    async uploadPhoto(file, filename) {
        const client = this.getClient();
        if (!client) return { url: null, error: 'Client não inicializado' };

        const user = await this.getUser();
        if (!user) return { url: null, error: 'Usuário não autenticado' };

        const path = `${user.id}/${filename}`;
        const { data, error } = await client.storage
            .from('journey-photos')
            .upload(path, file, { upsert: true });

        if (error) {
            console.error('SupabaseService.uploadPhoto:', error.message);
            return { url: null, error: error.message };
        }

        // Gera URL assinada (válida por 1 ano)
        const { data: urlData } = await client.storage
            .from('journey-photos')
            .createSignedUrl(path, 60 * 60 * 24 * 365);

        return { url: urlData?.signedUrl || null, error: null };
    },

    /**
     * Deleta foto do bucket.
     */
    async deletePhoto(filename) {
        const client = this.getClient();
        if (!client) return;

        const user = await this.getUser();
        if (!user) return;

        const path = `${user.id}/${filename}`;
        await client.storage.from('journey-photos').remove([path]);
    }
};
