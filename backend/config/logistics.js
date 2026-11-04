// Logistics module constants: the only place the role labels, reserved dropdown
// values, default lists and status enums are spelled.
//
// Logistics roles are not stored on Auth or Employee. They are read from the
// employee's job description in Settings (position and department) and, for the
// two site roles, from the Project document (inChargeId, documentControllerIds).
const LOGISTICS_ROLES = {
  DocumentController: { position: "Document Controller", scope: "project" },
  ProjectInCharge: { position: "Project In-charge", scope: "project" },
  ProcurementStaff: { position: "Procurement Staff", scope: "headOffice" },
  ProcurementHead: { position: "Procurement Head", scope: "headOffice" },
  Accounting: { department: "Accounting", scope: "headOffice" },
};

// Dropdown values the module depends on; the dropdown route refuses to remove or
// rename them.
const RESERVED_POSITIONS = [
  "Document Controller",
  "Project In-charge",
  "Procurement Staff",
  "Procurement Head",
];
const RESERVED_DEPARTMENTS = ["Accounting"];

const SITE_ROLES = ["DocumentController", "ProjectInCharge"];
const HEAD_OFFICE_ROLES = ["ProcurementStaff", "ProcurementHead", "Accounting"];

// Where the seed puts the reserved positions when they are missing (departments
// created if absent). The admin may move them afterwards; matching only looks at
// the position string.
const SEED_POSITIONS = {
  Procurement: ["Procurement Staff", "Procurement Head"],
  Operations: ["Document Controller", "Project In-charge"],
};
const SEED_DEPARTMENTS = ["Accounting", "Procurement", "Operations"];

const DEFAULT_ITEM_CATEGORIES = [
  "Cement and Aggregates",
  "Steel and Rebar",
  "Lumber and Plywood",
  "Electrical",
  "Plumbing",
  "Paint and Finishes",
  "Hardware and Fasteners",
  "Tools and Equipment",
  "Safety",
  "Others",
];
const DEFAULT_UNITS_OF_MEASURE = [
  "pc",
  "set",
  "bag",
  "box",
  "roll",
  "kg",
  "ton",
  "m",
  "sqm",
  "cu.m",
  "L",
  "gal",
  "sheet",
  "length",
];

const PROJECT_STATUSES = ["Active", "OnHold", "Completed", "Closed"];
const ITEM_STATUSES = ["Pending", "Active", "Inactive"];
const SUPPLIER_STATUSES = ["Active", "Inactive"];
const VAT_TYPES = ["VAT", "Non-VAT"];

module.exports = {
  LOGISTICS_ROLES,
  RESERVED_POSITIONS,
  RESERVED_DEPARTMENTS,
  SITE_ROLES,
  HEAD_OFFICE_ROLES,
  SEED_POSITIONS,
  SEED_DEPARTMENTS,
  DEFAULT_ITEM_CATEGORIES,
  DEFAULT_UNITS_OF_MEASURE,
  PROJECT_STATUSES,
  ITEM_STATUSES,
  SUPPLIER_STATUSES,
  VAT_TYPES,
};
