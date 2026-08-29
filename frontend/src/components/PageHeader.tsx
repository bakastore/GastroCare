import { useCallback, type ReactNode } from 'react';
import { Link, useBeforeUnload, useNavigate } from 'react-router-dom';

// Shared page header (DEMO UI). Every page renders the same structure:
//
//   [breadcrumb]
//   ← Parent            (secondary navigation — never a primary CTA)
//   Title      [status]
//   subtitle
//
// Contextual back is an explicit route (parentHref), NOT navigate(-1) — the
// user always knows where "back" goes regardless of how they arrived, and
// direct-URL loads work identically.

const UNSAVED_MESSAGE =
  'Bạn có thay đổi chưa lưu. Rời khỏi trang và bỏ các thay đổi này?';

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  parentLabel,
  parentHref,
  breadcrumb,
  title,
  subtitle,
  status,
  /**
   * When true, the contextual back link asks for confirmation before
   * leaving, and a hard browser navigation (reload / close) is guarded too.
   * For editable forms with a dirty state only — never a completed/
   * read-only view. (The app uses <BrowserRouter>, not a data router, so a
   * full route-level blocker isn't available; this is the minimal guard on
   * the primary back path.)
   */
  guardUnsavedChanges = false,
}: {
  parentLabel?: string;
  parentHref?: string;
  breadcrumb?: Crumb[];
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  guardUnsavedChanges?: boolean;
}) {
  const navigate = useNavigate();

  useBeforeUnload(
    useCallback(
      (event) => {
        if (guardUnsavedChanges) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [guardUnsavedChanges],
    ),
  );

  function handleBack(event: React.MouseEvent) {
    if (!guardUnsavedChanges || !parentHref) return;
    event.preventDefault();
    if (window.confirm(UNSAVED_MESSAGE)) {
      navigate(parentHref);
    }
  }

  return (
    <header className="page-header">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="page-breadcrumb" aria-label="Breadcrumb">
          {breadcrumb.map((crumb, i) => (
            <span key={i}>
              {i > 0 && <span className="page-breadcrumb-sep"> / </span>}
              {crumb.href ? (
                <Link to={crumb.href}>{crumb.label}</Link>
              ) : (
                <span aria-current="page">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {parentHref && parentLabel && (
        <Link className="page-back" to={parentHref} onClick={handleBack}>
          <span aria-hidden="true">←</span> {parentLabel}
        </Link>
      )}

      <div className="page-header-main">
        <h1>{title}</h1>
        {status && <span className="page-header-status">{status}</span>}
      </div>

      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </header>
  );
}
