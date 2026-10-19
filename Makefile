.PHONY: setup fixtures pipeline app ui export test release verify clean

setup:      ## Create .venv from uv.lock (developer workflow)
	uv sync

fixtures:   ## Regenerate deterministic synthetic fixtures (committed; normally not needed)
	uv run python scripts/generate_fixtures.py

pipeline:   ## Run ingestion + dbt build from the CLI
	uv run python -m pipeline.run

app:        ## Launch API + UI (same as ./start.command)
	./start.command

ui:         ## Rebuild the React UI into web/dist (commit the result)
	cd web && npm ci && npm run build

export:     ## Export the Architecture page to docs/export/*.pdf and *.html (needs Google Chrome)
	uv run python scripts/export_architecture.py

test:       ## Unit, integration (real dbt) and smoke tests
	uv run pytest -q

release:    ## Build the offline macOS release for this machine's architecture
	packaging/build_macos.sh

verify:     ## Simulated clean-Mac verification of the release archive
	packaging/verify_clean_mac.sh

clean:
	rm -rf dist .demo_home .pytest_cache web/node_modules
