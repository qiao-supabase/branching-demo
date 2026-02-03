#!/usr/bin/env npx tsx

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Default local Supabase configuration
export const SUPABASE_URL =
  process.env.SUPABASE_URL || "http://localhost:54321";
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Storage API URL - can be different from auth URL when running standalone
export const STORAGE_URL =
  process.env.STORAGE_URL || process.env.SUPABASE_URL || "http://localhost:54321";

export function getSupabaseClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export interface Bucket {
  id: string;
  name: string;
  public: boolean;
  created_at?: string;
  updated_at?: string;
  file_size_limit?: number | null;
  allowed_mime_types?: string[] | null;
}

export interface StorageObject {
  id: string;
  name: string;
  bucket_id: string;
  owner?: string;
  created_at?: string;
  updated_at?: string;
  last_accessed_at?: string;
  metadata?: Record<string, unknown>;
}

export interface UploadResult {
  path: string;
  id?: string;
}

// Check if storage is available
export async function isStorageAvailable(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.listBuckets();
    return !error;
  } catch {
    return false;
  }
}

// Bucket operations
export async function createBucket(
  name: string,
  options: { public?: boolean; fileSizeLimit?: number; allowedMimeTypes?: string[] } = {}
): Promise<Bucket> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.createBucket(name, {
    public: options.public ?? false,
    fileSizeLimit: options.fileSizeLimit,
    allowedMimeTypes: options.allowedMimeTypes,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { id: data.name, name: data.name, public: options.public ?? false };
}

export async function listBuckets(): Promise<Bucket[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    throw new Error(error.message);
  }

  return data.map((b) => ({
    id: b.id,
    name: b.name,
    public: b.public,
    created_at: b.created_at,
    updated_at: b.updated_at,
    file_size_limit: b.file_size_limit,
    allowed_mime_types: b.allowed_mime_types,
  }));
}

export async function getBucket(name: string): Promise<Bucket> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.getBucket(name);

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    name: data.name,
    public: data.public,
    created_at: data.created_at,
    updated_at: data.updated_at,
    file_size_limit: data.file_size_limit,
    allowed_mime_types: data.allowed_mime_types,
  };
}

export async function deleteBucket(name: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.deleteBucket(name);

  if (error) {
    throw new Error(error.message);
  }
}

export async function emptyBucket(name: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.emptyBucket(name);

  if (error) {
    throw new Error(error.message);
  }
}

// File operations
export async function uploadFile(
  bucketName: string,
  filePath: string,
  content: string | Buffer | Blob,
  options: { contentType?: string; upsert?: boolean } = {}
): Promise<UploadResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, content, {
      contentType: options.contentType,
      upsert: options.upsert ?? false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return { path: data.path, id: data.id };
}

export async function uploadLocalFile(
  bucketName: string,
  remotePath: string,
  localPath: string,
  options: { upsert?: boolean } = {}
): Promise<UploadResult> {
  const fileContent = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();

  // Determine content type from extension
  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  return uploadFile(bucketName, remotePath, fileContent, {
    contentType,
    upsert: options.upsert,
  });
}

export async function downloadFile(
  bucketName: string,
  filePath: string
): Promise<Blob> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucketName)
    .download(filePath);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function downloadFileAsText(
  bucketName: string,
  filePath: string
): Promise<string> {
  const blob = await downloadFile(bucketName, filePath);
  return blob.text();
}

export async function downloadFileToLocal(
  bucketName: string,
  remotePath: string,
  localPath: string
): Promise<void> {
  const blob = await downloadFile(bucketName, remotePath);
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(localPath, buffer);
}

export async function deleteFile(
  bucketName: string,
  filePaths: string | string[]
): Promise<void> {
  const supabase = getSupabaseClient();
  const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
  const { error } = await supabase.storage.from(bucketName).remove(paths);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listFiles(
  bucketName: string,
  folderPath?: string,
  options: { limit?: number; offset?: number } = {}
): Promise<StorageObject[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucketName)
    .list(folderPath, {
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    });

  if (error) {
    throw new Error(error.message);
  }

  return data.map((obj) => ({
    id: obj.id ?? '',
    name: obj.name,
    bucket_id: bucketName,
    created_at: obj.created_at,
    updated_at: obj.updated_at,
    last_accessed_at: obj.last_accessed_at,
    metadata: obj.metadata,
  }));
}

export async function moveFile(
  bucketName: string,
  fromPath: string,
  toPath: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from(bucketName)
    .move(fromPath, toPath);

  if (error) {
    throw new Error(error.message);
  }
}

export async function copyFile(
  bucketName: string,
  fromPath: string,
  toPath: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from(bucketName)
    .copy(fromPath, toPath);

  if (error) {
    throw new Error(error.message);
  }
}

