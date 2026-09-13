import { database } from "../../config/database.js";

export function findFee(id) {
  return database().prepare("SELECT * FROM scoped_late_fees WHERE id=?").get(id);
}
