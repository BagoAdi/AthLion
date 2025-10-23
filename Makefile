python -m pip install \
		fastapi \
		"uvicorn[standard]" \
		SQLAlchemy \
		alembic \
		"psycopg[binary]" \
		"psycopg2-binary" \
		"passlib[bcrypt]" \
		"python-jose[cryptography]" \
		python-dotenv \
		"pydantic[email]"

run:
	uvicorn app.main:app --reload