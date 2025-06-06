import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

// These should be set in your Vercel project environment variables
const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_BUCKET!;
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY!;

const RATINGS_KEY = "musicgen-outputs/ratings.json";

const s3 = new S3Client({
  region: REGION,
  credentials:
    ACCESS_KEY_ID && SECRET_ACCESS_KEY
      ? {
          accessKeyId: ACCESS_KEY_ID,
          secretAccessKey: SECRET_ACCESS_KEY,
        }
      : undefined,
});

// Typescript: add types for ratings
interface RatingEntry {
  s3Key: string;
  prompt: string;
  rating: number;
  timestamp: string;
}

async function getRatings(): Promise<RatingEntry[]> {
  try {
    const data = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: RATINGS_KEY })
    );
    if (!data.Body) throw new Error("No ratings.json body returned from S3");
    const body = await data.Body.transformToString();
    return JSON.parse(body);
  } catch (e) {
    // If file doesn't exist, return empty array
    return [];
  }
}

async function putRatings(ratings: RatingEntry[]): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: RATINGS_KEY,
      Body: JSON.stringify(ratings, null, 2),
      ContentType: "application/json",
    })
  );
}

export async function POST(req: NextRequest) {
  try {
    const { s3Key, prompt, rating, promptIdx } = await req.json();
    if (!s3Key || !prompt || typeof rating !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    // If promptIdx is provided, store it for traceability
    const ratings = await getRatings();
    const entry: RatingEntry & { promptIdx?: number } = {
      s3Key,
      prompt,
      rating,
      timestamp: new Date().toISOString(),
    };
    if (typeof promptIdx === "number") entry.promptIdx = promptIdx;
    ratings.push(entry);
    await putRatings(ratings);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
