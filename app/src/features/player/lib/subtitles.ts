/**
 * WebVTT fetching + parsing for the player's custom subtitle overlay. The core
 * extracts text subtitle streams to WebVTT on demand (`…/sub<NNNNN>.vtt`); we
 * fetch that once per selected track, parse it to cues, then render the active
 * cue ourselves so the user's style/sync settings apply (a native <track> can't
 * be styled freely). Image-based subs (PGS/VOBSUB) have no VTT and don't render.
 */
import { useEffect, useRef, useState } from 'react';

export interface Cue {
	start: number;
	end: number;
	text: string;
}

/** `HH:MM:SS.mmm` / `MM:SS.mmm` (and `,mmm`) → seconds. */
function parseTimestamp(s: string): number {
	const parts = s.trim().replace(',', '.').split(':');
	let sec = 0;
	for (const p of parts) sec = sec * 60 + parseFloat(p);
	return Number.isFinite(sec) ? sec : 0;
}

/** Strip WebVTT inline tags (`<i>`, `<c.lang>`, `<00:00:01.000>`, `&nbsp;`). */
function stripTags(line: string): string {
	return line
		.replace(/<[^>]*>/g, '')
		.replace(/&lrm;|&rlm;/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, ' ')
		.trim();
}

/** Parse a WebVTT document into time-ordered cues. Tolerant of missing hours. */
export function parseVtt(src: string): Cue[] {
	const cues: Cue[] = [];
	const text = src.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
	for (const block of text.split('\n\n')) {
		const lines = block.split('\n');
		const tcIdx = lines.findIndex((l) => l.includes('-->'));
		if (tcIdx === -1) continue;
		const tc = lines[tcIdx];
		const [rawStart, rest] = tc.split('-->');
		if (rest === undefined) continue;
		const rawEnd = rest.trim().split(/\s+/)[0]; // drop cue settings after the end ts
		const start = parseTimestamp(rawStart);
		const end = parseTimestamp(rawEnd);
		if (!(end > start)) continue;
		const body = lines
			.slice(tcIdx + 1)
			.map(stripTags)
			.filter((l) => l.length > 0)
			.join('\n');
		if (body) cues.push({ start, end, text: body });
	}
	cues.sort((a, b) => a.start - b.start);
	return cues;
}

/** The cue active at `t` seconds, or null. Linear scan (cue counts are small). */
export function cueAt(cues: Cue[], t: number): Cue | null {
	for (const c of cues) {
		if (t >= c.start && t < c.end) return c;
		if (c.start > t) break; // sorted — no later cue can match
	}
	return null;
}

/**
 * Fetch + parse the WebVTT at `url` (once per URL), then return the cue text
 * active at `position` seconds shifted by `delayMs`. Empty string = nothing to
 * show. A null/empty url clears the cues.
 */
export function useActiveCue(url: string | null | undefined, position: number, delayMs: number): string {
	const [cues, setCues] = useState<Cue[]>([]);
	const loadedUrl = useRef<string | null>(null);

	useEffect(() => {
		if (!url) {
			setCues([]);
			loadedUrl.current = null;
			return;
		}
		if (loadedUrl.current === url) return;
		loadedUrl.current = url;
		let alive = true;
		setCues([]);
		void (async () => {
			try {
				const res = await fetch(url);
				if (!res.ok) throw new Error(`vtt ${res.status}`);
				const parsed = parseVtt(await res.text());
				if (alive) setCues(parsed);
			} catch (e) {
				console.error('[subtitles] load failed', e);
				if (alive) setCues([]);
			}
		})();
		return () => {
			alive = false;
		};
	}, [url]);

	if (!cues.length) return '';
	const cue = cueAt(cues, position - delayMs / 1000);
	return cue?.text ?? '';
}
