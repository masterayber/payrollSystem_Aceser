import { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import { IconEdit, IconPlus, IconSearch } from "@tabler/icons-react";
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
  { label: "Pending", value: "Pending" },
];

const FORM_STATUSES = ["Active", "Inactive"];

const TABLE_STYLE = {
  "--logistics-columns":
    "minmax(110px, 0.8fr) minmax(220px, 2fr) minmax(130px, 1fr) minmax(90px, 0.7fr) minmax(160px, 1.4fr) minmax(100px, 0.7fr)",
  "--logistics-min-width": "900px",
};

// With the pencil column, for people who can edit
const EDIT_TABLE_STYLE = {
  "--logistics-columns": `${TABLE_STYLE["--logistics-columns"]} 64px`,
  "--logistics-min-width": "964px",
};

const emptyForm = {
  code: "",
  description: "",
  category: "",
  unit: "",
  specs: "",
  status: "Active",
};

const formFrom = (item) =>
  item
    ? {
        code: item.code || "",
        description: item.description || "",
        category: item.category || "",
        unit: item.unit || "",
        specs: item.specs || "",
        status: item.status || "Active",
      }
    : emptyForm;

// The server's required-field checks, in its order, so an incomplete form
// shows the message instead of opening the confirm. "" when the form passes.
const itemFormError = (form) => {
  if (!form.code.trim()) return "Item code is required.";
  if (!form.description.trim()) return "Description is required.";
  if (!form.category.trim()) return "Category is required.";
  if (!form.unit.trim()) return "Unit is required.";
  return "";
};

// Create / edit form; the server validates, its message is shown as is
const ItemFormModal = ({ item, lists, onClose, onSaved }) => {
  const isPending = item?.status === "Pending";
  // What the form started with, to tell whether Cancel would lose changes
  const [initialForm] = useState(() => formFrom(item));
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
    const formError = itemFormError(form);
    setErrorMessage(formError);
    if (formError) return;
    setIsConfirmOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMessage("");

    const body = {
      code: form.code.trim(),
      description: form.description.trim(),
      category: form.category,
      unit: form.unit,
      specs: form.specs.trim(),
    };
    // A pending item keeps its status until the Procurement Queue approves it
    if (!isPending) body.status = form.status;

    try {
      const { data } = item
        ? await API.put(`/api/logistics/items/${item._id}`, body)
        : await API.post("/api/logistics/items", body);
      const code = data?.code || body.code;
      setIsConfirmOpen(false);
      setTimeout(
        () =>
          setSuccessMessage(
            item
              ? `Item ${code} updated successfully`
              : `Item ${code} added successfully`,
          ),
        300,
      );
    } catch (error) {
      setIsConfirmOpen(false);
      setErrorMessage(
        error.response?.data?.message || "Could not save the item.",
      );
      setSaving(false);
    }
  };

  const confirmCode = form.code.trim();

  return ReactDOM.createPortal(
    <div className="modal">
      <div
        className="modal-content logistics-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-form-title"
      >
        <h3 id="item-form-title">{item ? "Edit item" : "New item"}</h3>
        <form className="form-container" onSubmit={handleSubmit}>
          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label htmlFor="item-code">Code</label>{" "}
                <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  id="item-code"
                  type="text"
                  name="code"
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value.toUpperCase())}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label htmlFor="item-description">Description</label>{" "}
                <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  id="item-description"
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Category</label> <span className="required">*</span>
              </div>
              <Dropdown
                options={lists.itemCategories}
                placeholder="Select category"
                value={form.category}
                onSelect={(value) => setField("category", value)}
              />
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Unit</label> <span className="required">*</span>
              </div>
              <Dropdown
                options={lists.unitsOfMeasure}
                placeholder="Select unit"
                value={form.unit}
                onSelect={(value) => setField("unit", value)}
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label htmlFor="item-specs">Specs</label>
              </div>
              <div className="input-group-signup">
                <input
                  id="item-specs"
                  type="text"
                  name="specs"
                  value={form.specs}
                  onChange={(e) => setField("specs", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Status</label>
              </div>
              {isPending ? (
                <>
                  <span className="logistics-badge pending">Pending</span>
                  <p className="logistics-form-help">
                    A pending item is approved from the Procurement Queue.
                  </p>
                </>
              ) : (
                <Dropdown
                  options={FORM_STATUSES}
                  placeholder="Select status"
                  value={form.status}
                  onSelect={(value) => setField("status", value)}
                />
              )}
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
            item
              ? "Are you sure you want to cancel editing this item?"
              : "Are you sure you want to cancel adding this item?"
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
          title={item ? "Confirm Changes" : "Confirm New Item"}
          message={
            item
              ? `Are you sure you want to edit item ${confirmCode}?`
              : `Are you sure you want to add item ${confirmCode} (${form.description.trim()})?`
          }
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleSave}
          cancelText="No"
          confirmText={item ? "Yes, Edit" : "Yes, Add"}
        />
      )}

      {successMessage && (
        <ConfirmedMessageModal message={successMessage} onClose={onSaved} />
      )}
    </div>,
    document.body,
  );
};

