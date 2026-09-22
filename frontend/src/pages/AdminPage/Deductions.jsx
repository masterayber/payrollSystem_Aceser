import { useState, useContext, useEffect, useRef } from "react";
import { IconSearch, IconDotsVertical } from "@tabler/icons-react";
import { EmployeeContext } from "../../context/EmployeeContext";
import AddModal from "../../components/Modals/DropdownOption/AddOption/AddOption";
// import ConfirmModal from "../../components/Modals/Confirm/ConfirmModal";
// import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";

const Deductions = () => {
  const { employeeData } = useContext(EmployeeContext);
  const [deductionsData, setDeductionsData] = useState({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showDeductionDropdown, setShowDeductionDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const deductionDropdownRef = useRef(null);
  const deductionSvgRef = useRef(null);

  const toggleDeductionDropdown = (event) => {
    event.stopPropagation();
    setShowDeductionDropdown((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showDeductionDropdown &&
        deductionDropdownRef.current &&
        !deductionDropdownRef.current.contains(event.target) &&
        deductionSvgRef.current &&
        !deductionSvgRef.current.contains(event.target)
      ) {
        setShowDeductionDropdown(false);
      }
    };

    if (showDeductionDropdown) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  });

  // useEffect(() => {
  //   async function fetchDeductions() {
  //     try {
  //       const res = await fetch("http://localhost:5000/api/deductions");
  //       const data = await res.json();
  //       setDeductionsData(data.governmentDeductions || {});
  //     } catch (error) {
  //       console.error("Error:", error);
  //       setDeductionsData({});
  //     }
  //   }
  //   fetchDeductions();
  // }, []);

  const filteredEmployees = employeeData.filter((employee) =>
    Object.values(employee).some((value) =>
      value.toString().toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentEmployees = filteredEmployees.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <div className="main-content">
      <div className="table-container">
        <div className="table-title">
          <p>Government-Mandated Deductions</p>
          <div className="dots-button-container">
            <IconDotsVertical
              stroke={2}
              onClick={toggleDeductionDropdown}
              ref={deductionSvgRef}
              className="dots-button"
            />
            {showDeductionDropdown && (
              <div className="dropdown-details" ref={deductionDropdownRef}>
                <button
                  className="dropdown-item-details"
                  // onClick={() => handleAddClick()}
                >
                  Add Option
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Type</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Amount</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Manage</p>
            </article>
          </div>
          {Object.entries(deductionsData).map(([type, amount]) => (
            <div className="table-content" key={type}>
              <article className="table-content-container">
                <p>{type}</p>
              </article>
              <article className="table-content-container">
                <p>{amount}</p>
              </article>
              <article className="table-content-container">
                <button className="action-button">Edit</button>
                <button className="action-button">Delete</button>
              </article>
            </div>
          ))}
          {Object.keys(deductionsData).length === 0 && (
            <p className="no-data">No Deductions.</p>
          )}
        </div>
      </div>

      <div className="search-container">
        <span className="icon-container">
          <IconSearch stroke={2} className="icon" />
        </span>

        <input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>Employee Deduction Log</p>
          <IconDotsVertical stroke={2} />
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Employee ID</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Employee Last Name</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Employee First Name</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Withholding Tax</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Deductions</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Loans</p>
            </article>
          </div>
          {currentEmployees.map((employee, index) => (
            <div className="table-content" key={index}>
              <article className="table-content-container">
                <p>{employee.id}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.lastName}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.firstName}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.withholdingTax}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.deductions}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.loans}</p>
              </article>
            </div>
          ))}
        </div>

        {filteredEmployees.length === 0 && (
          <p className="no-results">No employees found.</p>
        )}
      </div>

      <div className="pagination">
        <button
          className="pagination-button"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span>
          {" "}
          Page {currentPage} of {totalPages}{" "}
        </span>
        <button
          className="pagination-button"
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>

      {isAddModalOpen && (
        <AddModal
          title={`Add Deduction`}
          message={`Add a new Deduction`}
          onClose={() => setIsAddModalOpen(false)}
          // onAddOption={handleConfirmAdd}
          confirmText="Next"
        />
      )}
    </div>
  );
};

export default Deductions;
