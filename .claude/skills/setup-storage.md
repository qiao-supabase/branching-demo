# Setting Up Supabase Storage API

## Overview
Supabase Storage provides file storage and management capabilities. This skill describes how to download, configure, and run the Storage API locally for development and testing.

## Prerequisites
- PostgreSQL running with Supabase-compatible schema (see [setup-local-postgres.md](setup-local-postgres.md))
- GoTrue running for authentication (see [setup-gotrue.md](setup-gotrue.md))
- Node.js 18+ (Storage API is a Node.js application)

## Step 1: Clone Storage API Repository

```bash
git clone --depth 1 https://github.com/supabase/storage-api.git /tmp/storage-api
cd /tmp/storage-api
npm install
```

Or download a specific release:
```bash
curl -L https://github.com/supabase/storage-api/archive/refs/tags/v1.22.2.tar.gz -o storage-api.tar.gz
tar -xzf storage-api.tar.gz
cd storage-api-1.22.2
npm install
```

**Check latest releases:**
https://github.com/supabase/storage-api/releases

## Step 2: Create Local Storage Directory

Create a directory to store uploaded files:

```bash
mkdir -p ./storage-data
```

## Step 3: Configure Database for Storage

Ensure the storage schema and required tables exist. If you've run Supabase migrations, this should already be set up. Otherwise:

```bash
psql -U supabase_admin -d postgres <<'EOF'
-- Create storage schema if not exists
CREATE SCHEMA IF NOT EXISTS storage;

-- Grant permissions to storage admin
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON SEQUENCES TO supabase_storage_admin;

-- Create buckets table
CREATE TABLE IF NOT EXISTS storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    owner UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    public BOOLEAN DEFAULT false,
    avif_autodetection BOOLEAN DEFAULT false,
    file_size_limit BIGINT,
    allowed_mime_types TEXT[]
);

-- Create objects table
CREATE TABLE IF NOT EXISTS storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT REFERENCES storage.buckets(id),
    name TEXT,
    owner UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_accessed_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB,
    path_tokens TEXT[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
    version TEXT,
    owner_id TEXT,
    UNIQUE(bucket_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_objects_bucket_id ON storage.objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_objects_name ON storage.objects(name);
CREATE INDEX IF NOT EXISTS idx_objects_owner ON storage.objects(owner);
CREATE INDEX IF NOT EXISTS idx_objects_path_tokens ON storage.objects USING GIN(path_tokens);

-- Grant permissions to API roles
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO anon, authenticated, service_role;

-- RLS policies for buckets
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public buckets are viewable by everyone"
ON storage.buckets FOR SELECT
USING (public = true);

CREATE POLICY "Users can view their own buckets"
ON storage.buckets FOR SELECT
USING (auth.uid() = owner);

CREATE POLICY "Service role can manage all buckets"
ON storage.buckets FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS policies for objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Objects in public buckets are viewable by everyone"
ON storage.objects FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM storage.buckets
        WHERE buckets.id = objects.bucket_id
        AND buckets.public = true
    )
);

CREATE POLICY "Users can view their own objects"
ON storage.objects FOR SELECT
USING (auth.uid() = owner);

CREATE POLICY "Users can upload to their own objects"
ON storage.objects FOR INSERT
WITH CHECK (auth.uid() = owner);

CREATE POLICY "Users can update their own objects"
ON storage.objects FOR UPDATE
USING (auth.uid() = owner);

CREATE POLICY "Users can delete their own objects"
ON storage.objects FOR DELETE
USING (auth.uid() = owner);

CREATE POLICY "Service role can manage all objects"
ON storage.objects FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
EOF
```

## Step 4: Create Configuration File

Create `.env.storage` in your project root:

