import { Router } from "express";
import * as controller from "./clients.controller.js";

export const clientsRoutes = Router();
clientsRoutes.get("/", controller.list);
clientsRoutes.get("/:id", controller.get);
clientsRoutes.post("/", controller.create);
clientsRoutes.patch("/:id", controller.update);
clientsRoutes.put("/:id", controller.update);
