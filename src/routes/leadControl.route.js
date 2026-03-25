import express from "express";
import { createLead, deleteLead, getAllLeads, getLeadsByType, updateLeadStatus } from "../controllers/leadControl/leadControl.controller.js";

const leadrouter = express.Router();

leadrouter.post("/create", createLead);

leadrouter.get("/", getAllLeads);

leadrouter.get("/type/:type", getLeadsByType);

leadrouter.put("/:leadId/status", updateLeadStatus);

leadrouter.delete("/:leadId", deleteLead);


export default leadrouter;