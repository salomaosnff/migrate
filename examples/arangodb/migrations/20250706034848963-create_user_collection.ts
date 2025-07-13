// Migration file: 20250706034848963-create_user_collection.js
import { Database } from "arangojs";

export async function up(db: Database) {
  // Insert logic here to apply the migration
  await db.createCollection("users");
}

export async function down(db: Database) {
  await db.collection("users").drop();
}