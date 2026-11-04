import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import API from "../../api";

// How the banner names the seat a missing position fills
const SHORT_ROLE = { "Project In-charge": "In-charge" };

// Warns when a position or department the Logistics module relies on is missing
// from the dropdown lists, with a button that seeds them (admin only).
// GET /api/logistics/setup/health -> { ok, missingPositions, missingDepartments }
// POST /api/logistics/setup/seed-reserved -> { message, added, health }
const ReservedValuesBanner = ({ onSeeded }) => {
  const [health, setHealth] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [seeding, setSeeding] = useState(false);

  const loadHealth = useCallback(async () => {
    try {
      const { data } = await API.get("/api/logistics/setup/health");
      setHealth(data);
      setErrorMessage("");
    } catch (error) {
      setHealth(null);
      setErrorMessage(
        error.response?.data?.message ||
          "Could not check the reserved positions and departments.",
      );
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const handleSeed = async () => {
    setSeeding(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const { data } = await API.post("/api/logistics/setup/seed-reserved");
      setSuccessMessage(data.message || "Missing values added.");
      if (data.health) setHealth(data.health);
      else await loadHealth();
      if (onSeeded) onSeeded(data);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Could not add the missing values.",
      );
    } finally {
      setSeeding(false);
    }
  };

  const missingPositions = health?.missingPositions || [];
  const missingDepartments = health?.missingDepartments || [];
  const hasMissing =
    health && !health.ok && missingPositions.length + missingDepartments.length;

  if (!hasMissing && !errorMessage && !successMessage) return null;

  return (
    <div className="logistics-banner">
      {hasMissing ? (
        <div className="feedback-message warning">
          {missingPositions.map((position) => (
            <p key={`position-${position}`}>
              Position &apos;{position}&apos; is not in the Positions list;
              nobody can be picked as {SHORT_ROLE[position] || position} until
              it is added
            </p>
          ))}
          {missingDepartments.map((department) => (
            <p key={`department-${department}`}>
              Department &apos;{department}&apos; is not in the Departments list
            </p>
          ))}
          <button
            type="button"
            className="btn logistics-banner-button"
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? "Adding..." : "Add missing values"}
          </button>
        </div>
      ) : null}
      {successMessage && (
        <p className="feedback-message success">{successMessage}</p>
      )}
      {errorMessage && <p className="feedback-message error">{errorMessage}</p>}
    </div>
  );
};

ReservedValuesBanner.propTypes = {
  // Called with the seed response, so the tab can refresh its lists
  onSeeded: PropTypes.func,
};

export default ReservedValuesBanner;
