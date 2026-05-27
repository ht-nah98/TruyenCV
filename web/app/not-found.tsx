import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container">
      <div className="empty">
        <h2>Không tìm thấy chương</h2>
        <p>Chương này có thể chưa được tải về.</p>
        <Link className="btn primary" href="/">
          ← Về mục lục
        </Link>
      </div>
    </main>
  );
}
