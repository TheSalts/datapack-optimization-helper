import * as https from "https";

export interface VersionInfo {
    format: number;
    minor: number;
    label: string;
    releases: string[];
    snapshots: string[];
}

interface SpyglassVersion {
    id: string;
    name: string;
    type: string;
    stable: boolean;
    data_pack_version: number;
    data_pack_version_minor?: number;
    resource_pack_version: number;
    resource_pack_version_minor?: number;
}

const dataPackVersionMap = new Map<string, VersionInfo>();
const resourcePackVersionMap = new Map<string, VersionInfo>();
let fetchedSuccessfully = false;

function formatVersionRange(versions: string[]): string {
    if (versions.length === 0) {
        return "";
    }
    if (versions.length === 1) {
        return versions[0];
    }
    return `${versions[versions.length - 1]} - ${versions[0]}`;
}

function buildLabel(releases: string[], snapshots: string[]): string {
    const list = releases.length > 0 ? releases : snapshots;
    return formatVersionRange(list);
}

function fetchJson(url: string): Promise<SpyglassVersion[]> {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                let data = "";
                res.on("data", (chunk: string) => {
                    data += chunk;
                });
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(data) as SpyglassVersion[]);
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .on("error", reject);
    });
}

type RawBuckets = Map<string, { releases: string[]; snapshots: string[] }>;

function bucketVersion(buckets: RawBuckets, major: number, minor: number, name: string, stable: boolean): void {
    const key = `${major}.${minor}`;
    let entry = buckets.get(key);
    if (!entry) {
        entry = { releases: [], snapshots: [] };
        buckets.set(key, entry);
    }
    (stable ? entry.releases : entry.snapshots).push(name);
}

function populateMap(target: Map<string, VersionInfo>, buckets: RawBuckets): void {
    target.clear();
    for (const [key, { releases, snapshots }] of buckets) {
        const [major, minor] = key.split(".").map(Number);
        target.set(key, {
            format: major,
            minor,
            label: buildLabel(releases, snapshots),
            releases,
            snapshots,
        });
    }
}

export async function fetchVersionData(): Promise<void> {
    if (fetchedSuccessfully) {
        return;
    }

    try {
        const versions = await fetchJson("https://api.spyglassmc.com/mcje/versions");

        const dpBuckets: RawBuckets = new Map();
        const rpBuckets: RawBuckets = new Map();

        for (const v of versions) {
            if (typeof v.data_pack_version === "number" && v.data_pack_version > 0) {
                bucketVersion(dpBuckets, v.data_pack_version, v.data_pack_version_minor ?? 0, v.name, v.stable);
            }
            if (typeof v.resource_pack_version === "number" && v.resource_pack_version > 0) {
                bucketVersion(rpBuckets, v.resource_pack_version, v.resource_pack_version_minor ?? 0, v.name, v.stable);
            }
        }

        populateMap(dataPackVersionMap, dpBuckets);
        populateMap(resourcePackVersionMap, rpBuckets);

        fetchedSuccessfully = true;
        console.log(
            `[versionData] Loaded ${dataPackVersionMap.size} data pack versions, ${resourcePackVersionMap.size} resource pack versions`,
        );
    } catch (error) {
        console.error("[versionData] Failed to fetch version data:", error);
    }
}

function buildLabelWithSnapshots(releases: string[], snapshots: string[]): string {
    const parts: string[] = [];
    const releaseRange = formatVersionRange(releases);
    const snapshotRange = formatVersionRange(snapshots);
    if (releaseRange) {
        parts.push(releaseRange);
    }
    if (snapshotRange) {
        parts.push(snapshotRange);
    }
    return parts.join(", ");
}

function formatLabel(info: VersionInfo, includeSnapshots?: boolean, preferStable?: boolean): string {
    if (preferStable && info.releases.length > 0) {
        return formatVersionRange(info.releases);
    }
    if (includeSnapshots) {
        return buildLabelWithSnapshots(info.releases, info.snapshots);
    }
    return info.label;
}

export function getVersionLabel(packFormat: number, includeSnapshots?: boolean, preferStable?: boolean): string | null {
    const candidates: VersionInfo[] = [];
    for (const value of dataPackVersionMap.values()) {
        if (value.format === packFormat) {
            candidates.push(value);
        }
    }

    if (candidates.length === 0) {
        return null;
    }

    if (preferStable) {
        const stableCandidate = candidates.find((c) => c.releases.length > 0);
        if (stableCandidate) {
            return formatVersionRange(stableCandidate.releases);
        }
    }

    const info = candidates.find((c) => c.minor === 0) ?? candidates[0];
    return formatLabel(info, includeSnapshots);
}

export function getVersionLabelWithMinor(
    major: number,
    minor: number,
    includeSnapshots?: boolean,
    preferStable?: boolean,
): string | null {
    const info = dataPackVersionMap.get(`${major}.${minor}`);
    return info ? formatLabel(info, includeSnapshots, preferStable) : null;
}

export interface PackFormatEntry {
    format: number;
    minor: number;
    version: string;
}

export function getAllPackFormats(includeSnapshots?: boolean): PackFormatEntry[] {
    const entries: PackFormatEntry[] = [];
    for (const { format, minor, releases, snapshots } of dataPackVersionMap.values()) {
        for (const ver of releases) {
            entries.push({ format, minor, version: ver });
        }
        if (includeSnapshots) {
            for (const ver of snapshots) {
                entries.push({ format, minor, version: ver });
            }
        }
    }
    entries.sort((a, b) => b.format - a.format || b.minor - a.minor || a.version.localeCompare(b.version));
    return entries;
}

export function getResourcePackVersionLabel(rpVersion: number): string | null {
    return resourcePackVersionMap.get(`${rpVersion}.0`)?.label ?? null;
}
