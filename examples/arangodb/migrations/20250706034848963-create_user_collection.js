// Migration file: 20250706034848963-create_user_collection.js
const { Database } = require("arangojs");

module.exports = {
  /**
   * @param {Database} db - The ArangoDB database instance.
   * @returns {Promise<void>} - A promise that resolves when the migration is applied.
   */
  async up(db) {
    // Insert logic here to apply the migration
    await db.createCollection("users");
  },

  /**
   * @param {Database} db - The ArangoDB database instance.
   * @returns {Promise<void>} - A promise that resolves when the migration is rolled back.
   */
  async down(db) {
    await db.collection("users").drop();
  }
};