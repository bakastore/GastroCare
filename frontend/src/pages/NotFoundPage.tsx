import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="state state-empty">
      <p>Không tìm thấy trang.</p>
      <Link to="/" className="btn btn-ghost">
        Về trang chính
      </Link>
    </div>
  );
}
