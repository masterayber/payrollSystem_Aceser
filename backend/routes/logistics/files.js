// Attachments of logistics documents, streamed from backend/private-uploads/
// (never served statically). Who may read a file is who may read its document:
// Admin and head-office roles, or a site role seated on the document's project.
//
// Documents are found through `router.documentReaders`: later phases register
// one reader per docType (async (docId) => doc | null, where doc has `projectId`
// and `attachments: [{ _id, name, mimeType, fileName }]`). Phase 1 registers
// none, so every lookup is "Document not found.".
const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const { requireAuthenticated } = require("../../middleware/accessMiddleware");
const {
  loadLogistics,
  assertProjectRole,
} = require("../../middleware/logisticsAccess");
const Project = require("../../models/project");

const router = express.Router();

const DOC_TYPES = [
  "MaterialRequest",
  "PurchaseOrder",
  "Delivery",
  "WithdrawalSlip",
  "Transfer",
];
const UPLOAD_ROOT = path.join(__dirname, "../../private-uploads/logistics");

router.documentReaders = {};

router.get(
  "/:docType/:docId/:attachmentId",
  [...requireAuthenticated, loadLogistics],
  async (req, res) => {
    try {
      const { docType, docId, attachmentId } = req.params;
      if (!DOC_TYPES.includes(docType)) {
        return res.status(400).json({ message: "Invalid document type." });
      }
      if (
        !mongoose.isValidObjectId(docId) ||
        !mongoose.isValidObjectId(attachmentId)
      ) {
        return res.status(400).json({ message: "Invalid document ID." });
      }

      const read = router.documentReaders[docType];
      const doc = read ? await read(docId) : null;
      if (!doc) {
        return res.status(404).json({ message: "Document not found." });
      }

      const project = await Project.findById(doc.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found." });
      }
      const refused = assertProjectRole(
        req.logistics,
        [
          "DocumentController",
          "ProjectInCharge",
          "ProcurementStaff",
          "ProcurementHead",
          "Accounting",
        ],
        project,
      );
      if (refused) {
        return res.status(refused.status).json({ message: refused.message });
      }

      const attachment = (doc.attachments || []).find(
        (entry) => String(entry._id) === String(attachmentId),
      );
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found." });
      }

      const filePath = path.join(
        UPLOAD_ROOT,
        docType,
        path.basename(String(attachment.fileName || "")),
      );
      if (!attachment.fileName || !fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found." });
      }

      const name = String(attachment.name || path.basename(filePath)).replace(
        /["\r\n]/g,
        "",
      );
      res.type(attachment.mimeType || "application/octet-stream");
      res.set("Content-Disposition", `inline; filename="${name}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },
);

module.exports = router;
