import React from "react";
import "../styles/Calendar.css";

const Calendar = () => {
  return (
    <div className="main-content">
      <div className="user-track-container">
        <div className="user-track">
          <p>Total days worked this month</p>
          <div className="total-user-track">
            <span className="user-number">12</span>
            <span className="user-text">days</span>
          </div>
        </div>
      </div>

      <div className="user-track-container">
        <div className="user-track">
          <p>Total Present</p>
          <div className="total-user-track">
            <span className="user-number">12</span>
          </div>
        </div>

        <div className="user-track">
          <p>Total Late</p>
          <div className="total-user-track">
            <span className="user-number">0</span>
          </div>
        </div>

        <div className="user-track">
          <p>Total Absent</p>
          <div className="total-user-track">
            <span className="user-number">0</span>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>February 2025</p>
          <div className="arrow-calendar">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14.0832 16.6666L9.9165 12.5L14.0832 8.33329"
                stroke="black"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9.91683 8.33337L14.0835 12.5L9.91683 16.6667"
                stroke="black"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Sunday</p>
            </article>
            <article className="table-header-container">
              <p>Monday</p>
            </article>
            <article className="table-header-container">
              <p>Tuesday</p>
            </article>
            <article className="table-header-container">
              <p>Wednesday</p>
            </article>
            <article className="table-header-container">
              <p>Thursday</p>
            </article>
            <article className="table-header-container">
              <p>Friday</p>
            </article>
            <article className="table-header-container">
              <p>Saturday</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p></p>
            </article>
            <article className="table-content-container">
              <p></p>
            </article>
            <article className="table-content-container">
              <p></p>
            </article>
            <article className="table-content-container">
              <p></p>
            </article>
            <article className="table-content-container">
              <p></p>
            </article>
            <article className="table-content-container">
              <p></p>
            </article>
            <article className="table-content-container">
              <p>1</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>2</p>
            </article>
            <article className="table-content-container">
              <p>3</p>
            </article>
            <article className="table-content-container">
              <p>4</p>
            </article>
            <article className="table-content-container">
              <p>5</p>
            </article>
            <article className="table-content-container">
              <p>6</p>
            </article>
            <article className="table-content-container">
              <p>7</p>
            </article>
            <article className="table-content-container">
              <p>8</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>9</p>
            </article>
            <article className="table-content-container">
              <p>10</p>
            </article>
            <article className="table-content-container">
              <p>11</p>
            </article>
            <article className="table-content-container">
              <p>12</p>
            </article>
            <article className="table-content-container">
              <p>13</p>
            </article>
            <article className="table-content-container">
              <p>14</p>
            </article>
            <article className="table-content-container">
              <p>15</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>16</p>
            </article>
            <article className="table-content-container">
              <p>17</p>
            </article>
            <article className="table-content-container">
              <p>18</p>
            </article>
            <article className="table-content-container">
              <p>19</p>
            </article>
            <article className="table-content-container">
              <p>20</p>
            </article>
            <article className="table-content-container">
              <p>21</p>
            </article>
            <article className="table-content-container">
              <p>22</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>23</p>
            </article>
            <article className="table-content-container">
              <p>24</p>
            </article>
            <article className="table-content-container">
              <p>25</p>
            </article>
            <article className="table-content-container">
              <p>26</p>
            </article>
            <article className="table-content-container">
              <p>27</p>
            </article>
            <article className="table-content-container">
              <p>28</p>
            </article>
            <article className="table-content-container">
              <p></p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
