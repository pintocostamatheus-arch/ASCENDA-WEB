/* ============================================
   SECURITY UTILS
   Centralized protection against XSS and Injection
   ============================================ */
window.SecurityUtils = {
    /**
     * Escapes HTML special characters to prevent script execution.
     * @param {string} unsafe - The string to escape.
     * @returns {string} - The safely escaped string.
     */
    escapeHTML(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    /**
     * Safely renders a template string with escaped values.
     * Use this instead of direct template interpolation in innerHTML.
     * @param {string} template - The HTML template containing placeholders like {{key}}.
     * @param {Object} values - Key-value pairs of values to escape and inject.
     * @returns {string} - The safe HTML string.
     */
    safeRender(template, values = {}) {
        let safeHtml = template;
        Object.entries(values).forEach(([key, val]) => {
            const escaped = this.escapeHTML(val);
            const regex = new RegExp(`{{${key}}}`, 'g');
            safeHtml = safeHtml.replace(regex, escaped);
        });
        return safeHtml;
    },

    /**
     * Strips all HTML tags from a string (simple sanitizer).
     * Use when you need plain text from potentially unsafe input.
     * @param {string} input - The string to sanitize.
     * @returns {string} - The sanitized string with all HTML tags removed.
     */
    sanitizeHTML(input) {
        if (input === null || input === undefined) return '';
        return String(input).replace(/<[^>]*>/g, '');
    },

    /**
     * Escapes a value for safe insertion into HTML attributes.
     * @param {string} value - The value to escape.
     * @returns {string} - The safely escaped value.
     */
    escapeForAttribute(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    },

    /**
     * Validates a tab name against a whitelist.
     * Used to prevent XSS via push notification data.tab.
     * @param {string} tab - The tab name to validate.
     * @returns {string} - The validated tab name, or 'hoje' as fallback.
     */
    sanitizeTabName(tab) {
        const VALID_TABS = ['hoje', 'instrucoes', 'injecoes', 'peso', 'nutricao', 'sintomas', 'jornada', 'perfil', 'ajuda'];
        if (!tab || typeof tab !== 'string') return 'hoje';
        const clean = tab.toLowerCase().trim();
        return VALID_TABS.includes(clean) ? clean : 'hoje';
    },

    /**
     * Validates imported JSON data, stripping HTML from string values.
     * Prevents XSS via malicious JSON import.
     * @param {*} data - The data to sanitize (recursively).
     * @returns {*} - The sanitized data.
     */
    sanitizeImportData(data) {
        if (data === null || data === undefined) return data;
        if (typeof data === 'string') return this.sanitizeHTML(data);
        if (Array.isArray(data)) return data.map(item => this.sanitizeImportData(item));
        if (typeof data === 'object') {
            const clean = {};
            for (const [key, value] of Object.entries(data)) {
                clean[this.sanitizeHTML(key)] = this.sanitizeImportData(value);
            }
            return clean;
        }
        return data; // numbers, booleans pass through
    },

    /**
     * Generates a standard UUID V4.
     * @returns {string}
     */
    generateUUID() {
        return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
    }
};
