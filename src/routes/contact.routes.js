import express from "express";
import { 
  createContact,
  getContacts,
  getContactById,
  updateContactStatus,
  deleteContact
} from "../controllers/contact.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { isSuperAdmin } from "../middlewares/role.middleware.js";

const contactRoute = express.Router();

/* PUBLIC */
contactRoute.post("/", createContact);

/* ADMIN */
contactRoute.get("/", protect, isSuperAdmin, getContacts);
contactRoute.get("/:id", protect, isSuperAdmin, getContactById);
contactRoute.put("/:id", protect, isSuperAdmin, updateContactStatus);
contactRoute.delete("/:id", protect, isSuperAdmin, deleteContact);

export default contactRoute;
