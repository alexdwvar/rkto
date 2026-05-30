import { eq } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { media } from '../db/schema';
import { createPresignedDownloadUrl, createPresignedUploadUrl, deleteFromR2, shouldTranscode } from './media';

type ProgressCallback = (progress: number, step: string) => void;

async function isTranscodeActive(db: Database, mediaId: number): Promise<boolean> {
  const item = await db.select({ status: media.status }).from(media).where(eq(media.id, mediaId)).get();
  return item?.status === 'processing';
}

async function getVideoDuration(inputPath: string): Promise<number> {
  const proc = Bun.spawn(['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', inputPath], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const text = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) throw new Error(`ffprobe exited with code ${exitCode}`);
  const info = JSON.parse(text);
  return parseFloat(info?.format?.duration) || 0;
}

async function extractSubtitles(
  inputPath: string,
  outputDir: string,
  originalName: string
): Promise<{ key: string; lang: string }[]> {
  const probeProc = Bun.spawn(['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', inputPath], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const probeText = await new Response(probeProc.stdout).text();
  const probeExitCode = await probeProc.exited;
  if (probeExitCode !== 0) return [];

  let probe: { streams?: { index: number; codec_type: string; codec_name: string; tags?: { language?: string } }[] };
  try {
    probe = JSON.parse(probeText);
  } catch {
    return [];
  }
  const streams = probe.streams || [];
  const subStreams = streams.filter((s) => s.codec_type === 'subtitle' && ['subrip', 'ass', 'ssa'].includes(s.codec_name));

  const uploadedSubs: { key: string; lang: string }[] = [];

  for (const stream of subStreams) {
    const lang = stream.tags?.language || 'und';
    const localFile = `${outputDir}/sub_${stream.index}.vtt`;

    const convProc = Bun.spawn([
      'ffmpeg', '-i', inputPath, '-map', `0:${stream.index}`,
      '-f', 'webvtt', '-y', localFile,
    ], { stdout: 'ignore', stderr: 'pipe' });
    await convProc.exited;

    if (convProc.exitCode !== 0) continue;

    const file = Bun.file(localFile);
    if (!(await file.exists())) continue;

    const { url, key } = await createPresignedUploadUrl({
      animeId: 0,
      episodeId: null,
      lang,
      sourceName: 'rkto',
      filename: `sub_${stream.index}.vtt`,
      mimeType: 'text/vtt',
    });

    const uploadResp = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': 'text/vtt' } });
    if (!uploadResp.ok) continue;

    uploadedSubs.push({ key, lang });
  }

  return uploadedSubs;
}

async function transcodeVideo(
  inputPath: string,
  outputPath: string,
  duration: number,
  onProgress: ProgressCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = Bun.spawn([
      'ffmpeg',
      '-i', inputPath,
      '-map', '0:v:0',
      '-map', '0:a:0',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ], { stdout: 'ignore', stderr: 'pipe' });

    let buffer = '';
    const decoder = new TextDecoder();
    const reader = proc.stderr.getReader();

    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > 100_000) buffer = buffer.slice(-50_000);

        const lines = buffer.split('\r');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (timeMatch && duration > 0) {
            const elapsed = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
            const pct = Math.min(90, Math.round((elapsed / duration) * 90));
            onProgress(pct, 'transcoding');
          }
        }
      }
    })();

    proc.exited.then((exitCode) => {
      if (exitCode === 0) {
        onProgress(95, 'transcoding');
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${exitCode}`));
      }
    }).catch(reject);
  });
}

async function cleanupTmpDir(tmpDir: string) {
  const proc = Bun.spawn(['rm', '-rf', tmpDir]);
  await proc.exited;
}

export async function startTranscode(
  db: Database,
  mediaId: number,
  onProgress?: ProgressCallback,
): Promise<void> {
  const isActive = await isTranscodeActive(db, mediaId);
  if (isActive) return;

  const item = await db.select().from(media).where(eq(media.id, mediaId)).get();
  if (!item) {
    return;
  }

  if (item.status === 'ready') {
    if (onProgress) onProgress(100, 'done');
    return;
  }

  if (!shouldTranscode(item.mimeType, item.originalName || '')) {
    await db.update(media).set({ status: 'ready', progress: 100, progressStep: 'done' }).where(eq(media.id, mediaId)).run();
    if (onProgress) onProgress(100, 'done');
    return;
  }

  const progress = (pct: number, step: string) => {
    db.update(media).set({ progress: pct, progressStep: step }).where(eq(media.id, mediaId)).run();
    if (onProgress) onProgress(pct, step);
  };

  const tmpDir = `/tmp/transcode_${mediaId}`;

  try {
    const casResult = await db.update(media)
      .set({ status: 'processing', progressStep: 'downloading', progress: 0 })
      .where(eq(media.id, mediaId))
      .returning()
      .get();

    if (!casResult || casResult.status !== 'processing') {
      activeTranscodes.delete(mediaId);
      return;
    }

    progress(0, 'downloading');
    const downloadUrl = await createPresignedDownloadUrl(item.key, 7200);

    const mkdirProc = Bun.spawn(['mkdir', '-p', tmpDir]);
    await mkdirProc.exited;

    const inputExt = item.originalName?.split('.').pop() || 'mkv';
    const inputPath = `${tmpDir}/input.${inputExt}`;
    const outputPath = `${tmpDir}/output.mp4`;

    const downloadResp = await fetch(downloadUrl);
    if (!downloadResp.ok) throw new Error(`Failed to download from R2: ${downloadResp.status}`);

    const totalSize = parseInt(downloadResp.headers.get('content-length') || '0');
    const reader = downloadResp.body?.getReader();
    const file = Bun.file(inputPath);
    const writer = file.writer();
    if (reader && totalSize > 0) {
      let downloaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writer.write(value);
        downloaded += value.length;
        const pct = Math.min(5, Math.round((downloaded / totalSize) * 5));
        progress(pct, 'downloading');
      }
    } else if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writer.write(value);
      }
    } else {
      await Bun.write(inputPath, downloadResp);
    }
    writer.end();

    progress(5, 'probing');
    const duration = await getVideoDuration(inputPath);

    progress(5, 'extracting_subtitles');
    const subtitles = await extractSubtitles(inputPath, tmpDir, item.originalName || 'video');

    progress(10, 'transcoding');
    await transcodeVideo(inputPath, outputPath, duration, progress);

    progress(95, 'uploading');
    const uploadResult = await createPresignedUploadUrl({
      animeId: item.animeId,
      episodeId: item.episodeId,
      lang: item.lang ?? 'ja',
      sourceName: item.sourceName ?? 'rkto',
      filename: (item.originalName || 'video').replace(/\.[^.]+$/, '.mp4'),
      mimeType: 'video/mp4',
      audio: item.audio ? JSON.parse(item.audio) : undefined,
      subs: undefined,
    });

    const mp4File = Bun.file(outputPath);
    const uploadResp = await fetch(uploadResult.url, {
      method: 'PUT',
      body: mp4File,
      headers: { 'Content-Type': 'video/mp4' },
    });
    if (!uploadResp.ok) throw new Error(`Failed to upload MP4 to R2: ${uploadResp.status}`);

    const extractedSubLangs = subtitles.map((s) => s.lang);
    const existingSubs: string[] = item.subs ? JSON.parse(item.subs) : [];
    const mergedSubs = [...new Set([...existingSubs, ...extractedSubLangs])];
    const subtitleKeys = subtitles.map((s) => ({ lang: s.lang, key: s.key }));

    await db.update(media).set({
      status: 'ready',
      progress: 100,
      progressStep: 'done',
      transcodedKey: uploadResult.key,
      mimeType: 'video/mp4',
      subs: JSON.stringify(mergedSubs),
      subtitleKeys: JSON.stringify(subtitleKeys),
    }).where(eq(media.id, mediaId)).run();

    try {
      await deleteFromR2(item.key);
    } catch {
      // best effort
    }
  } catch (err) {
    await db.update(media).set({ status: 'error', progressStep: 'failed', progress: 0 }).where(eq(media.id, mediaId)).run();
    throw err;
  } finally {
    await cleanupTmpDir(tmpDir);
  }
}