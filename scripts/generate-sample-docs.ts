import * as XLSX from "xlsx";
import * as path from "node:path";

const data = [
  ["INDEPENDENT STATUTORY AUDITOR'S REPORT - 10 CONSECUTIVE YEARS"],
  ["Auditor", "CA Keerthiga Sri J.M. (FCA-084920)"],
  ["Firm", "J.M. & Associates Chartered Accountants"],
  ["Client", "Apex Enterprises Pvt Ltd (finance@apexenterprises.com)"],
  ["Currency", "INR (in Lakhs)"],
  [],
  ["Year", "Income", "Profit", "Loss", "Expenses", "TaxPaid", "AuditOpinion"],
  [2015, 450.0, 45.5, 0.0, 404.5, 11.2, "Clean / Unqualified"],
  [2016, 520.0, 58.2, 0.0, 461.8, 14.5, "Clean / Unqualified"],
  [2017, 610.0, 72.4, 0.0, 537.6, 18.1, "Clean / Unqualified"],
  [2018, 695.0, 84.0, 0.0, 611.0, 21.0, "Clean / Unqualified"],
  [2019, 780.0, 95.5, 0.0, 684.5, 24.0, "Clean / Unqualified"],
  [2020, 710.0, 0.0, 32.5, 742.5, 0.0, "Adverse (Pandemic Loss)"],
  [2021, 830.0, 65.0, 0.0, 765.0, 16.25, "Clean / Unqualified"],
  [2022, 960.0, 110.8, 0.0, 849.2, 27.7, "Clean / Unqualified"],
  [2023, 1120.0, 145.2, 0.0, 974.8, 36.3, "Clean / Unqualified"],
  [2024, 1280.0, 182.0, 0.0, 1098.0, 45.5, "Clean / Unqualified"],
  [],
  ["10-Year Total", 7955.0, 858.6, 32.5, 7129.4, 214.55, "Verified by CA Keerthiga Sri J.M."],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, "10-Year Financials");

const outPath = path.join(process.cwd(), "sample_documents", "Apex_Enterprises_10Year_Audit_Report.xlsx");
XLSX.writeFile(wb, outPath);
console.log("Successfully generated Excel sample at:", outPath);
