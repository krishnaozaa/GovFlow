.PHONY: dev test eval

dev:
	@trap 'kill 0' INT TERM EXIT; npm run dev & PYTHONPATH=services/api services/api/.venv/bin/uvicorn govflow.app:app --host 0.0.0.0 --port 8000 --reload & wait

test:
	npm run lint
	npm run build
	PYTHONPATH=services/api services/api/.venv/bin/python -m pytest services/api/tests -q

eval:
	npm run eval
