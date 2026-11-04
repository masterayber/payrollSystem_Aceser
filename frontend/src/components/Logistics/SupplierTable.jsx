import { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import { IconEdit, IconPlus } from "@tabler/icons-react";
import API from "../../api";
import Dropdown from "../Dropdown/Dropdown";
import ConfirmModal from "../Modals/Confirm/ConfirmModal";
import CancelModal from "../Modals/Cancel/CancelModal";
import ConfirmedMessageModal from "../Modals/Confirmed/ConfirmedMessageModal";
import "../Modals/Modal.css";
import "./Logistics.css";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
];

const FORM_STATUSES = ["Active", "Inactive"];

const TABLE_STYLE = {
  "--logistics-columns":
    "minmax(180px, 1.6fr) minmax(90px, 0.7fr) minmax(150px, 1.2fr) minmax(120px, 1fr) minmax(170px, 1.3fr) minmax(110px, 0.9fr) minmax(100px, 0.7fr)",
  "--logistics-min-width": "1000px",
};

// With the pencil column, for people who can edit
const EDIT_TABLE_STYLE = {
  "--logistics-columns": `${TABLE_STYLE["--logistics-columns"]} 64px`,
  "--logistics-min-width": "1064px",
};

const TEXT_FIELDS = [
  { name: "contactPerson", label: "Contact person", type: "text" },
  { name: "phone", label: "Phone", type: "text" },
  { name: "email", label: "Email", type: "text" },
  { name: "address", label: "Address", type: "text" },
  { name: "tin", label: "TIN", type: "text" },
  { name: "terms", label: "Terms", type: "text" },
];

const emptyForm = {
  name: "",
  vatType: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  tin: "",
  terms: "",
  status: "Active",
};

const formFrom = (supplier) =>
  supplier
    ? {
        ...emptyForm,
        ...Object.fromEntries(
          Object.keys(emptyForm).map((key) => [key, supplier[key] || ""]),
        ),
        status: supplier.status || "Active",
      }
    : emptyForm;

// The server's required-field check, so an incomplete form shows the message
// instead of opening the confirm. "" when the form passes.
const supplierFormError = (form) => {
  if (!form.name.trim()) return "Supplier name is required.";
  return "";
};

