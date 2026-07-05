import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PetActionEvent } from "../../../packages/protocol/src/index.js";

const PET_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function assertSafePetId(petId: string): void {
  if (!PET_ID_PATTERN.test(petId)) {
    throw new Error(`Unsafe pet_id: ${petId}`);
  }
}

export function eventDateFromTimestamp(timestamp: string): string {
  const date = timestamp.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid event timestamp: ${timestamp}`);
  }
  return date;
}

export function eventsDirForPet(dataRoot: string, petId: string): string {
  assertSafePetId(petId);
  return path.join(dataRoot, "data", "pets", petId, "events");
}

export function eventsFileForDate(
  dataRoot: string,
  petId: string,
  date: string,
): string {
  assertSafePetId(petId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid event date: ${date}`);
  }
  return path.join(eventsDirForPet(dataRoot, petId), `${date}.jsonl`);
}

export async function appendEvent(
  dataRoot: string,
  event: PetActionEvent,
): Promise<string> {
  const date = eventDateFromTimestamp(event.timestamp);
  const filePath = eventsFileForDate(dataRoot, event.pet_id, date);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(event)}\n`, { flag: "a" });

  return filePath;
}

export async function readEventsFile(filePath: string): Promise<PetActionEvent[]> {
  try {
    const content = await readFile(filePath, "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PetActionEvent);
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
}

export async function readEventsForDate(
  dataRoot: string,
  petId: string,
  date: string,
): Promise<PetActionEvent[]> {
  return readEventsFile(eventsFileForDate(dataRoot, petId, date));
}

export async function readLatestEvent(
  dataRoot: string,
  petId: string,
): Promise<PetActionEvent | null> {
  const eventsDir = eventsDirForPet(dataRoot, petId);
  let files: string[];

  try {
    files = await readdir(eventsDir);
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }

  const jsonlFiles = files
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(file))
    .sort()
    .reverse();

  for (const file of jsonlFiles) {
    const filePath = path.join(eventsDir, file);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      continue;
    }

    const events = await readEventsFile(filePath);
    const latest = events.at(-1);
    if (latest) {
      return latest;
    }
  }

  return null;
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
