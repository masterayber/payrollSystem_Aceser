import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import API from "../../api";
import { Card, Field, SecretField } from "../Profile/ProfileView";
import { formatPeso } from "../../utils/money";
import {
  currentManilaYear,
  flagLabels,
  formatDateKey,
} from "../../utils/thirteenthMonth";

// "13th Month Pay (<year>)" on the admin Employee Profile, for the current Manila year.
// Amounts come from the server and stay hidden until clicked. `refreshKey` changes
// when the profile reloads (basic pay, start date or last working day may have changed).
const ThirteenthMonthCard = ({ userId, refreshKey }) => {
  const year = currentManilaYear();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | missing | error
  const [errorMessage, setErrorMessage] = useState("");

  const loadThirteenthMonth = useCallback(async () => {
    try {
      const { data: result } = await API.get(
        `/api/thirteenth-month/${userId}`,
        { params: { year } },
      );
      setData(result);
      setStatus("ready");
      setErrorMessage("");
    } catch (error) {
      setData(null);
      if (error.response?.status === 404) {
        setStatus("missing");
        return;
      }
      setStatus("error");
      setErrorMessage(
        error.response?.data?.message || "Could not load the 13th month pay.",
      );
    }
  }, [userId, year]);

  useEffect(() => {
    loadThirteenthMonth();
  }, [loadThirteenthMonth, refreshKey]);

  const row = data?.row;

  let message = null;
  if (status === "loading") message = "Loading...";
  if (status === "missing") message = `Not included in the ${year} 13th month.`;
  if (status === "error") {
    message = <p className="feedback-message error">{errorMessage}</p>;
  }

  return (
    <Card
      title={`13th Month Pay (${data?.year ?? year})`}
      message={message}
    >
      {row && (
        <>
          <SecretField label="Computed" value={formatPeso(row.computed)} />
          <SecretField label="Projected" value={formatPeso(row.projected)} />
          <SecretField
            label="Total for the year"
            value={formatPeso(row.total)}
          />
          <Field label="As of" value={formatDateKey(data.asOf)} />
          {row.flags.length > 0 && (
            <Field label="Notes" value={flagLabels(row.flags).join(", ")} />
          )}
        </>
      )}
    </Card>
  );
};

ThirteenthMonthCard.propTypes = {
  userId: PropTypes.string.isRequired,
  refreshKey: PropTypes.any,
};

export default ThirteenthMonthCard;
