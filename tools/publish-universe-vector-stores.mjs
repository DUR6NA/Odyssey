#!/usr/bin/env node
// Copy reviewed generated vector stores into Odyssey's tracked distributable folder.

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_FROM_DIR = path.join('.rag-vector-generation', 'output', 'universe-vector-stores');
const DEFAULT_TO_DIR = path.join('public', 'jsons', 'universe-vector-stores');

function printHelp() {
  console.log(`
Publish generated universe vector stores into the app's distributable folder.

Usage:
  node tools/publish-universe-vector-stores.mjs --all
  node tools/publish-universe-vector-stores.mjs --universe star-wars

Options:
  --all                  Publish every .json store from the generation output folder.
  --universe <key>        Publish one store, e.g. star-wars.
  --from <path>           Source folder. Default: ${DEFAULT_FROM_DIR}
  --to <path>             Destination folder. Default: ${DEFAULT_TO_DIR}
  --dry-run               Show what would be copied.
`);
}

function parseArgs(argv) {
  const args = {
    all: false,
    universe: '',
    fromDir: DEFAULT_FROM_DIR,
    toDir: DEFAULT_TO_DIR,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--all':
        args.all = true;
        break;
      case '--universe':
      case '-u':
        args.universe = normalizeKey(next());
        break;
      case '--from':
        args.fromDir = next();
        break;
      case '--to':
        args.toDir = next();
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.all && !args.universe) {
    throw new Error('Choose --universe <key> or --all.');
  }

  return args;
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function listStoreFiles(args) {
  if (args.universe) {
    return [`${args.universe}.json`];
  }

  const entries = await fs.readdir(args.fromDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => entry.name)
    .sort();
}

async function validateStore(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const hasInlineDocuments = Array.isArray(parsed.documents) && parsed.documents.length > 0;
  const hasShards = Array.isArray(parsed.shards) && parsed.shards.length > 0;
  if (!hasInlineDocuments && !hasShards) throw new Error(`${filePath} is missing documents[] or shards[].`);
  if (!parsed.scopeId || !parsed.source?.universeKey) throw new Error(`${filePath} is missing universe metadata.`);
  if (!parsed.embedding?.model || !parsed.embedding?.dimensions) throw new Error(`${filePath} is missing embedding metadata.`);
  if (hasShards) {
    const baseDir = path.dirname(filePath);
    for (const shard of parsed.shards) {
      if (!shard?.file) throw new Error(`${filePath} contains a shard without file.`);
      const shardPath = path.join(baseDir, ...String(shard.file).split('/'));
      const shardRaw = await fs.readFile(shardPath, 'utf8');
      const shardParsed = JSON.parse(shardRaw);
      if (!Array.isArray(shardParsed.documents) || shardParsed.documents.length === 0) {
        throw new Error(`${shardPath} is missing documents[].`);
      }
    }
  }
  return parsed;
}

async function copyFileWithDirs(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const files = await listStoreFiles(args);
  if (files.length === 0) {
    console.log(`No vector stores found in ${args.fromDir}.`);
    return;
  }

  await fs.mkdir(args.toDir, { recursive: true });

  for (const file of files) {
    const sourcePath = path.join(args.fromDir, file);
    const targetPath = path.join(args.toDir, file);
    const store = await validateStore(sourcePath);
    const hasShards = Array.isArray(store.shards) && store.shards.length > 0;
    const chunkCount = hasShards
      ? store.shards.reduce((sum, shard) => sum + Number(shard.documents || 0), 0)
      : store.documents.length;
    const summary = `${store.source.universeKey}: ${chunkCount} chunks, ${store.embedding.dimensions} dimensions${hasShards ? `, ${store.shards.length} shards` : ''}`;

    if (args.dryRun) {
      console.log(`Would publish ${sourcePath} -> ${targetPath} (${summary})`);
      if (hasShards) {
        for (const shard of store.shards) {
          console.log(`Would publish shard ${path.join(args.fromDir, ...String(shard.file).split('/'))} -> ${path.join(args.toDir, ...String(shard.file).split('/'))}`);
        }
      }
      continue;
    }

    await copyFileWithDirs(sourcePath, targetPath);
    if (hasShards) {
      for (const shard of store.shards) {
        await copyFileWithDirs(
          path.join(args.fromDir, ...String(shard.file).split('/')),
          path.join(args.toDir, ...String(shard.file).split('/'))
        );
      }
    }
    console.log(`Published ${targetPath} (${summary})`);
  }
}

main().catch(error => {
  console.error(`\nVector publish failed: ${error.message}`);
  process.exitCode = 1;
});
