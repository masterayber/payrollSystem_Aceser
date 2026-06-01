import CalendarComponent from "../../components/CalendarComponent/CalendarComponent";
import { IconDotsVertical } from "@tabler/icons-react";

const AdminCalendar = () => {
  return (
    <div className="main-content">
      <div className="data-card">
        <CalendarComponent isAdmin />
      </div>

      <div className="data-card-container">
        <div className="data-card">
          <div className="user-track-title">
            <p>Events</p>
            <IconDotsVertical stroke={2} />
          </div>

          <div className="table">
            <div className="table-header">
              <article className="table-header-container">
                <p>Date</p>
              </article>
              <hr className="header-hr"></hr>
              <article className="table-header-container">
                <p>Day</p>
              </article>
              <hr className="header-hr"></hr>
              <article className="table-header-container">
                <p>Event</p>
              </article>
            </div>
            <div className="table-content">
              <article className="table-content-container">
                <p>03/04/25</p>
              </article>
              <article className="table-content-container">
                <p>Tuesday</p>
              </article>
              <article className="table-content-container">
                <p>PT</p>
              </article>
            </div>
            <div className="table-content">
              <article className="table-content-container">
                <p>03/06/25</p>
              </article>
              <article className="table-content-container">
                <p>Thursday</p>
              </article>
              <article className="table-content-container">
                <p>PT</p>
              </article>
            </div>
            <div className="table-content">
              <article className="table-content-container">
                <p>03/11/25</p>
              </article>
              <article className="table-content-container">
                <p>Tuesday</p>
              </article>
              <article className="table-content-container">
                <p>PT</p>
              </article>
            </div>
          </div>
        </div>

        <div className="data-card">
          <div className="user-track-title">
            <p>List of Holidays</p>
            <IconDotsVertical stroke={2} />
          </div>

          <div className="table">
            <div className="table-header">
              <article className="table-header-container">
                <p>Date</p>
              </article>
              <hr className="header-hr"></hr>
              <article className="table-header-container">
                <p>Day</p>
              </article>
              <hr className="header-hr"></hr>
              <article className="table-header-container">
                <p>Name of Holiday</p>
              </article>
              <hr className="header-hr"></hr>
              <article className="table-header-container">
                <p>Type</p>
              </article>
            </div>
            <div className="table-content">
              <article className="table-content-container">
                <p>01/01/25</p>
              </article>
              <article className="table-content-container">
                <p>Wednesday</p>
              </article>
              <article className="table-content-container">
                <p>New Year&apos;s Day</p>
              </article>
              <article className="table-content-container">
                <p>Regular Holiday</p>
              </article>
            </div>
            <div className="table-content">
              <article className="table-content-container">
                <p>01/29/25</p>
              </article>
              <article className="table-content-container">
                <p>Wednesday</p>
              </article>
              <article className="table-content-container">
                <p>Chinese New Year</p>
              </article>
              <article className="table-content-container">
                <p>Special Non-Working Holiday</p>
              </article>
            </div>
            <div className="table-content">
              <article className="table-content-container">
                <p>02/25/25</p>
              </article>
              <article className="table-content-container">
                <p>Tuesday</p>
              </article>
              <article className="table-content-container">
                <p>People Power Day</p>
              </article>
              <article className="table-content-container">
                <p>Special Working Holiday</p>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCalendar;
