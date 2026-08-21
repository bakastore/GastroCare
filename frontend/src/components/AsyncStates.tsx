export function LoadingState({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <div className="state state-loading" role="status">
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state state-error" role="alert">
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="state state-empty">{message}</div>;
}
