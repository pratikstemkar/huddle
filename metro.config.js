const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Keep Metro out of the Supabase folder: it holds SQL and CLI state (sometimes root-owned), never app code.
const supabaseDir = path.resolve(__dirname, 'supabase').replace(/[/\\]/g, '[/\\\\]');
const existing = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), new RegExp(`^${supabaseDir}[/\\\\].*`)];

module.exports = config;
