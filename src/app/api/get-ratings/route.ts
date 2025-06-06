import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_BUCKET!;
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY!;

const RATINGS_KEY = "musicgen-outputs/ratings.json";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

// Define RatingEntry interface here
interface RatingEntry {
  s3Key: string;
  prompt: string;
  rating: number;
  timestamp: string;
}

export async function GET() {
  try {
    const data = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: RATINGS_KEY })
    );
    
    if (!data.Body) {
      // If ratings.json doesn't exist, there are no rated tracks
      return NextResponse.json({ ratedKeys: [] });
    }

    const body = await data.Body.transformToString();
    const ratings: RatingEntry[] = JSON.parse(body);
    
    // Extract unique s3Keys from the ratings
    const ratedKeys = Array.from(new Set(ratings.map(rating => rating.s3Key)));
    
    return NextResponse.json({
      ratedKeys: ratedKeys
    });
  } catch (error: unknown) {
    console.error('Error fetching rated keys:', error); // Log the error
    return NextResponse.json({ 
      error: 'Failed to fetch rated keys',
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 