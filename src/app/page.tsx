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

function getAudioKeyForPrompt(idx: number): string {
	// For prompts 0-162, audio is 000.wav to 162.wav (zero-padded to 3 digits)
	const pad = (n: number) => n.toString().padStart(3, '0');
	if (idx <= 162) return `musicgen-outputs/${pad(idx)}.wav`;
	// For prompts 163 and above, audio is (idx-2).wav, zero-padded, but skip 163 and 164
	if (idx === 163 || idx === 164) return ""; // No audio file exists
	return `musicgen-outputs/${pad(idx - 2)}.wav`;
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
			<div className="w-full flex flex-col items-center gap-4">s
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
	const [allTracks, setAllTracks] = useState<Track[]>([]);
	const [visibleTracks, setVisibleTracks] = useState<Track[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [batch, setBatch] = useState(1);
	const containerRef = useRef<HTMLDivElement>(null);

	// Load all unrated tracks, but only show a batch at a time
	useEffect(() => {
		async function load() {
			setLoading(true);
			setError(null);
			try {
				const prompts: { prompt: string }[] = await fetchPrompts();
				const tracks = prompts
					.map((item, idx) => {
						const s3Key = getAudioKeyForPrompt(idx);
						if (!s3Key) return null;
						return {
							s3Key,
							prompt: item.prompt,
							audioUrl: `${S3_BASE}/${s3Key}`,
							promptIdx: idx,
						};
					})
					.filter((t): t is Track => Boolean(t)); // Specify type guard for filter
				const rated = JSON.parse(localStorage.getItem("rated-keys") || "[]");
				const unrated = tracks.filter((t: Track) => !rated.includes(t.s3Key));
				setAllTracks(unrated);
				setVisibleTracks(unrated.slice(0, BATCH_SIZE));
				console.log('Sample computed audio URLs:');
				for (let i = 0; i < Math.min(unrated.length, 5); i++) {
					if (unrated[i]) {
						console.log(`Prompt ${unrated[i].promptIdx}: ${unrated[i].audioUrl}`);
					}
				}
			} catch (e: any) {
				console.error('Failed to load prompts:', e);
				setError(e instanceof Error ? e.message : 'Failed to load prompts');
			}
			setLoading(false);
		}
		load();
	}, []);

	// Infinite scroll: load more when near bottom
	useEffect(() => {
		function onScroll() {
			if (loading || visibleTracks.length >= allTracks.length) return;
			const scrollY = window.scrollY;
			const viewport = window.innerHeight;
			const fullHeight = document.body.offsetHeight;
			if (scrollY + viewport >= fullHeight - 200) {
				setBatch((b) => {
					const nextBatch = b + 1;
					const nextTracks = allTracks.slice(0, nextBatch * BATCH_SIZE);
					if (nextTracks.length > visibleTracks.length) {
						setVisibleTracks(nextTracks);
					}
					return nextBatch;
				});
			}
		}
		window.addEventListener("scroll", onScroll);
		return () => window.removeEventListener("scroll", onScroll);
	}, [loading, visibleTracks, allTracks]);

	const handleSubmit = async (s3Key: string, rating: number, promptIdx?: number) => {
		const track = visibleTracks.find((t) => t.s3Key === s3Key);
		if (!track) return;
		try {
			await fetch("/api/submit-rating", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ s3Key, prompt: track.prompt, rating, promptIdx }),
			});
			const rated = JSON.parse(localStorage.getItem("rated-keys") || "[]");
			localStorage.setItem("rated-keys", JSON.stringify([...rated, s3Key]));
			const newAllTracks = allTracks.filter((t) => t.s3Key !== s3Key);
			setAllTracks(newAllTracks);
			setVisibleTracks(newAllTracks.slice(0, batch * BATCH_SIZE));
			setSuccess(true);
			setTimeout(() => setSuccess(false), 2000);
		} catch (e: any) {
			console.error('Rating submission failed:', e);
			setError("Failed to submit rating. Please try again.");
		}
	};

	if (loading)
		return <div className="text-white text-xl p-12">Loading...</div>;

	return (
		<div className="min-h-screen bg-[#191919] flex flex-col items-center justify-center py-12 px-2 font-sans pt-20" ref={containerRef}>
			{/* Logo in top left */}
			<div className="fixed top-6 left-6 z-50">
				<Image 
					src="/aalap_logo.svg" 
					alt="Aalap Logo" 
					className="h-12 w-auto"
					width={48}
					height={48}
				/>
			</div>
			<div className="mb-10 text-center">
				<h1 className="text-3xl font-bold text-white mb-2">
					Hello, Aalap.ai Loves Having You Here!
				</h1>
				<p className="text-lg text-white/80">
					please take a few moments to help us !!
				</p>
			</div>
			{error && <div className="text-red-400 mb-4">{error}</div>}
			{success && <div className="text-green-400 mb-4">Thank you for your rating!</div>}
			<div className="flex flex-col gap-12 w-full max-w-[800px] items-center">
				{visibleTracks.length === 0 ? (
					<div className="text-white text-2xl mt-12">
						Thank you! You have rated all available tracks.
					</div>
				) : (
					visibleTracks.map((track) => (
						<AudioCard
							key={track.s3Key}
							track={track}
							onSubmit={(s3Key, rating) => handleSubmit(s3Key, rating, track.promptIdx)}
						/>
					))
				)}
				{visibleTracks.length < allTracks.length && (
					<div className="text-white/60 text-center py-8">Loading more tracks...</div>
				)}
			</div>
		</div>
	);
}
