#!/bin/bash
export PGRST_DB_URI="postgres://authenticator@localhost:54322/postgres?host=/tmp&sslmode=disable"
export PGRST_DB_SCHEMAS="public"
export PGRST_DB_ANON_ROLE="anon"
export PGRST_JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"
export PGRST_SERVER_HOST="0.0.0.0"
export PGRST_SERVER_PORT="3000"
export PGRST_JWT_ROLE_CLAIM_KEY=".role"
export PGRST_LOG_LEVEL="info"
./postgrest