ItemFormModal.propTypes = {
  item: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    code: PropTypes.string,
    description: PropTypes.string,
    category: PropTypes.string,
    unit: PropTypes.string,
    specs: PropTypes.string,
    status: PropTypes.string,
  }),
  lists: PropTypes.shape({
    itemCategories: PropTypes.arrayOf(PropTypes.string).isRequired,
    unitsOfMeasure: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

const ItemMasterTable = ({ canEdit }) => {
  const [items, setItems] = useState([]);
  const [lists, setLists] = useState({ itemCategories: [], unitsOfMeasure: [] });
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [listError, setListError] = useState("");
  const [listsError, setListsError] = useState("");
  // null = closed, { item: null } = new, { item } = edit
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    API.get("/api/logistics/setup/lists")
      .then(({ data }) => {
        if (cancelled) return;
        setLists({
          itemCategories: data?.itemCategories || [],
          unitsOfMeasure: data?.unitsOfMeasure || [],
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setListsError(
          error.response?.data?.message ||
            "Could not load the item categories and units.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadItems = useCallback(async () => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (debouncedQuery) params.q = debouncedQuery;
    if (categoryFilter) params.category = categoryFilter;
    try {
      const { data } = await API.get("/api/logistics/items", { params });
      setItems(Array.isArray(data) ? data : []);
      setListError("");
    } catch (error) {
      setListError(
        error.response?.data?.message || "Could not load the items.",
      );
    }
  }, [statusFilter, debouncedQuery, categoryFilter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const openModal = (item) => {
    if (!canEdit) return;
    setModal({ item });
  };

  // OK on the success message: close the form and refresh the list
  const handleSaved = () => {
    setModal(null);
    loadItems();
  };

  const categoryOptions = [
    { label: "All categories", value: "" },
    ...lists.itemCategories.map((category) => ({
      label: category,
      value: category,
    })),
  ];

  return (
    <div className="logistics-panel">
      <div className="logistics-toolbar">
        <div className="search-container">
          <span className="icon-container">
            <IconSearch stroke={2} className="icon" />
          </span>
          <input
            type="text"
            aria-label="Search items"
            placeholder="Search items"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="logistics-filters">
          <Dropdown
            options={STATUS_FILTERS}
            placeholder="All"
            value={statusFilter}
            onSelect={setStatusFilter}
          />
          <Dropdown
            options={categoryOptions}
            placeholder="All categories"
            value={categoryFilter}
            onSelect={setCategoryFilter}
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
              New item
            </button>
          </div>
        )}
      </div>

      {listsError && <p className="feedback-message error">{listsError}</p>}
      {listError && <p className="feedback-message error">{listError}</p>}

      <div
        className="table logistics-table"
        style={canEdit ? EDIT_TABLE_STYLE : TABLE_STYLE}
      >
        <div className="table-header">
          {[
            "Code",
            "Description",
            "Category",
            "Unit",
            "Specs",
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

        {items.map((item) => (
          <div className="table-content" key={item._id}>
            <article className="table-content-container">
              <p>{item.code}</p>
            </article>
            <article className="table-content-container">
              <p>{item.description}</p>
            </article>
            <article className="table-content-container">
              <p>{item.category}</p>
            </article>
            <article className="table-content-container">
              <p>{item.unit}</p>
            </article>
            <article className="table-content-container">
              <p>{item.specs || ""}</p>
            </article>
            <article className="table-content-container">
              <p>
                <span
                  className={`logistics-badge ${(item.status || "").toLowerCase()}`}
                >
                  {item.status}
                </span>
              </p>
            </article>
            {canEdit && (
              <article className="table-content-container logistics-row-actions">
                <button
                  type="button"
                  className="manage-icon-button"
                  title="Edit"
                  aria-label={`Edit item ${item.code}`}
                  onClick={() => openModal(item)}
                >
                  <IconEdit size={18} stroke={2} />
                </button>
              </article>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <p className="logistics-empty">No items found.</p>
        )}
      </div>

      {modal && (
        <ItemFormModal
          item={modal.item}
          lists={lists}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

ItemMasterTable.propTypes = {
  canEdit: PropTypes.bool,
};

export default ItemMasterTable;