// URL operations
export function getPublicUrl(bucketName: string, filePath: string): string {
  const supabase = getSupabaseClient();
  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function createSignedUrl(
  bucketName: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

export async function createSignedUploadUrl(
  bucketName: string,
  filePath: string
): Promise<{ signedUrl: string; token: string; path: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUploadUrl(filePath);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// CLI Commands
function printUsage() {
  console.log(`
Usage: npm run storage -- <command> [options]

Manages files in Supabase Storage.

Commands:
  list-buckets                          List all buckets
  create-bucket <name> [--public]       Create a new bucket
  delete-bucket <name>                  Delete a bucket

  upload <bucket> <remote-path> <local-file>  Upload a file
  download <bucket> <remote-path> <local-file> Download a file
  delete <bucket> <path>                Delete a file
  list <bucket> [folder]                List files in a bucket

  url <bucket> <path>                   Get public URL
  sign <bucket> <path> [expires]        Create signed URL

Environment Variables:
  SUPABASE_URL              Supabase API URL (default: http://localhost:54321)
  SUPABASE_SERVICE_ROLE_KEY Service role key for admin operations
  STORAGE_URL               Storage API URL if different from SUPABASE_URL

Examples:
  npm run storage -- list-buckets
  npm run storage -- create-bucket my-bucket --public
  npm run storage -- upload my-bucket images/logo.png ./logo.png
  npm run storage -- download my-bucket images/logo.png ./downloaded-logo.png
  npm run storage -- list my-bucket images/
  npm run storage -- sign my-bucket images/logo.png 7200
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];

  try {
    console.log(`Storage URL: ${STORAGE_URL}`);

    // Check if storage is available
    const available = await isStorageAvailable();
    if (!available) {
      console.error("Error: Storage service is not available. Make sure Supabase is running.");
      process.exit(1);
    }

    switch (command) {
      case "list-buckets": {
        const buckets = await listBuckets();
        console.log("\nBuckets:");
        if (buckets.length === 0) {
          console.log("  (no buckets)");
        } else {
          for (const bucket of buckets) {
            console.log(`  - ${bucket.name} (${bucket.public ? "public" : "private"})`);
          }
        }
        break;
      }

      case "create-bucket": {
        const bucketName = args[1];
        if (!bucketName) {
          console.error("Error: Bucket name required");
          process.exit(1);
        }
        const isPublic = args.includes("--public");
        const bucket = await createBucket(bucketName, { public: isPublic });
        console.log(`\nBucket created: ${bucket.name} (${isPublic ? "public" : "private"})`);
        break;
      }

      case "delete-bucket": {
        const bucketName = args[1];
        if (!bucketName) {
          console.error("Error: Bucket name required");
          process.exit(1);
        }
        await emptyBucket(bucketName);
        await deleteBucket(bucketName);
        console.log(`\nBucket deleted: ${bucketName}`);
        break;
      }

      case "upload": {
        const [, bucketName, remotePath, localPath] = args;
        if (!bucketName || !remotePath || !localPath) {
          console.error("Error: Usage: upload <bucket> <remote-path> <local-file>");
          process.exit(1);
        }
        if (!fs.existsSync(localPath)) {
          console.error(`Error: File not found: ${localPath}`);
          process.exit(1);
        }
        const result = await uploadLocalFile(bucketName, remotePath, localPath, { upsert: true });
        console.log(`\nFile uploaded: ${result.path}`);
        break;
      }

      case "download": {
        const [, bucketName, remotePath, localPath] = args;
        if (!bucketName || !remotePath || !localPath) {
          console.error("Error: Usage: download <bucket> <remote-path> <local-file>");
          process.exit(1);
        }
        await downloadFileToLocal(bucketName, remotePath, localPath);
        console.log(`\nFile downloaded to: ${localPath}`);
        break;
      }

      case "delete": {
        const [, bucketName, filePath] = args;
        if (!bucketName || !filePath) {
          console.error("Error: Usage: delete <bucket> <path>");
          process.exit(1);
        }
        await deleteFile(bucketName, filePath);
        console.log(`\nFile deleted: ${filePath}`);
        break;
      }

      case "list": {
        const [, bucketName, folderPath] = args;
        if (!bucketName) {
          console.error("Error: Bucket name required");
          process.exit(1);
        }
        const files = await listFiles(bucketName, folderPath);
        console.log(`\nFiles in ${bucketName}${folderPath ? "/" + folderPath : ""}:`);
        if (files.length === 0) {
          console.log("  (empty)");
        } else {
          for (const file of files) {
            console.log(`  - ${file.name}`);
          }
        }
        break;
      }

      case "url": {
        const [, bucketName, filePath] = args;
        if (!bucketName || !filePath) {
          console.error("Error: Usage: url <bucket> <path>");
          process.exit(1);
        }
        const url = getPublicUrl(bucketName, filePath);
        console.log(`\nPublic URL: ${url}`);
        break;
      }

      case "sign": {
        const [, bucketName, filePath, expiresStr] = args;
        if (!bucketName || !filePath) {
          console.error("Error: Usage: sign <bucket> <path> [expires-seconds]");
          process.exit(1);
        }
        const expires = expiresStr ? parseInt(expiresStr, 10) : 3600;
        const signedUrl = await createSignedUrl(bucketName, filePath, expires);
        console.log(`\nSigned URL (expires in ${expires}s): ${signedUrl}`);
        break;
      }

      default:
        console.error(`Error: Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

// Only run main if this is the entry point
const isMain = process.argv[1]?.includes("storage");
if (isMain) {
  main();
}
