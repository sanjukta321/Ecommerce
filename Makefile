BENCH_DIR := $(abspath ../..)
FRONTEND_DIR := $(CURDIR)/frontend

.PHONY: install dev build deploy

## Install frontend dependencies
install:
	cd $(FRONTEND_DIR) && npm install

## Start Vite dev server (API proxied to localhost:8100)
dev:
	cd $(FRONTEND_DIR) && npm run dev

## Build React app into store_customizations/public/
build:
	cd $(FRONTEND_DIR) && npm run build

## Full deploy: build React, then copy assets into Frappe's site assets dir
deploy: build
	cd $(BENCH_DIR) && bench build --app store_customizations
	@echo "Done. Restart bench if needed: bench restart"