```bash
# Database connection
DATABASE_URL=postgres://supabase_storage_admin:postgres@localhost:5432/postgres
DB_INSTALL_ROLES=false

# Storage backend - use 'file' for local filesystem
STORAGE_BACKEND=file
FILE_STORAGE_BACKEND_PATH=./storage-data

# For S3-compatible storage (MinIO, AWS S3):
# STORAGE_BACKEND=s3
# GLOBAL_S3_BUCKET=your-bucket-name
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
# AWS_REGION=us-east-1
# S3_ENDPOINT=http://localhost:9000  # For MinIO

# Server settings
PORT=5000
REGION=local

# JWT Settings - must match GoTrue/PostgREST
PGRST_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQzNjY2MjAwLCJleHAiOjE5NTkyNzc0MDB9.mock-anon-key
SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDM2NjYyMDAsImV4cCI6MTk1OTI3NzQwMH0.mock-service-key

# Auth URL (GoTrue endpoint)
GOTRUE_URL=http://localhost:9999

# PostgREST URL
POSTGREST_URL=http://localhost:3000

# File size limits
FILE_SIZE_LIMIT=52428800  # 50MB in bytes
UPLOAD_FILE_SIZE_LIMIT=52428800

# Image transformation settings
ENABLE_IMAGE_TRANSFORMATION=true
IMGPROXY_URL=http://localhost:8081

# Tenant settings (for multi-tenant setup)
IS_MULTITENANT=false
TENANT_ID=default

# Logging
LOG_LEVEL=info

# Request timeout
REQUEST_TIMEOUT=30000

# Enable signed URLs
ENABLE_SIGNED_URLS=true

# URL expiry for signed URLs (in seconds)
URL_EXPIRY_TIME=3600
```

## Step 5: Start Storage API Server

From the storage-api directory:

```bash
cd /tmp/storage-api
export $(cat /path/to/your/project/.env.storage | grep -v '^#' | xargs)
npm run start
```

Or run in background:
```bash
export $(cat .env.storage | grep -v '^#' | xargs) && npm run start > storage.log 2>&1 &
```

**Verify it's running:**
```bash
curl -s http://localhost:5000/status
# Should return: {"status":"OK"}
```

## Step 6: Create a Test Bucket

```bash
# Using service role key
SERVICE_KEY="your-service-role-jwt"

curl -X POST http://localhost:5000/bucket \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-bucket", "public": true}'
```

## API Endpoints

Storage API exposes these endpoints:

### Bucket Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/bucket` | GET | List all buckets |
| `/bucket` | POST | Create a bucket |
| `/bucket/:id` | GET | Get bucket details |
| `/bucket/:id` | PUT | Update bucket |
| `/bucket/:id` | DELETE | Delete bucket |
| `/bucket/:id/empty` | POST | Empty bucket contents |

### Object Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/object/:bucketName/*` | POST | Upload file |
| `/object/:bucketName/*` | PUT | Update file |
| `/object/:bucketName/*` | GET | Download file |
| `/object/:bucketName/*` | DELETE | Delete file |
| `/object/list/:bucketName` | POST | List objects in bucket |
| `/object/move` | POST | Move/rename object |
| `/object/copy` | POST | Copy object |

### Signed URLs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/object/sign/:bucketName/*` | POST | Create signed URL for download |
| `/object/upload/sign/:bucketName/*` | POST | Create signed URL for upload |

## Usage Examples

### Upload a File

```bash
SERVICE_KEY="your-service-role-jwt"
BUCKET="test-bucket"

# Upload a file
curl -X POST "http://localhost:5000/object/$BUCKET/my-folder/test.txt" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: text/plain" \
  -d "Hello, Storage!"
```

### Download a File

```bash
# Public bucket - no auth needed
curl "http://localhost:5000/object/public/$BUCKET/my-folder/test.txt"

# Private bucket - auth required
curl "http://localhost:5000/object/$BUCKET/my-folder/test.txt" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

### List Objects

```bash
curl -X POST "http://localhost:5000/object/list/$BUCKET" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prefix": "my-folder/", "limit": 100}'
```

### Create Signed Download URL

```bash
curl -X POST "http://localhost:5000/object/sign/$BUCKET/my-folder/test.txt" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"expiresIn": 3600}'
```

### Delete a File

```bash
curl -X DELETE "http://localhost:5000/object/$BUCKET/my-folder/test.txt" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

