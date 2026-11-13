// Full-page wait while the signed-in account loads (PrivateRoute and the Set your
// password screen): a white spinning ring with "Loading..." under it, on the blue
// page. The style is .page-loading in index.css.
const PageLoading = () => (
  <div
    className="page-loading"
    role="status"
    aria-live="polite"
    aria-label="Loading"
  >
    <span className="page-loading-spinner" aria-hidden="true" />
    <span className="page-loading-text" aria-hidden="true">
      Loading...
    </span>
  </div>
);

export default PageLoading;
