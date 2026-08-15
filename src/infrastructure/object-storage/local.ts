import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { getEnvironment } from "@/infrastructure/config/env";
import type { ObjectStorage } from "@/modules/inbox/application/ports";

function safeKey(tenantId: string, key: string) {
  const value = normalize(join(tenantId, key));
  if (value.startsWith("..") || value.includes(`..${sep}`))
    throw new Error("STORAGE_KEY_INVALID");
  return value;
}
export class LocalObjectStorage implements ObjectStorage {
  private root = getEnvironment().FILE_STORAGE_PATH;
  async put(input: {
    tenantId: string;
    key: string;
    body: AsyncIterable<Uint8Array> | Uint8Array;
    contentType: string;
  }) {
    const file = join(this.root, safeKey(input.tenantId, input.key));
    await mkdir(dirname(file), { recursive: true });
    const chunks: Uint8Array[] = [];
    if (input.body instanceof Uint8Array) chunks.push(input.body);
    else for await (const chunk of input.body) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    await writeFile(file, body, { mode: 0o600 });
    return {
      key: input.key,
      sha256: createHash("sha256").update(body).digest("hex"),
      sizeBytes: body.byteLength,
    };
  }
  async read(input: { tenantId: string; key: string }) {
    return readFile(join(this.root, safeKey(input.tenantId, input.key)));
  }
  async remove(input: { tenantId: string; key: string }) {
    await rm(join(this.root, safeKey(input.tenantId, input.key)), { force: true });
  }
}
