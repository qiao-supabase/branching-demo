# Installing Supabase Postgres from GitHub Actions Artifact

## Overview
This skill describes how to download and install the Supabase Postgres binary distribution from GitHub Actions artifacts. This is useful for using Supabase's PostgreSQL distribution with the Supabase CLI or in containerized environments.

## Artifact Details
- **Repository**: supabase/postgres
- **Artifact**: supabase-postgres-linux-x64
- **PostgreSQL Version**: 17
- **Includes**:
  - PostgreSQL 17 binaries (postgres, psql, initdb, pg_ctl, pg_dump, pg_restore, createdb, dropdb, pg_config)
  - Bundled libraries (glibc 2.40, ICU, OpenSSL, etc.)
  - Extensions (supautils, pg_stat_statements, uuid-ossp, and standard contrib extensions)
  - Supabase CLI configuration templates

## Installation Location
The artifact is installed to `/opt/supabase-postgres/` with the following structure:
```
/opt/supabase-postgres/
├── bin/                    # PostgreSQL binaries and wrapper scripts
├── lib/                    # Shared libraries and extensions
├── share/                  # Data files, extensions SQL, and config templates
│   ├── postgresql/         # PostgreSQL share files
│   └── supabase-cli/       # Supabase CLI configuration templates
└── cli-receipt.json        # Build metadata
```

## Downloading the Artifact

### Using nightly.link (Recommended for CI)
The artifact can be downloaded without authentication using nightly.link:

```bash
# Download the artifact
curl -sL -o /tmp/supabase-postgres.zip \
  "https://nightly.link/supabase/postgres/actions/runs/21614031444/supabase-postgres-linux-x64.zip"

# Extract
mkdir -p /opt/supabase-postgres
cd /opt/supabase-postgres
unzip /tmp/supabase-postgres.zip
```

### Using GitHub CLI (Requires Authentication)
```bash
gh run download 21614031444 \
  -R supabase/postgres \
  -n supabase-postgres-linux-x64 \
  -D /opt/supabase-postgres
```

## Compatibility Notes

### Binary Compatibility
The binaries are built using Nix and include:
- A bundled glibc 2.40
- Bundled dynamic linker (ld-linux-x86-64.so.2)
- All required shared libraries

**Important**: These binaries require either:
1. **Nix environment**: For direct execution, install Nix and use `nix-shell` or `nix develop`
2. **Container runtime**: Run in a Docker/Podman container with compatible base image
3. **Compatible glibc**: System must have glibc 2.40+ with compatible kernel

### Extension Compatibility
The included extensions (supautils.so, etc.) are compiled for PostgreSQL 17 and **will not work** with PostgreSQL 16 or earlier versions. You will see this error:
```
ERROR: incompatible library: version mismatch
DETAIL: Server is version 16, library is version 17.
```

## Configuration Templates

The Supabase CLI configuration templates are located at:
- `/opt/supabase-postgres/share/supabase-cli/config/postgresql.conf.template`
- `/opt/supabase-postgres/share/supabase-cli/config/pg_hba.conf.template`
- `/opt/supabase-postgres/share/supabase-cli/config/pg_ident.conf.template`

### postgresql.conf.template
Key settings for local development:
```
listen_addresses = '127.0.0.1'
port = 54322
max_connections = 100
shared_preload_libraries = 'supautils'
```

## Using with Supabase CLI

When the Supabase CLI is installed, it can use these binaries for local development:

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize a Supabase project
supabase init

# Start local development (uses bundled PostgreSQL)
supabase start
```

## Troubleshooting

### Segmentation Fault on Startup
If the binaries crash with SIGSEGV, this indicates glibc/kernel incompatibility. Solutions:
1. Use Docker: `docker run -v /opt/supabase-postgres:/pg ubuntu:24.04 /pg/bin/postgres --version`
2. Install Nix and run: `nix-shell -p stdenv --run '/opt/supabase-postgres/bin/postgres --version'`

### Stack Smashing Detected
This indicates library version conflicts. Ensure LD_LIBRARY_PATH points to the bundled libraries:
```bash
export LD_LIBRARY_PATH=/opt/supabase-postgres/lib:$LD_LIBRARY_PATH
```

### Extension Version Mismatch
Extensions are for PostgreSQL 17 only. For PostgreSQL 16, use system-provided extensions or compile supautils from source.

## Reference
- Supabase Postgres Repository: https://github.com/supabase/postgres
- GitHub Actions Artifact: https://github.com/supabase/postgres/actions/runs/21614031444/artifacts/5351244468
- nightly.link Service: https://nightly.link/
