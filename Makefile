.PHONY: setup fixtures pipeline app test release verify clean

setup:      ## Create .venv from uv.lock (developer workflow)
	uv sync

fixtures:   ## Regenerate deterministic synthetic fixtures (committed; normally not needed)
	uv run python scripts/generate_fixtures.py

pipeline:   ## Run ingestion + dbt build from the CLI
	uv run python -m pipeline.run

app:        ## Launch the app (same as ./start.command)
	./start.command

test:       ## Unit, integration (real dbt) and smoke tests
	uv run pytest -q

release:    ## Build the offline macOS release for this machine's architecture
	packaging/build_macos.sh

verify:     ## Simulated clean-Mac verification of the release archive
	packaging/verify_clean_mac.sh

clean:
	rm -rf dist .demo_home .pytest_cache
