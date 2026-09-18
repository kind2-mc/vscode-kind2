## Building the VS Code extension

This project is split across three repositories:

- vscode-kind2: the custom VS Code extension (this repo)
- kind2-language-server: the Java language server and WebSocket gateway
- kind2-java-api: API to build Kind 2 commands and run them
- kind2: the underlying Kind 2 model checker

There are two ways to run the extension during development: as a **local**
(desktop) VS Code extension, or as the **web** extension running in a browser
against a remote LSP gateway.

## Local development

For local (desktop) development, the [Makefile](Makefile) builds and wires up
all the pieces for you: the Java API, the language server, the Kind 2
executable, and the interpreter, then copies the language server distribution
into `./kind2-language-server` so the extension can launch it directly.

Clone the sibling repositories next to this one (the Makefile expects
`../kind2-java-api`, `../kind2-language-server`, and `../kind2` by default),
then run:

```bash
make
```

This is equivalent to `make vscode k2 int`, and builds/copies everything the
extension needs. See `make help` for the individual targets (`api`, `lsp`,
`k2`, `int`, `vscode`) if you only need to rebuild one piece.

Once built, open this repo in VS Code and press `F5` (or run the `Run
Extension` launch configuration) to start a desktop Extension Development
Host with the extension loaded.

## Web development

The web extension doesn't run Kind 2 directly. Instead it connects over a
WebSocket to an LSP gateway (from the `kind2-language-server` repo) that
proxies requests to the Java language server.

### 1) Start the LSP gateway

The gateway needs the Kind 2 binary available in its `src/web/` directory. From the
`kind2-language-server` repo:

```bash
cd src/web
node kind2-gateway.cjs
```

By default this listens on `ws://localhost:3001/lsp`.

For additional configuration options, refer to the instructions in the `kind2-language-server` project
### 2) Run the web extension

From this repo, build and serve the web extension in a headless test host:

```bash
npm run web:run:headless
```

This serves the extension at `http://localhost:3000`. Open that URL in a
browser and load a workspace/folder.

By default the web extension connects to `ws://localhost:3001/lsp`. If your
gateway is running elsewhere, set the `kind2.web.lsp_url` setting (a full
`wss://...` URL or a relative path) to point at it.