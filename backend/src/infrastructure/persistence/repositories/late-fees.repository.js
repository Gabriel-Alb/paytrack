import { database } from "../connection.js";

export async function findFee(id) {
  return (await database().prepare("SELECT * FROM scoped_late_fees WHERE id=?").get(id));
}
