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

export async function GET() {
  try {
    const data = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: RATINGS_KEY })
    );
    
    if (!data.Body) {
      return NextResponse.json({ error: "No ratings found" }, { status: 404 });
    }

    const body = await data.Body.transformToString();
    const ratings = JSON.parse(body);
    
    return NextResponse.json({
      success: true,
      totalRatings: ratings.length,
      ratings: ratings,
      lastUpdated: data.LastModified
    });
  } catch (err) {
    console.error('Error fetching ratings:', err);
    return NextResponse.json({ 
      error: (err as Error).message,
      details: err instanceof Error ? err.stack : undefined 
    }, { status: 500 });
  }
} 