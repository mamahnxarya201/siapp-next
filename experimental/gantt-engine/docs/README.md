# Experimental Gantt engine documentation

The experimental Gantt engine is a framework-free DOM and SVG implementation for the PMIS migration slice. The React PMIS application remains the production implementation.

Use the [documentation portal](./index.html) when you want a readable reference in a browser. Use your browser's built-in find command, such as `Ctrl+F`, to search the page. The portal is generated from the Markdown files in this directory, so the Markdown files remain the source of truth.

## Start here

- [Architecture](./ARCHITECTURE.md) explains the engine composition, lifecycle, rendering boundaries, scheduling, and bridge separation.
- [Theme and interaction contract](./THEME_AND_INTERACTION_CONTRACT.md) defines supported themes, authoring behavior, context menus, and project-header controls.
- [Layout contract](./LAYOUT_CONTRACT.md) defines settled geometry, sidebar behavior, and the design-token seam.
- [PHP bridge contract](./PHP_BRIDGE_CONTRACT.md) defines the JavaScript gateway, transport boundary, request and response shapes, errors, cancellation, and versioning.
- [Testing and verification manual](./TESTING.md) defines test layers, manual visual checks, and the clean-exit completion rule.
- [Bill of manifest](./BILL_OF_MANIFEST.md) records runtime and development dependencies, vendored assets, and dependency approval rules.

## Source of truth

Edit the Markdown files in this directory. Run `npm run docs:build` from `experimental/gantt-engine` to regenerate `docs/index.html`. You do not need to run a command to read the documentation: open `docs/index.html` directly in a browser.
Double-clicking `docs/index.html` opens the rendered layout immediately. A browser cannot run the Node generator or reliably read sibling Markdown files from a `file://` page, so regenerate the portal after documentation changes.

The generated portal includes the full Markdown content, section navigation, and keyboard-accessible skip navigation. It does not require a server or network access.
