/** Trusted SDK manifests are already placed. Bun owns all dependency resolution. */
import { lstat, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

const SDK_WORKSPACES = [
	"packages/sdk",
	"packages/miniapp-sdk",
	"packages/project-protocol",
];
const INSTALL_FIELDS = [
	"name",
	"version",
	"dependencies",
	"devDependencies",
	"optionalDependencies",
	"peerDependencies",
];
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const INTEGRITY = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

function fail() {
	throw new Error(
		"SDK dependency preparation rejected inconsistent or unsafe lock metadata",
	);
}
function object(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) fail();
	return value;
}
function safeLock(raw) {
	const lock = object(Bun.JSONC.parse(raw));
	if (lock.lockfileVersion !== 1) fail();
	object(lock.workspaces);
	for (const entry of Object.values(object(lock.packages))) {
		if (!Array.isArray(entry) || typeof entry[0] !== "string") fail();
		const at = entry[0].indexOf("@", 1);
		if (at < 1) fail();
		const resolution = entry[0].slice(at + 1);
		if (resolution.startsWith("workspace:")) {
			const path = resolution.slice(10);
			if (
				path.includes("\\") ||
				path.startsWith("/") ||
				path.split("/").some((part) => !part || part === ".." || part === ".")
			)
				fail();
		} else if (
			!SEMVER.test(resolution) ||
			entry.length !== 4 ||
			entry[1] !== "" ||
			typeof entry[3] !== "string" ||
			!INTEGRITY.test(entry[3])
		) {
			fail();
		}
	}
	return lock;
}
function installMetadata(manifest) {
	return Object.fromEntries(
		INSTALL_FIELDS.map((key) => [key, manifest[key] ?? null]),
	);
}
function bun(root, args) {
	const result = Bun.spawnSync(
		[process.execPath, "install", ...args, "--ignore-scripts"],
		{
			cwd: root,
			stdin: "ignore",
			stdout: "ignore",
			stderr: "ignore",
		},
	);
	if (result.exitCode !== 0) fail();
}
async function regular(path) {
	const status = await lstat(path);
	if (!status.isFile() || status.isSymbolicLink()) fail();
}

/** Reconcile only the SDK delta after Bun proves the original app still matches its lock. */
export async function prepareSdkDependencies(root) {
	const path = join(root, "bun.lock");
	await regular(path);
	const original = await readFile(path, "utf8");
	const lock = safeLock(original);
	const manifests = await Promise.all(
		SDK_WORKSPACES.map(async (workspace) => {
			const path = join(root, workspace, "package.json");
			await regular(path);
			const raw = await readFile(path, "utf8");
			const current = object(JSON.parse(raw));
			const previous = object(lock.workspaces[workspace]);
			return {
				path,
				raw,
				previous,
				changed: !isDeepStrictEqual(
					installMetadata(current),
					installMetadata(previous),
				),
			};
		}),
	);
	if (!manifests.some((manifest) => manifest.changed)) return;
	try {
		// Substitute SDK install metadata only, never the application's manifests.
		// This makes frozen preflight validate the *original* graph before SDK updates.
		try {
			for (const manifest of manifests)
				await writeFile(manifest.path, JSON.stringify(manifest.previous));
			bun(root, ["--frozen-lockfile", "--dry-run"]);
		} finally {
			for (const manifest of manifests)
				await writeFile(manifest.path, manifest.raw);
		}
		bun(root, ["--lockfile-only"]);
		safeLock(await readFile(path, "utf8"));
	} catch (error) {
		await writeFile(path, original);
		throw error;
	}
}

if (import.meta.main) {
	try {
		if (process.argv.length !== 3) fail();
		await prepareSdkDependencies(process.argv[2]);
	} catch {
		console.error(
			"SDK dependency preparation failed: lockfile or manifests are inconsistent",
		);
		process.exitCode = 1;
	}
}
