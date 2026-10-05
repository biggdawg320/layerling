import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/shared-projects/route";

/*
 * When the folder behind LAYERLING_SHARED_PROJECTS_DIR cannot be created, the
 * raw filesystem error ("EACCES: permission denied, mkdir '/data'") is handed
 * back as-is. It never says which setting picked that path, which is exactly
 * what sent https://github.com/henmedia/layerling/issues/114 down the wrong
 * track: the folder name in the error looked hard-coded instead of coming
 * from a stale LAYERLING_SHARED_PROJECTS_DIR value.
 */

const SHARED_PROJECTS_ENV = "LAYERLING_SHARED_PROJECTS_DIR";

let sharedProjectsRoot = "";
let previousSharedProjectsRoot: string | undefined;

describe("shared projects storage errors", () => {
  beforeEach(async () => {
    previousSharedProjectsRoot = process.env[SHARED_PROJECTS_ENV];
    sharedProjectsRoot = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "layerling-shared-error-")), "shared-projects");
    process.env[SHARED_PROJECTS_ENV] = sharedProjectsRoot;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (previousSharedProjectsRoot === undefined) delete process.env[SHARED_PROJECTS_ENV];
    else process.env[SHARED_PROJECTS_ENV] = previousSharedProjectsRoot;
    await fs.rm(path.dirname(sharedProjectsRoot), { recursive: true, force: true });
  });

  it("names the configuring environment variable when the shared projects folder can't be created", async () => {
    const permissionError = Object.assign(
      new Error(`EACCES: permission denied, mkdir '${sharedProjectsRoot}'`),
      { code: "EACCES", path: sharedProjectsRoot },
    );
    vi.spyOn(fs, "mkdir").mockRejectedValueOnce(permissionError);

    const response = await GET(new Request("http://localhost/api/shared-projects"));
    const payload = await response.json() as { error?: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain(SHARED_PROJECTS_ENV);
  });
});
