/**
 * Backward-compatible re-export.
 * Delegates to the language-aware parser dispatcher.
 */
const { parse, resolveScope } = require('./parsers/index');

module.exports = { parse, resolveScope };
