# Universe Vector Stores

This folder is for curated, distributable RAG vector stores that ship with Odyssey.

Live world wiki search is separate from this folder. The app can look up Wikipedia,
Fandom, or other MediaWiki sources at runtime when a world has wiki metadata and
the related settings are enabled. Files here are only for reviewed offline vector
stores that should be bundled with a release.

The Harry Potter vector store is not bundled with the v0.6.1 stable app package.
It remains an alpha/prerelease vector-store artifact because of its size and
experimental retrieval behavior. Publish it here only when intentionally preparing
an alpha vector-store build.

Generation work should happen in the ignored `.rag-vector-generation/` workspace:

```powershell
npm run generate:vectors:mxbai -- --universe star-wars --limit-pages 0
```

After reviewing a generated store, publish it here intentionally:

```powershell
npm run publish:vectors -- --universe star-wars
```

The app loads `<universe-key>.json` files from this folder at runtime. Large stores may be manifests with shard folders, for example:

```text
star-wars.json
star-wars/part-0001.json
star-wars/part-0002.json
```
