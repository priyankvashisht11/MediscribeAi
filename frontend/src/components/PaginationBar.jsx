export function PaginationBar({ currentPage, totalPages, total, onPageChange }) {
  return (
    <div className="pagination-bar">
      <span className="pagination-info">{total} total</span>
      <div className="pagination-controls">
        <button
          className="btn btn-ghost btn-sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >← Prev</button>
        <span className="pagination-pages">
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >Next →</button>
      </div>
    </div>
  )
}
