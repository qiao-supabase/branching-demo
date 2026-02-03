import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  isStorageAvailable,
  createBucket,
  listBuckets,
  getBucket,
  deleteBucket,
  emptyBucket,
  uploadFile,
  downloadFileAsText,
  deleteFile,
  listFiles,
  moveFile,
  copyFile,
  getPublicUrl,
  createSignedUrl,
} from "./storage";

// Generate unique bucket name for this test run
const testBucketName = `test-bucket-${Date.now()}`;
let storageAvailable = false;

describe("Storage Operations", () => {
  beforeAll(async () => {
    // Check if storage service is available
    storageAvailable = await isStorageAvailable();
    if (!storageAvailable) {
      console.log("Storage service not available, skipping tests");
    }
  });

  afterAll(async () => {
    // Cleanup: delete test bucket if it exists
    if (storageAvailable) {
      try {
        await emptyBucket(testBucketName);
        await deleteBucket(testBucketName);
      } catch {
        // Bucket might not exist, that's ok
      }
    }
  });

  describe("Bucket Operations", () => {
    it("should create a bucket", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const bucket = await createBucket(testBucketName, { public: true });
      expect(bucket.name).toBe(testBucketName);
      expect(bucket.public).toBe(true);
    });

    it("should list buckets", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const buckets = await listBuckets();
      expect(Array.isArray(buckets)).toBe(true);
      const testBucket = buckets.find((b) => b.name === testBucketName);
      expect(testBucket).toBeDefined();
    });

    it("should get bucket details", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const bucket = await getBucket(testBucketName);
      expect(bucket.name).toBe(testBucketName);
      expect(bucket.public).toBe(true);
    });

    it("should fail to get non-existent bucket", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      await expect(getBucket("non-existent-bucket-12345")).rejects.toThrow();
    });
  });

  describe("File Operations", () => {
    const testFileName = "test-file.txt";
    const testFileContent = "Hello, Storage!";

    it("should upload a file", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const result = await uploadFile(testBucketName, testFileName, testFileContent, {
        contentType: "text/plain",
      });
      expect(result.path).toBe(testFileName);
    });

    it("should download a file", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const content = await downloadFileAsText(testBucketName, testFileName);
      expect(content).toBe(testFileContent);
    });

    it("should list files in bucket", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const files = await listFiles(testBucketName);
      expect(Array.isArray(files)).toBe(true);
      const testFile = files.find((f) => f.name === testFileName);
      expect(testFile).toBeDefined();
    });

    it("should copy a file", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const copyName = "test-file-copy.txt";
      await copyFile(testBucketName, testFileName, copyName);

      const files = await listFiles(testBucketName);
      const copiedFile = files.find((f) => f.name === copyName);
      expect(copiedFile).toBeDefined();

      // Cleanup copy
      await deleteFile(testBucketName, copyName);
    });

    it("should move a file", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const movedName = "test-file-moved.txt";

      // First upload a file to move
      await uploadFile(testBucketName, "to-move.txt", "content to move", {
        contentType: "text/plain",
      });

      await moveFile(testBucketName, "to-move.txt", movedName);

      const files = await listFiles(testBucketName);
      const movedFile = files.find((f) => f.name === movedName);
      expect(movedFile).toBeDefined();

      const originalFile = files.find((f) => f.name === "to-move.txt");
      expect(originalFile).toBeUndefined();

      // Cleanup moved file
      await deleteFile(testBucketName, movedName);
    });

    it("should get public URL", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const url = getPublicUrl(testBucketName, testFileName);
      expect(url).toContain(testBucketName);
      expect(url).toContain(testFileName);
    });

    it("should create signed URL", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const signedUrl = await createSignedUrl(testBucketName, testFileName, 3600);
      expect(signedUrl).toContain("token=");
    });

    it("should delete a file", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      await deleteFile(testBucketName, testFileName);

      const files = await listFiles(testBucketName);
      const deletedFile = files.find((f) => f.name === testFileName);
      expect(deletedFile).toBeUndefined();
    });
  });

  describe("Folder Operations", () => {
    const folderName = "test-folder";
    const fileName = "nested-file.txt";
    const filePath = `${folderName}/${fileName}`;

    it("should upload to folder path", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const result = await uploadFile(testBucketName, filePath, "nested content", {
        contentType: "text/plain",
      });
      expect(result.path).toBe(filePath);
    });

    it("should list files in folder", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      const files = await listFiles(testBucketName, folderName);
      expect(Array.isArray(files)).toBe(true);
      const nestedFile = files.find((f) => f.name === fileName);
      expect(nestedFile).toBeDefined();
    });

    it("should delete file from folder", async () => {
      if (!storageAvailable) {
        console.log("Skipping: Storage not available");
        return;
      }

      await deleteFile(testBucketName, filePath);

      const files = await listFiles(testBucketName, folderName);
      const deletedFile = files.find((f) => f.name === fileName);
      expect(deletedFile).toBeUndefined();
    });
  });
});
