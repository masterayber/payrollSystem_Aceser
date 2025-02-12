import React from "react";
import "../styles/Dashboard.css";

const Dashboard = () => {
  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <div className="company-container">
          <div className="aceser-logo-container">
            <img
              src="/assets/aceser-logo.png"
              alt="Company Logo"
              className="logo"
            />
          </div>
          <p>ACESER</p>
        </div>

        <nav className="sidebar-menu">
          {[
            {
              name: "Dashboard",
              icon: "M13 9V3H21V9H13ZM3 13V3H11V13H3ZM13 21V11H21V21H13ZM3 21V15H11V21H3Z",
            },
            {
              name: "Payroll",
              icon: "M8.4 21c-1.517 0-2.796-.521-3.838-1.562C3.52 18.397 3 17.117 3 15.6c0-.634.108-1.25.325-1.85.217-.6.525-1.142.925-1.625L7.8 7.85 6.1 4.45c-.167-.333-.154-.658.038-.975C6.33 3.158 6.617 3 7 3h10c.383 0 .671.158.863.475.192.317.204.642.037.975L16.2 7.85l3.55 4.275c.4.483.708 1.025.925 1.625.217.6.325 1.216.325 1.85 0 1.517-.525 2.797-1.575 3.838C18.375 20.48 17.1 21 15.6 21H8.4zm3.6-5c-.55 0-1.021-.196-1.412-.587C10.197 15.022 10 14.551 10 14c0-.55.196-1.021.588-1.412C10.981 12.197 11.451 12.001 12 12c.549-.002 1.02.194 1.413.588.393.394.589.865.587 1.413-.002.548-.198 1.019-.587 1.413C13.024 15.807 12.553 16.003 12 16zM9.625 7h4.75L15.375 5h-6.75l1 2zM8.4 19h7.2c.95 0 1.754-.329 2.413-.987C18.672 17.355 19 16.551 19 15.6c0-.4-.071-.787-.213-1.162a3.982 3.982 0 0 0-.787-1.438L14.525 9h-5.025l-3.7 4.4a3.982 3.982 0 0 0-.787 1.438C5.071 14.813 5 15.2 5 15.6c0 .95.329 1.755.988 2.413C6.647 18.672 7.451 19 8.4 19z",
            },
            {
              name: "Pay Slips",
              icon: "M5 14H15.53C15.25 14.31 15 14.64 14.8 15H5V14ZM21 8V12.08C21.72 12.2 22.39 12.45 23 12.8V5H1V19H14.08C14.0276 18.6692 14.0009 18.3349 14 18C14 17.66 14.03 17.33 14.08 17H3V8H21ZM5 10H12V12H5V10ZM16 18L19 15V17H23V19H19V21L16 18Z",
            },
            {
              name: "Attendance",
              icon: "M21 11.637c.469.32.887.684 1.254 1.09.367.406.684.852.95 1.337.266.485.461.996.586 1.535.125.539.195 1.09.211 1.652 0 .93-.176 1.805-.527 2.625-.352.821-.836 1.536-1.453 2.145-.617.61-1.332 1.09-2.145 1.441-.812.352-1.687.532-2.625.54-.711 0-1.398-.106-2.063-.317-.664-.211-1.273-.516-1.828-.914-.555-.398-1.047-.875-1.477-1.43a7.472 7.472 0 0 1-1.003-1.84H1.5V1.5H4.5V0H6v1.5h10.5V0H18v1.5h3v10.137zM3 3v3h16.5V3H18v1.5h-1.5V3H6v1.5H4.5V3H3zm7.535 15a6.615 6.615 0 0 1-.035-.75c0-.93.176-1.805.527-2.625s.836-1.535 1.453-2.145c.617-.609 1.332-1.09 2.145-1.441.812-.352 1.687-.532 2.625-.54.781 0 1.531.129 2.25.387V7.5H3V18h7.535zM17.25 22.5c.727 0 1.406-.137 2.039-.41.633-.274 1.188-.649 1.664-1.125s.852-.852 1.125-1.485c.274-.633.414-1.316.422-2.05 0-.727-.137-1.406-.41-2.039-.274-.633-.649-1.188-1.125-1.664s-.852-.852-1.485-1.125c-.633-.274-1.316-.414-2.05-.422-.727 0-1.406.137-2.039.41-.633.274-1.188.649-1.664 1.125s-.852.852-1.125 1.485c-.274.633-.414 1.316-.422 2.05 0 .727.137 1.406.41 2.039.274.633.649 1.188 1.125 1.664s.852.852 1.485 1.125c.633.274 1.316.414 2.05.422zM18 16.5h2.25V18H16.5v-4.5H18V16.5z",
            },
            {
              name: "Calendar",
              icon: "M9 1V3H15V1H17V3H21C21.2652 3 21.5196 3.10536 21.7071 3.29289C21.8946 3.48043 22 3.73478 22 4V20C22 20.2652 21.8946 20.5196 21.7071 20.7071C21.5196 20.8946 21.2652 21 21 21H3C2.73478 21 2.48043 20.8946 2.29289 20.7071C2.10536 20.5196 2 20.2652 2 20V4C2 3.73478 2.10536 3.48043 2.29289 3.29289C2.48043 3.10536 2.73478 3 3 3H7V1H9ZM20 11H4V19H20V11ZM7 5H4V9H20V5H17V7H15V5H9V7H7V5Z",
            },
            {
              name: "Filing",
              icon: "M24 18v1.5h-7.57l2.473 2.473-1.055 1.055-4.277-4.277 4.277-4.277 1.055 1.055L16.43 18H24ZM15.14 12.926l-1.031 1.09a8.474 8.474 0 0 0-3.356-1.91A8.52 8.52 0 0 0 9 12c-.688 0-1.352.09-1.992.27a8.124 8.124 0 0 0-1.793.75 7.87 7.87 0 0 0-1.512 1.172A7.486 7.486 0 0 0 2.531 15.715a8.23 8.23 0 0 0-.762 1.793 8.14 8.14 0 0 0-.5 2.242H0c0-.914.137-1.808.41-2.684.273-.875.668-1.684 1.184-2.426a7.495 7.495 0 0 1 1.84-1.98 7.815 7.815 0 0 1 2.379-1.324 9.032 9.032 0 0 1-1.172-.972 7.86 7.86 0 0 1-1.39-1.66 6.937 6.937 0 0 1-.75-1.757 8.185 8.185 0 0 1-.27-2.015C3 5.172 3.156 4.395 3.469 3.668c.312-.727.738-1.363 1.277-1.91A7.24 7.24 0 0 1 6.656.469 7.86 7.86 0 0 1 9 0c.828 0 1.605.156 2.332.469a7.25 7.25 0 0 1 1.91 1.277c.547.547.977 1.184 1.29 1.918.312.734.468 1.516.468 2.336 0 1.07-.246 2.039-.738 2.906a6.927 6.927 0 0 1-2.074 2.18c.547.203 1.067.461 1.558.774a8.31 8.31 0 0 1 1.894 1.366ZM4.5 6c0 .625.118 1.207.352 1.746.234.539.555 1.016.961 1.43.406.414.883.738 1.43.972.547.234 1.133.352 1.757.352.617 0 1.199-.118 1.746-.352.547-.234 1.024-.555 1.43-.961.406-.406.73-.883.972-1.43.242-.547.36-1.133.352-1.758 0-.617-.117-1.199-.352-1.746a4.9 4.9 0 0 0-.973-1.43 5.04 5.04 0 0 0-1.43-.973A4.82 4.82 0 0 0 9 1.5a4.91 4.91 0 0 0-1.746.352 5.2 5.2 0 0 0-1.43.961 4.9 4.9 0 0 0-.973 1.43A4.82 4.82 0 0 0 4.5 6Z",
            },
            {
              name: "Settings",
              icon: "M22.2,14.4L21,13.7c-1.3-0.8-1.3-2.7,0-3.5l1.2-0.7c1-0.6,1.3-1.8,0.7-2.7l-1-1.7c-0.6-1-1.8-1.3-2.7-0.7   L18,5.1c-1.3,0.8-3-0.2-3-1.7V2c0-1.1-0.9-2-2-2h-2C9.9,0,9,0.9,9,2v1.3c0,1.5-1.7,2.5-3,1.7L4.8,4.4c-1-0.6-2.2-0.2-2.7,0.7   l-1,1.7C0.6,7.8,0.9,9,1.8,9.6L3,10.3C4.3,11,4.3,13,3,13.7l-1.2,0.7c-1,0.6-1.3,1.8-0.7,2.7l1,1.7c0.6,1,1.8,1.3,2.7,0.7L6,18.9   c1.3-0.8,3,0.2,3,1.7V22c0,1.1,0.9,2,2,2h2c1.1,0,2-0.9,2-2v-1.3c0-1.5,1.7-2.5,3-1.7l1.2,0.7c1,0.6,2.2,0.2,2.7-0.7l1-1.7   C23.4,16.2,23.1,15,22.2,14.4z M12,16c-2.2,0-4-1.8-4-4c0-2.2,1.8-4,4-4s4,1.8,4,4C16,14.2,14.2,16,12,16z",
            },
          ].map((item, index) => (
            <div key={index} className="sidebar-item">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d={item.icon} />
              </svg>
              <p>{item.name}</p>
            </div>
          ))}
        </nav>
      </div>
      <div className="header-content-container">
        <header className="header">
          <h3>Dashboard</h3>
          <div className="user-header">
            <p>User</p>
          </div>
        </header>
        <div className="main-content">
          <div className="user-greetings-container">
            <div className="message-container">
              <div className="user-message">
                <span>Good Day, </span>
                <span className="user-highlight">User!</span>
              </div>
              <p>You timed in 15 minutes early today. Keep it up!</p>
            </div>
            <div className="time-details">
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
          <div className="user-track-container">
            <div className="user-track">
              <p>Lorem Ipsum </p>
              <div className="total-user-track">
                <span className="user-number">17</span>
                <span className="user-text">days</span>
              </div>
              <div className="data-user-track">
                <div className="user-data-container">
                  <div className="user-data">
                    <p>Total</p>
                  </div>
                  <div className="user-data-number">##</div>
                </div>
                <div className="user-data-container">
                  <div className="user-data">
                    <p>Total</p>
                  </div>
                  <div className="user-data-number">##</div>
                </div>
              </div>
            </div>
            <div className="user-track">
              <p>Lorem Ipsum </p>
              <div className="total-user-track">
                <span className="user-number">17</span>
                <span className="user-text">days</span>
              </div>
              <div className="data-user-track">
                <div className="user-data-container">
                  <div className="user-data">
                    <p>Total</p>
                  </div>
                  <div className="user-data-number">##</div>
                </div>
                <div className="user-data-container">
                  <div className="user-data">
                    <p>Total</p>
                  </div>
                  <div className="user-data-number">##</div>
                </div>
              </div>
            </div>
            <div className="user-track">
              <p>Lorem Ipsum </p>
              <div className="total-user-track">
                <span className="user-number">17</span>
                <span className="user-text">days</span>
              </div>
              <div className="data-user-track">
                <div className="user-data-container">
                  <div className="user-data">
                    <p>Total</p>
                  </div>
                  <div className="user-data-number">##</div>
                </div>
                <div className="user-data-container">
                  <div className="user-data">
                    <p>Total</p>
                  </div>
                  <div className="user-data-number">##</div>
                </div>
              </div>
            </div>
          </div>
          <div className="leave-table-container">
            <div className="leave-header">
              <p>Leave Requests</p>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10.7998 18.3C10.7998 17.9022 10.9578 17.5206 11.2391 17.2393C11.5204 16.958 11.902 16.8 12.2998 16.8C12.6976 16.8 13.0792 16.958 13.3605 17.2393C13.6418 17.5206 13.7998 17.9022 13.7998 18.3C13.7998 18.6978 13.6418 19.0794 13.3605 19.3607C13.0792 19.642 12.6976 19.8 12.2998 19.8C11.902 19.8 11.5204 19.642 11.2391 19.3607C10.9578 19.0794 10.7998 18.6978 10.7998 18.3ZM10.7998 12.3C10.7998 11.9022 10.9578 11.5206 11.2391 11.2393C11.5204 10.958 11.902 10.8 12.2998 10.8C12.6976 10.8 13.0792 10.958 13.3605 11.2393C13.6418 11.5206 13.7998 11.9022 13.7998 12.3C13.7998 12.6978 13.6418 13.0794 13.3605 13.3607C13.0792 13.642 12.6976 13.8 12.2998 13.8C11.902 13.8 11.5204 13.642 11.2391 13.3607C10.9578 13.0794 10.7998 12.6978 10.7998 12.3ZM10.7998 6.3C10.7998 5.90218 10.9578 5.52065 11.2391 5.23934C11.5204 4.95804 11.902 4.8 12.2998 4.8C12.6976 4.8 13.0792 4.95804 13.3605 5.23934C13.6418 5.52065 13.7998 5.90218 13.7998 6.3C13.7998 6.69783 13.6418 7.07936 13.3605 7.36066C13.0792 7.64197 12.6976 7.8 12.2998 7.8C11.902 7.8 11.5204 7.64197 11.2391 7.36066C10.9578 7.07936 10.7998 6.69783 10.7998 6.3Z"
                  fill="#0A0A0A"
                />
              </svg>
            </div>
            <div className="leave-request-table">
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
          <div className="leave-table-container">
            <div className="leave-header">
              <p>Daily Attendance Log</p>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10.7998 18.3C10.7998 17.9022 10.9578 17.5206 11.2391 17.2393C11.5204 16.958 11.902 16.8 12.2998 16.8C12.6976 16.8 13.0792 16.958 13.3605 17.2393C13.6418 17.5206 13.7998 17.9022 13.7998 18.3C13.7998 18.6978 13.6418 19.0794 13.3605 19.3607C13.0792 19.642 12.6976 19.8 12.2998 19.8C11.902 19.8 11.5204 19.642 11.2391 19.3607C10.9578 19.0794 10.7998 18.6978 10.7998 18.3ZM10.7998 12.3C10.7998 11.9022 10.9578 11.5206 11.2391 11.2393C11.5204 10.958 11.902 10.8 12.2998 10.8C12.6976 10.8 13.0792 10.958 13.3605 11.2393C13.6418 11.5206 13.7998 11.9022 13.7998 12.3C13.7998 12.6978 13.6418 13.0794 13.3605 13.3607C13.0792 13.642 12.6976 13.8 12.2998 13.8C11.902 13.8 11.5204 13.642 11.2391 13.3607C10.9578 13.0794 10.7998 12.6978 10.7998 12.3ZM10.7998 6.3C10.7998 5.90218 10.9578 5.52065 11.2391 5.23934C11.5204 4.95804 11.902 4.8 12.2998 4.8C12.6976 4.8 13.0792 4.95804 13.3605 5.23934C13.6418 5.52065 13.7998 5.90218 13.7998 6.3C13.7998 6.69783 13.6418 7.07936 13.3605 7.36066C13.0792 7.64197 12.6976 7.8 12.2998 7.8C11.902 7.8 11.5204 7.64197 11.2391 7.36066C10.9578 7.07936 10.7998 6.69783 10.7998 6.3Z"
                  fill="#0A0A0A"
                />
              </svg>
            </div>
            <div className="leave-request-table">
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
      </div>
    </div>
  );
};

export default Dashboard;
