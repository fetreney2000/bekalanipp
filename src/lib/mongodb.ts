import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  const client = await MongoClient.connect(MONGODB_URI);
  const dbName = MONGODB_URI.split("/").pop()?.split("?")[0] || "bekalanipp";
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
