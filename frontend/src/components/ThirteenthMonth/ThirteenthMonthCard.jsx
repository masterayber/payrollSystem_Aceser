import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import API from "../../api";
import {
  Card,
  Field,
  RestrictedField,
  SecretField,
} from "../Profile/ProfileView";
import { formatPeso } from "../../utils/money";
import {
  currentManilaYear,
  flagLabels,
  formatDateKey,
} from "../../utils/thirteenthMonth";
import ThirteenthMonthToggle from "./ThirteenthMonthToggle";
import useThirteenthMonthVisible, {
  CARD_VISIBLE_KEY,
} from "./useThirteenthMonthVisible";

// "13th Month Pay (<year>)" on the admin Employee Profile, for the current Manila year.
// The parent renders it only for callers with the 13th month tick. Collapsed by
// default (one choice per browser, for every profile): while hidden only the title
// and the Show button appear and nothing is fetched. Amounts come from the server
// and stay masked until clicked. `refreshKey` changes when the profile reloads
// (basic pay, start date or last working day may have changed). `payHidden`: the
// profile already shows this person's pay as Restricted, so the three amounts read
// "Restricted" without asking the server.
const ThirteenthMonthCard = ({ userId, refreshKey, payHidden = false }) => {
  const year = currentManilaYear();
  const [isVisible, toggleVisible] =
    useThirteenthMonthVisible(CARD_VISIBLE_KEY);
  const [data, setData] = useState(null);
  // loading | ready | missing | error
  const [status, setStatus] = useState("loading");
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
      // Not found, not listed this year, or not on the caller's pay list: the
      // server gives the same 404 for all of them
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
    if (!isVisible || payHidden) return;
    loadThirteenthMonth();
  }, [isVisible, payHidden, loadThirteenthMonth, refreshKey]);

  const toggleButton = (
    <ThirteenthMonthToggle isVisible={isVisible} onToggle={toggleVisible} />
  );

  const title = `13th Month Pay (${data?.year ?? year})`;

  if (!isVisible) return <Card title={title} action={toggleButton} />;

  const row = data?.row;

  // One child or none, so the card draws its field list only when there are fields
  let fields = null;
  if (payHidden) {
    fields = (
      <>
        <RestrictedField label="Computed" />
        <RestrictedField label="Projected" />
        <RestrictedField label="Total for the year" />
      </>
    );
  } else if (row) {
    fields = (
      <>
        <SecretField label="Computed" value={formatPeso(row.computed)} />
        <SecretField label="Projected" value={formatPeso(row.projected)} />
        <SecretField label="Total for the year" value={formatPeso(row.total)} />
        <Field label="As of" value={formatDateKey(data.asOf)} />
        {row.flags.length > 0 && (
          <Field label="Notes" value={flagLabels(row.flags).join(", ")} />
        )}
      </>
    );
  }

  let message = null;
  if (!payHidden) {
    if (status === "loading") message = "Loading...";
    if (status === "missing") message = `Not included in the ${year} 13th month.`;
    if (status === "error") {
      message = <p className="feedback-message error">{errorMessage}</p>;
    }
  }

  return (
    <Card title={title} message={message} action={toggleButton}>
      {fields}
    </Card>
  );
};

ThirteenthMonthCard.propTypes = {
  userId: PropTypes.string.isRequired,
  refreshKey: PropTypes.any,
  payHidden: PropTypes.bool,
};

export default ThirteenthMonthCard;
