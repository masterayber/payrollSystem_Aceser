import React, { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import "./AttendanceChart.css";
import PropTypes from "prop-types";

ChartJS.register(ArcElement, Tooltip, Legend);

const rootStyles = getComputedStyle(document.documentElement);

const AttendanceChart = ({ attendanceData }) => {
  const { onTime = 0, late = 0, absent = 0, leave = 0 } = attendanceData || {};

  const data = useMemo(
    () => ({
      labels: ["On Time", "Late", "Absent", "Leave"],
      datasets: [
        {
          data: [onTime, late, absent, leave],
          backgroundColor: [
            rootStyles.getPropertyValue("--green-status").trim(),
            rootStyles.getPropertyValue("--yellow-status").trim(),
            rootStyles.getPropertyValue("--red-status").trim(),
            rootStyles.getPropertyValue("--gray-status").trim(),
          ],
          borderColor: ["#fff", "#fff", "#fff", "#fff"],
          borderWidth: 2,
          hoverOffset: 2,
        },
      ],
    }),
    [onTime, late, absent, leave],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,

      cutout: "70%",

      animation: {
        duration: 1000,
      },

      transitions: {
        active: {
          animation: {
            duration: 0,
          },
        },
      },

      interaction: {
        mode: "nearest",
        intersect: true,
      },

      events: ["mousemove", "mouseout", "click"],

      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enable: true,
        },
      },
    }),
    [],
  );

  return (
    <div className="attendance-chart">
      <div className="chart-container">
        <Doughnut data={data} options={options} />
        <div className="chart-center">
          <span>{onTime + late + absent + leave}</span>
        </div>
      </div>
      <ul className="legend">
        <li>
          <span className="green"></span> On-Time: {onTime}
        </li>
        <li>
          <span className="yellow"></span> Late: {late}
        </li>
        <li>
          <span className="red"></span> Absent: {absent}
        </li>
        <li>
          <span className="gray"></span> Leave: {leave}
        </li>
      </ul>
    </div>
  );
};

export default React.memo(AttendanceChart);

AttendanceChart.propTypes = {
  attendanceData: PropTypes.shape({
    onTime: PropTypes.number,
    late: PropTypes.number,
    absent: PropTypes.number,
    leave: PropTypes.number,
  }).isRequired,
};
