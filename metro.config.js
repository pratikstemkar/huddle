const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Keep Metro out of folders that never hold app code: Supabase (SQL and CLI state, sometimes root-owned),
// isolated Supabase stacks, and agent worktrees nested in .claude/worktrees (each with its own node_modules,
// enough to run out of file watchers).
const blocked = ['supabase', '.supabase-isolated', '.claude/worktrees'].map(
  (dir) => new RegExp(`^${path.resolve(__dirname, dir).replace(/[/\\]/g, '[/\\\\]').replace(/\./g, '\\.')}[/\\\\].*`),
);
const existing = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), ...blocked];

module.exports = config;
