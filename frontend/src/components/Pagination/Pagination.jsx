import PropTypes from "prop-types";

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}) => {
  // An empty list still shows one (empty) page, so Next never goes to page 0
  const lastPage = Math.max(totalPages, 1);

  const handlePrev = () => {
    onPageChange(Math.max(currentPage - 1, 1));
  };

  const handleNext = () => {
    onPageChange(Math.min(currentPage + 1, lastPage));
  };

  return (
    <div className={`pagination ${className}`}>
      <button
        type="button"
        className="btn pagination-button"
        onClick={handlePrev}
        disabled={currentPage <= 1}
      >
        Previous
      </button>

      <span>
        Page {currentPage} of {lastPage}
      </span>

      <button
        type="button"
        className="btn pagination-button"
        onClick={handleNext}
        disabled={currentPage >= lastPage}
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};
