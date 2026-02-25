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
    }
};