// Create / edit form; the server validates, its message is shown as is
const SupplierFormModal = ({ supplier, onClose, onSaved }) => {
  // What the form started with, to tell whether Cancel would lose changes
  const [initialForm] = useState(() => formFrom(supplier));
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const setField = (name, value) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const hasChanges = Object.keys(emptyForm).some(
    (key) => form[key] !== initialForm[key],
  );

  const handleCancelClick = () => {
    if (hasChanges) setIsCancelOpen(true);
    else onClose();
  };

  // Save (or Enter in a field) asks first
  const handleSubmit = (event) => {
    event.preventDefault();
    const formError = supplierFormError(form);
    setErrorMessage(formError);
    if (formError) return;
    setIsConfirmOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMessage("");

    const body = {
      name: form.name.trim(),
      vatType: form.vatType,
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      tin: form.tin.trim(),
      terms: form.terms.trim(),
      status: form.status,
    };

    try {
      const { data } = supplier
        ? await API.put(`/api/logistics/suppliers/${supplier._id}`, body)
        : await API.post("/api/logistics/suppliers", body);
      const name = data?.name || body.name;
      setIsConfirmOpen(false);
      setTimeout(
        () =>
          setSuccessMessage(
            supplier
              ? `Supplier ${name} updated successfully`
              : `Supplier ${name} added successfully`,
          ),
        300,
      );
    } catch (error) {
      setIsConfirmOpen(false);
      setErrorMessage(
        error.response?.data?.message || "Could not save the supplier.",
      );
      setSaving(false);
    }
  };

  const confirmName = form.name.trim();

  return ReactDOM.createPortal(
    <div className="modal">
      <div
        className="modal-content logistics-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-form-title"
      >
        <h3 id="supplier-form-title">
          {supplier ? "Edit supplier" : "New supplier"}
        </h3>
        <form className="form-container" onSubmit={handleSubmit}>
          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label htmlFor="supplier-name">Name</label>{" "}
                <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  id="supplier-name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>VAT type</label> <span className="required">*</span>
              </div>
              <div className="logistics-radio-group">
                <label>
                  <input
                    type="radio"
                    name="vatType"
                    value="VAT"
                    checked={form.vatType === "VAT"}
                    onChange={(e) => setField("vatType", e.target.value)}
                    disabled={saving}
                  />{" "}
                  VAT
                </label>
                <label>
                  <input
                    type="radio"
                    name="vatType"
                    value="Non-VAT"
                    checked={form.vatType === "Non-VAT"}
                    onChange={(e) => setField("vatType", e.target.value)}
                    disabled={saving}
                  />{" "}
                  Non-VAT
                </label>
              </div>
            </div>
          </div>

          <div className="input-row">
            {TEXT_FIELDS.map((field) => (
              <div className="input-container" key={field.name}>
                <div className="label-container">
                  <label htmlFor={`supplier-${field.name}`}>{field.label}</label>
                </div>
                <div className="input-group-signup">
                  <input
                    id={`supplier-${field.name}`}
                    type={field.type}
                    name={field.name}
                    value={form[field.name]}
                    onChange={(e) => setField(field.name, e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            ))}

            <div className="input-container">
              <div className="label-container">
                <label>Status</label>
              </div>
              <Dropdown
                options={FORM_STATUSES}
                placeholder="Select status"
                value={form.status}
                onSelect={(value) => setField("status", value)}
              />
            </div>
          </div>

          {errorMessage && (
            <p className="feedback-message error">{errorMessage}</p>
          )}

          <div className="modal-buttons">
            <button
              type="button"
              className="btn modal-button"
              onClick={handleCancelClick}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn modal-button" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>

      {isCancelOpen && (
        <CancelModal
          title="Cancel Changes"
          message={
            supplier
              ? "Are you sure you want to cancel editing this supplier?"
              : "Are you sure you want to cancel adding this supplier?"
          }
          onClose={() => setIsCancelOpen(false)}
          onConfirm={() => {
            setIsCancelOpen(false);
            onClose();
          }}
          cancelText="No"
          confirmText="Yes, Cancel"
        />
      )}

      {isConfirmOpen && (
        <ConfirmModal
          title={supplier ? "Confirm Changes" : "Confirm New Supplier"}
          message={
            supplier
              ? `Are you sure you want to edit supplier ${confirmName}?`
              : `Are you sure you want to add supplier ${confirmName}?`
          }
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleSave}
          cancelText="No"
          confirmText={supplier ? "Yes, Edit" : "Yes, Add"}
        />
      )}

      {successMessage && (
        <ConfirmedMessageModal message={successMessage} onClose={onSaved} />
      )}
    </div>,
    document.body,
  );
};

SupplierFormModal.propTypes = {
  supplier: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string,
    vatType: PropTypes.string,
    contactPerson: PropTypes.string,
    phone: PropTypes.string,
    email: PropTypes.string,
    address: PropTypes.string,
    tin: PropTypes.string,
    terms: PropTypes.string,
    status: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

const SupplierTable = ({ canEdit }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [listError, setListError] = useState("");
  // null = closed, { supplier: null } = new, { supplier } = edit
  const [modal, setModal] = useState(null);

  const loadSuppliers = useCallback(async () => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    try {
      const { data } = await API.get("/api/logistics/suppliers", { params });
      setSuppliers(Array.isArray(data) ? data : []);
      setListError("");
    } catch (error) {
      setListError(
        error.response?.data?.message || "Could not load the suppliers.",
      );
    }
  }, [statusFilter]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const openModal = (supplier) => {
    if (!canEdit) return;
    setModal({ supplier });
  };

  // OK on the success message: close the form and refresh the list
  const handleSaved = () => {
    setModal(null);
    loadSuppliers();
  };

  return (
    <div className="logistics-panel">
      <div className="logistics-toolbar">
        <div className="logistics-filters">
          <Dropdown
            options={STATUS_FILTERS}
            placeholder="All"
            value={statusFilter}
            onSelect={setStatusFilter}
          />
        </div>

        {canEdit && (
          <div className="logistics-actions">
            <button
              type="button"
              className="btn"
              onClick={() => openModal(null)}
            >
              <IconPlus stroke={2} />
              New supplier
            </button>
          </div>
        )}
      </div>

      {listError && <p className="feedback-message error">{listError}</p>}

      <div
        className="table logistics-table"
        style={canEdit ? EDIT_TABLE_STYLE : TABLE_STYLE}
      >
        <div className="table-header">
          {[
            "Name",
            "VAT type",
            "Contact person",
            "Phone",
            "Email",
            "Terms",
            "Status",
            ...(canEdit ? [""] : []),
          ].map((heading) => (
            <article
              className="table-header-container"
              key={heading || "actions"}
            >
              <p>{heading}</p>
            </article>
          ))}
        </div>

        {suppliers.map((supplier) => (
          <div className="table-content" key={supplier._id}>
            <article className="table-content-container">
              <p>{supplier.name}</p>
            </article>
            <article className="table-content-container">
              <p>{supplier.vatType}</p>
            </article>
            <article className="table-content-container">
              <p>{supplier.contactPerson || ""}</p>
            </article>
            <article className="table-content-container">
              <p>{supplier.phone || ""}</p>
            </article>
            <article className="table-content-container">
              <p>{supplier.email || ""}</p>
            </article>
            <article className="table-content-container">
              <p>{supplier.terms || ""}</p>
            </article>
            <article className="table-content-container">
              <p>
                <span
                  className={`logistics-badge ${(supplier.status || "").toLowerCase()}`}
                >
                  {supplier.status}
                </span>
              </p>
            </article>
            {canEdit && (
              <article className="table-content-container logistics-row-actions">
                <button
                  type="button"
                  className="manage-icon-button"
                  title="Edit"
                  aria-label={`Edit supplier ${supplier.name}`}
                  onClick={() => openModal(supplier)}
                >
                  <IconEdit size={18} stroke={2} />
                </button>
              </article>
            )}
          </div>
        ))}

        {suppliers.length === 0 && (
          <p className="logistics-empty">No suppliers found.</p>
        )}
      </div>

      {modal && (
        <SupplierFormModal
          supplier={modal.supplier}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

SupplierTable.propTypes = {
  canEdit: PropTypes.bool,
};

export default SupplierTable;
