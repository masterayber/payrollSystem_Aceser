import GovernmentDeductionsCard from "../../components/Deductions/GovernmentDeductionsCard";
import DeductionLogCard from "../../components/Deductions/DeductionLogCard";
import "../../styles/AdminCSS/Deductions.css";

// Admin > Deductions (`deductions` tick): the statutory tables (DED-3) and the Employee
// Deduction Log with each employee's pay items (DED-4)
const Deductions = () => (
  <div className="main-content admin-deductions-page">
    <GovernmentDeductionsCard />
    <DeductionLogCard />
  </div>
);

export default Deductions;
