"use client";

import { useEffect, useState, useRef } from "react";
import Image from 'next/image';

interface Track {
	s3Key: string;
	prompt: string;
	audioUrl: string;
	promptIdx: number;
}

const S3_BASE = process.env.NEXT_PUBLIC_S3_BASE;
const BATCH_SIZE = 5;

// Helper to fetch prompts.json from S3
async function fetchPrompts() {
	const res = await fetch(`${S3_BASE}/prompts.json`);
	if (!res.ok) throw new Error("Failed to fetch prompts");
	return res.json();
}

// Helper to fetch rated keys from our API
async function fetchRatedKeys(): Promise<string[]> {
	const res = await fetch("/api/get-ratings");
	if (!res.ok) {
		const errorData = await res.json();
		throw new Error(errorData.error || "Failed to fetch rated keys");
	}
	const data = await res.json();
	return data.ratedKeys || [];
}

function getAudioKeyForPrompt(idx: number): string {
	// Mapping logic:
	// - For prompts 0-162: audio is 000.wav to 162.wav (zero-padded to 3 digits)
	// - For prompts 163 and 164: no audio file exists (these are skipped)
	// - For prompts 165 and above: audio is (idx-1).wav, zero-padded (Sagemaker bug: off by one)
	const pad = (n: number) => n.toString().padStart(3, '0');
	if (idx <= 162) return `musicgen-outputs/${pad(idx)}.wav`;
	if (idx === 163 || idx === 164) return ""; // No audio file exists
	return `musicgen-outputs/${pad(idx - 1)}.wav`;
}

function AudioCard({
	track,
	onSubmit,
}: {
	track: Track;
	onSubmit: (s3Key: string, rating: number) => void;
}) {
	const [rating, setRating] = useState(0);
	return (
		<div className="rounded-[56px] border border-white/30 bg-[#232323] p-6 md:p-16 w-full md:w-[700px] max-w-full flex flex-col items-center mb-16 shadow-lg gap-8">
			<div className="text-white/90 text-lg mb-6 text-center font-medium">
				<span className="font-bold">Prompt:</span> <br />
				{track.prompt}
			</div>
			<audio
				controls
				className="w-full rounded-[24px] mb-8 bg-[#232323] ring-2 ring-[#f5a077]/40 outline-none overflow-hidden"
				style={{ display: "block", minWidth: 0 }}
			>
				<source src={track.audioUrl} type="audio/wav" />
				Your browser does not support the audio element.
			</audio>
			<div className="w-full flex flex-col items-center gap-4">
				<label className="text-white/80 text-base mb-2 font-semibold">
					How similar do you think the audio is to the prompt ?
				</label>
				<input
					type="range"
					min={1}
					max={10}
					value={rating}
					onChange={(e) => setRating(Number(e.target.value))}
					className="w-full accent-orange-400 h-2 rounded-lg appearance-none bg-[#f5a077]/60 mb-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
					style={{ boxShadow: "0 0 0 1px #f5a077" }}
				/>
				<div className="flex w-full justify-between text-sm text-white/60 mb-6 font-mono">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
						<span key={n}>{n}</span>
					))}
				</div>
				<button
					className="mt-4 px-8 py-3 rounded-full bg-orange-400 text-white font-bold hover:bg-orange-500 transition disabled:opacity-50 text-lg shadow-md"
					disabled={rating === 0}
					onClick={() => onSubmit(track.s3Key, rating)}
				>
					Submit Rating
				</button>
			</div>
		</div>
	);
}

export default function Home() {
	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-[#191919] text-white font-sans">
			<div className="fixed top-6 left-6 z-50">
				<Image 
					src="/aalap_logo.svg" 
					alt="Aalap Logo" 
					className="h-12 w-auto"
					width={48}
					height={48}
				/>
			</div>
			<div className="flex flex-col items-center justify-center h-full">
				<h1 className="text-4xl font-bold mb-6">We'll be up shortly!</h1>
				<p className="text-lg text-white/80 mb-2">Aalap.ai is regenerating all samples.<br/>Please check back soon.</p>
			</div>
		</div>
	);
}
