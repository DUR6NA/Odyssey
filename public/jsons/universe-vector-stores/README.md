# Universe Vector Stores

This folder is for curated, distributable RAG vector stores that ship with Odyssey.

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
harry-potter.json
harry-potter/part-0001.json
harry-potter/part-0002.json
```
