import { Link } from 'react-router-dom';

export function NotAuthorizedPage() {
  return (
    <div className="state state-error" role="alert">
      <p>Bạn không có quyền truy cập trang này.</p>
      <Link to="/" className="btn btn-ghost">
        Về trang chính
      </Link>
    </div>
  );
}
