import PropTypes from "prop-types";

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}) => {
  const handlePrev = () => {
    onPageChange(Math.max(currentPage - 1, 1));
  };

  const handleNext = () => {
    onPageChange(Math.min(currentPage + 1, totalPages));
  };

  return (
    <div className={`pagination ${className}`}>
      <button
        className="btn pagination-button"
        onClick={handlePrev}
        disabled={currentPage === 1}
      >
        Previous
      </button>

      <span>
        Page {currentPage} of {totalPages}
      </span>

      <button
        className="btn pagination-button"
        onClick={handleNext}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;

Pagination.propTypes = {
  currentPage: PropTypes.number,
  totalPages: PropTypes.number,
  onPageChange: PropTypes.func,
  className: PropTypes.func,
};
