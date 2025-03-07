import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconDotsVertical } from "@tabler/icons-react";
import { UserContext } from "../context/UserContext";
import "../styles/Dashboard.css";
import TimeDate from "../components/TimeDate/TimeDate";

const Dashboard = () => {
  const { userData } = useContext(UserContext);
  const navigate = useNavigate();

  const [showLeaveDropdown, setShowLeaveDropdown] = useState(false);
  const [showDailyDropdown, setShowDailyDropdown] = useState(false);

  const leaveDropdownRef = useRef(null);
  const leaveSvgRef = useRef(null);

  const dailyDropdownRef = useRef(null);
  const dailySvgRef = useRef(null);

  const toggleLeaveDropdown = (event) => {
    event.stopPropagation();
    setShowLeaveDropdown((prev) => !prev);
    setShowDailyDropdown(false);
  };

  const toggleDailyDropdown = (event) => {
    event.stopPropagation();
    setShowDailyDropdown((prev) => !prev);
    setShowLeaveDropdown(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showLeaveDropdown &&
        leaveDropdownRef.current &&
        !leaveDropdownRef.current.contains(event.target) &&
        leaveSvgRef.current &&
        !leaveSvgRef.current.contains(event.target)
      ) {
        setShowLeaveDropdown(false);
      }

      if (
        showDailyDropdown &&
        dailyDropdownRef.current &&
        !dailyDropdownRef.current.contains(event.target) &&
        dailySvgRef.current &&
        !dailySvgRef.current.contains(event.target)
      ) {
        setShowDailyDropdown(false);
      }
    };

    if (showLeaveDropdown || showDailyDropdown) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showLeaveDropdown, showDailyDropdown]);

  return (
    <div className="main-content">
      <div className="user-greetings-container">
        <div className="message-container">
          <div className="user-message">
            <span>Good Day, </span>
            <span className="user-highlight">{userData?.firstName}</span>
            <span>!</span>
          </div>
          <p>You timed in 15 minutes early today. Keep it up!</p>
        </div>

        <div className="time-details">
          <TimeDate />
          <div className="time-in-out">
            <div className="time-in-container">
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <mask id="path-1-inside-1_404_2367" fill="white">
                  <path d="M3.33327 20.5L2.68327 19.98L2.2666 20.5L2.68327 21.02L3.33327 20.5ZM18.3333 21.3333C18.5543 21.3333 18.7662 21.2455 18.9225 21.0893C19.0788 20.933 19.1666 20.721 19.1666 20.5C19.1666 20.279 19.0788 20.067 18.9225 19.9107C18.7662 19.7545 18.5543 19.6667 18.3333 19.6667V21.3333ZM9.34993 11.6467L2.68327 19.98L3.98327 21.02L10.6499 12.6867L9.34993 11.6467ZM2.68327 21.02L9.34993 29.3533L10.6499 28.3133L3.98327 19.98L2.68327 21.02ZM3.33327 21.3333H18.3333V19.6667H3.33327V21.3333Z" />
                </mask>
                <path
                  d="M3.33327 20.5L2.68327 19.98L2.2666 20.5L2.68327 21.02L3.33327 20.5ZM18.3333 21.3333C18.5543 21.3333 18.7662 21.2455 18.9225 21.0893C19.0788 20.933 19.1666 20.721 19.1666 20.5C19.1666 20.279 19.0788 20.067 18.9225 19.9107C18.7662 19.7545 18.5543 19.6667 18.3333 19.6667V21.3333ZM9.34993 11.6467L2.68327 19.98L3.98327 21.02L10.6499 12.6867L9.34993 11.6467ZM2.68327 21.02L9.34993 29.3533L10.6499 28.3133L3.98327 19.98L2.68327 21.02ZM3.33327 21.3333H18.3333V19.6667H3.33327V21.3333Z"
                  fill="currentColor"
                />
                <path
                  d="M17.3333 19.6667V21.3333H19.3333V19.6667H17.3333ZM3.33327 20.5L4.58266 22.0617L6.53483 20.5L4.58266 18.9383L3.33327 20.5ZM2.2666 20.5L0.70584 19.2494L-0.29625 20.5L0.70584 21.7506L2.2666 20.5ZM9.34993 11.6467L10.5993 10.0849L9.03759 8.83554L7.7882 10.3973L9.34993 11.6467ZM3.98327 21.02L2.73388 22.5817L4.29562 23.8311L5.54501 22.2694L3.98327 21.02ZM10.6499 12.6867L12.2117 13.9361L13.4611 12.3743L11.8993 11.1249L10.6499 12.6867ZM9.34993 29.3533L7.7882 30.6027L9.03759 32.1645L10.5993 30.9151L9.34993 29.3533ZM10.6499 28.3133L11.8993 29.8751L13.4611 28.6257L12.2117 27.0639L10.6499 28.3133ZM3.98327 19.98L5.54501 18.7306L4.29562 17.1689L2.73388 18.4183L3.98327 19.98ZM3.33327 21.3333H1.33327V23.3333H3.33327V21.3333ZM3.33327 19.6667V17.6667H1.33327V19.6667H3.33327ZM4.58266 18.9383L3.93266 18.4183L1.43388 21.5417L2.08388 22.0617L4.58266 18.9383ZM1.12251 18.7294L0.70584 19.2494L3.82736 21.7506L4.24403 21.2306L1.12251 18.7294ZM0.70584 21.7506L1.12251 22.2706L4.24403 19.7694L3.82736 19.2494L0.70584 21.7506ZM3.93266 22.5817L4.58266 22.0617L2.08388 18.9383L1.43388 19.4583L3.93266 22.5817ZM18.3333 23.3333C19.0847 23.3333 19.8054 23.0348 20.3367 22.5035L17.5083 19.675C17.7271 19.4563 18.0239 19.3333 18.3333 19.3333V23.3333ZM20.3367 22.5035C20.8681 21.9721 21.1666 21.2514 21.1666 20.5H17.1666C17.1666 20.1906 17.2895 19.8938 17.5083 19.675L20.3367 22.5035ZM21.1666 20.5C21.1666 19.7486 20.8681 19.0279 20.3367 18.4965L17.5083 21.325C17.2895 21.1062 17.1666 20.8094 17.1666 20.5H21.1666ZM20.3367 18.4965C19.8054 17.9652 19.0847 17.6667 18.3333 17.6667V21.6667C18.0239 21.6667 17.7271 21.5438 17.5083 21.325L20.3367 18.4965ZM7.7882 10.3973L1.12153 18.7306L4.24501 21.2294L10.9117 12.8961L7.7882 10.3973ZM1.43388 21.5417L2.73388 22.5817L5.23266 19.4583L3.93266 18.4183L1.43388 21.5417ZM5.54501 22.2694L12.2117 13.9361L9.0882 11.4373L2.42153 19.7706L5.54501 22.2694ZM11.8993 11.1249L10.5993 10.0849L8.10054 13.2084L9.40054 14.2484L11.8993 11.1249ZM1.12153 22.2694L7.7882 30.6027L10.9117 28.1039L4.24501 19.7706L1.12153 22.2694ZM10.5993 30.9151L11.8993 29.8751L9.40054 26.7516L8.10054 27.7916L10.5993 30.9151ZM12.2117 27.0639L5.54501 18.7306L2.42153 21.2294L9.0882 29.5627L12.2117 27.0639ZM2.73388 18.4183L1.43388 19.4583L3.93266 22.5817L5.23266 21.5417L2.73388 18.4183ZM3.33327 23.3333H18.3333V19.3333H3.33327V23.3333ZM18.3333 17.6667H3.33327V21.6667H18.3333V17.6667ZM1.33327 19.6667V21.3333H5.33327V19.6667H1.33327Z"
                  fill="#0A0A0A"
                  mask="url(#path-1-inside-1_404_2367)"
                />
                <path
                  d="M16.6665 14.0533V12.815C16.6665 10.1166 16.6665 8.76831 17.4565 7.83664C18.2465 6.90497 19.5765 6.68164 22.2365 6.23664L25.0232 5.77331C30.4282 4.87331 33.1298 4.42331 34.8982 5.91997C36.6665 7.41831 36.6665 10.1583 36.6665 15.6366V25.3616C36.6665 30.8416 36.6665 33.5816 34.8998 35.0783C33.1298 36.5783 30.4282 36.1283 25.0232 35.2266L22.2365 34.7616C19.5765 34.3183 18.2465 34.0966 17.4565 33.165C16.6665 32.2316 16.6665 30.8816 16.6665 28.1833V27.275"
                  stroke="black"
                  strokeWidth="2"
                />
              </svg>
              <div className="time-in-details">
                <div className="time-timer">8:00 AM</div>
                <p>Time IN</p>
              </div>
            </div>

            <div className="time-out-container">
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11.667 12.3867V11.52C11.667 7.94332 11.667 6.15499 12.817 5.15832C13.967 4.16165 15.7353 4.41499 19.277 4.91999L26.4137 5.93999C30.5087 6.52499 32.5553 6.81665 33.777 8.22665C34.9987 9.63665 35.0003 11.705 35.0003 15.84V25.16C35.0003 29.295 35.0003 31.3633 33.777 32.7733C32.5553 34.1833 30.5087 34.475 26.4153 35.06L19.277 36.08C15.7353 36.585 13.9653 36.8383 12.817 35.8416C11.6687 34.845 11.667 33.0567 11.667 29.48V28.9433"
                  stroke="#0A0A0A"
                  strokeWidth="2"
                />
                <path
                  d="M26.6668 20.5L27.3168 19.98L27.7335 20.5L27.3168 21.02L26.6668 20.5ZM6.66683 21.3333C6.44582 21.3333 6.23385 21.2455 6.07757 21.0893C5.92129 20.933 5.8335 20.721 5.8335 20.5C5.8335 20.279 5.92129 20.067 6.07757 19.9107C6.23385 19.7545 6.44582 19.6667 6.66683 19.6667V21.3333ZM20.6502 11.6467L27.3168 19.98L26.0168 21.02L19.3502 12.6867L20.6502 11.6467ZM27.3168 21.02L20.6502 29.3533L19.3502 28.3133L26.0168 19.98L27.3168 21.02ZM26.6668 21.3333H6.66683V19.6667H26.6668V21.3333Z"
                  fill="currentColor"
                />
              </svg>
              <div className="time-out-details">
                <div className="time-timer">5:00 PM</div>
                <p>Time OUT</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="user-track-container">
        <div className="user-track">
          <p>Attendance Summary</p>
          <div className="total-user-track">
            <span className="user-number">17</span>
            <span className="user-text">days</span>
          </div>
          <div className="data-user-track">
            <div className="user-data-container">
              <div className="user-data">
                <p>Total Hours</p>
              </div>
              <div className="user-data-number">136 hrs</div>
            </div>
            <div className="user-data-container">
              <div className="user-data">
                <p>Overtime</p>
              </div>
              <div className="user-data-number">8 hrs</div>
            </div>
          </div>
        </div>

        <div className="user-track">
          <p>Leaves Taken</p>
          <div className="total-user-track">
            <span className="user-number">3</span>
            <span className="user-text">days</span>
          </div>
          <div className="data-user-track">
            <div className="user-data-container">
              <div className="user-data">
                <p>Sick Leave</p>
              </div>
              <div className="user-data-number">2</div>
            </div>
            <div className="user-data-container">
              <div className="user-data">
                <p>Vacation Leave</p>
              </div>
              <div className="user-data-number">1</div>
            </div>
          </div>
        </div>

        <div className="user-track">
          <p>Work Performance</p>
          <div className="total-user-track">
            <span className="user-number">95%</span>
            <span className="user-text">efficiency</span>
          </div>
          <div className="data-user-track">
            <div className="user-data-container">
              <div className="user-data">
                <p>Tasks Completed</p>
              </div>
              <div className="user-data-number">42</div>
            </div>
            <div className="user-data-container">
              <div className="user-data">
                <p>Pending Tasks</p>
              </div>
              <div className="user-data-number">5</div>
            </div>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>Leave Requests</p>
          <div className="dots-button-container">
            <IconDotsVertical
              stroke={2}
              onClick={toggleLeaveDropdown}
              ref={leaveSvgRef}
              className="dots-button"
            />
            {showLeaveDropdown && (
              <div className="dropdown-details" ref={leaveDropdownRef}>
                <button
                  className="dropdown-item-details"
                  onClick={() => navigate("/filing")}
                >
                  View details
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Date</p>
            </article>
            <article className="table-header-container">
              <p>Time</p>
            </article>
            <article className="table-header-container">
              <p>Leave Duration</p>
            </article>
            <article className="table-header-container">
              <p>Leave Type</p>
            </article>
            <article className="table-header-container">
              <p>Status</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/12/25</p>
            </article>
            <article className="table-content-container">
              <p>8:38 AM</p>
            </article>
            <article className="table-content-container">
              <p>1 Day</p>
            </article>
            <article className="table-content-container">
              <p>Vacation Leave</p>
            </article>
            <article className="table-content-container">
              <p>Pending</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/12/25</p>
            </article>
            <article className="table-content-container">
              <p>8:38 AM</p>
            </article>
            <article className="table-content-container">
              <p>1 Day</p>
            </article>
            <article className="table-content-container">
              <p>Vacation Leave</p>
            </article>
            <article className="table-content-container">
              <p>Pending</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/12/25</p>
            </article>
            <article className="table-content-container">
              <p>8:38 AM</p>
            </article>
            <article className="table-content-container">
              <p>1 Day</p>
            </article>
            <article className="table-content-container">
              <p>Vacation Leave</p>
            </article>
            <article className="table-content-container">
              <p>Pending</p>
            </article>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>Daily Attendance Log</p>
          <div className="dots-button-container">
            <IconDotsVertical
              stroke={2}
              onClick={toggleDailyDropdown}
              ref={dailySvgRef}
              className="dots-button"
            />
            {showDailyDropdown && (
              <div className="dropdown-details" ref={dailyDropdownRef}>
                <button
                  className="dropdown-item-details"
                  onClick={() => navigate("/attendance")}
                >
                  View details
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Date</p>
            </article>
            <article className="table-header-container">
              <p>Time IN</p>
            </article>
            <article className="table-header-container">
              <p>Time OUT</p>
            </article>
            <article className="table-header-container">
              <p>Behavior</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/03/25</p>
            </article>
            <article className="table-content-container">
              <p>7:38 AM</p>
            </article>
            <article className="table-content-container">
              <p>5:09 PM</p>
            </article>
            <article className="table-content-container">
              <p>On-Time</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/04/25</p>
            </article>
            <article className="table-content-container">
              <p>7:40 AM</p>
            </article>
            <article className="table-content-container">
              <p>5:16 PM</p>
            </article>
            <article className="table-content-container">
              <p>On-Time</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/05/25</p>
            </article>
            <article className="table-content-container">
              <p>8:05 AM</p>
            </article>
            <article className="table-content-container">
              <p>5:19 PM</p>
            </article>
            <article className="table-content-container">
              <p>Late</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/06/25</p>
            </article>
            <article className="table-content-container">
              <p>--:-- AM</p>
            </article>
            <article className="table-content-container">
              <p>--:-- PM</p>
            </article>
            <article className="table-content-container">
              <p>Absent</p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