## Using with Supabase Client

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'http://localhost:5000',  // Storage API URL
  'your-service-role-jwt'
)

// Upload
const { data, error } = await supabase.storage
  .from('test-bucket')
  .upload('my-folder/file.txt', 'Hello World', {
    contentType: 'text/plain'
  })

// Download
const { data: file } = await supabase.storage
  .from('test-bucket')
  .download('my-folder/file.txt')

// Get public URL (for public buckets)
const { data: { publicUrl } } = supabase.storage
  .from('test-bucket')
  .getPublicUrl('my-folder/file.txt')

// Create signed URL (for private buckets)
const { data: { signedUrl } } = await supabase.storage
  .from('test-bucket')
  .createSignedUrl('my-folder/file.txt', 3600)

// List files
const { data: files } = await supabase.storage
  .from('test-bucket')
  .list('my-folder')

// Delete
const { error: deleteError } = await supabase.storage
  .from('test-bucket')
  .remove(['my-folder/file.txt'])
```

## Alternative: Using MinIO as Storage Backend

For S3-compatible storage, you can run MinIO locally:

```bash
# Run MinIO with Docker
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Or download MinIO binary
curl -O https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin ./minio server ./minio-data
```

Update `.env.storage`:
```bash
STORAGE_BACKEND=s3
GLOBAL_S3_BUCKET=storage
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_REGION=us-east-1
S3_ENDPOINT=http://localhost:9000
S3_FORCE_PATH_STYLE=true
```

Create the bucket in MinIO:
```bash
# Using MinIO client
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/storage
```

## Troubleshooting

### "Bucket not found"
- Ensure the bucket exists: Check via API or database
- Verify bucket name spelling (case-sensitive)

### "Invalid JWT"
- Ensure `PGRST_JWT_SECRET` matches your GoTrue/PostgREST configuration
- Check JWT hasn't expired
- Verify `role` claim is present in JWT

### "Permission denied"
- Check RLS policies on storage.buckets and storage.objects tables
- For public buckets, ensure `public = true`
- For authenticated access, ensure user JWT is valid

### Connection refused on port 5000
```bash
# Check if Storage API is running
pgrep -f "storage-api"

# Check logs
cat storage.log

# Restart
pkill -f "storage-api"
export $(cat .env.storage | grep -v '^#' | xargs) && npm run start > storage.log 2>&1 &
```

### File not found on disk
- Check `FILE_STORAGE_BACKEND_PATH` is correct
- Ensure the directory exists and has write permissions
- Verify file was uploaded successfully (check storage.objects table)

### Database connection errors
- Verify PostgreSQL is running
- Check `DATABASE_URL` connection string
- Ensure `supabase_storage_admin` role exists

## Stopping Storage API

```bash
pkill -f "storage-api"
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `STORAGE_BACKEND` | Backend type: `file` or `s3` | `file` |
| `FILE_STORAGE_BACKEND_PATH` | Path for local file storage | `./data` |
| `PORT` | HTTP server port | `5000` |
| `PGRST_JWT_SECRET` | Secret for verifying JWTs | Required |
| `GOTRUE_URL` | GoTrue auth service URL | Required |
| `FILE_SIZE_LIMIT` | Max file size in bytes | 52428800 |
| `ENABLE_IMAGE_TRANSFORMATION` | Enable image resizing | false |
| `LOG_LEVEL` | Logging verbosity | `info` |

## Reference

- Storage API Repository: https://github.com/supabase/storage-api
- Storage API Releases: https://github.com/supabase/storage-api/releases
- Supabase Storage Docs: https://supabase.com/docs/guides/storage
- MinIO: https://min.io/
