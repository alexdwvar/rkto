import { z } from 'zod';
import { langCodeSchema } from './common';

const ALLOWED_MIME_PREFIXES = ['video/', 'audio/'];

const ALLOWED_MIME_EXACT = [
  'application/x-subrip',
  'text/vtt',
  'application/octet-stream',
];

function validateMimeType(mime: string) {
  if (ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) return true;
  if (ALLOWED_MIME_EXACT.includes(mime)) return true;
  return false;
}

const mimeTypeSchema = z.string().refine(validateMimeType, { message: 'Invalid mime type. Must be video/*, audio/*, text/vtt, or application/x-subrip' });

export const presignedUploadSchema = z.object({
  anime_id: z.number().int().positive(),
  episode_id: z.number().int().positive().nullable().optional(),
  lang: langCodeSchema,
  source_name: z.string().min(1).default('rkto'),
  filename: z.string().min(1),
  mime_type: mimeTypeSchema,
  audio: z.array(langCodeSchema).optional(),
  subs: z.array(langCodeSchema).optional(),
});

export const confirmUploadSchema = z.object({
  key: z.string().min(1),
  anime_id: z.number().int().positive(),
  episode_id: z.number().int().positive().nullable().optional(),
  original_name: z.string().min(1),
  mime_type: mimeTypeSchema,
  size_bytes: z.number().int().positive().max(5_368_709_120).optional(),
  source_name: z.string().min(1).default('rkto'),
  lang: langCodeSchema,
  audio: z.array(langCodeSchema).optional(),
  subs: z.array(langCodeSchema).optional(),
});