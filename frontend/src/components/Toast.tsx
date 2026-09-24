import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string;
}

export function Toast({ message }: ToastProps) {
  return (
    <div className="toast" role="status">
      <span className="toast-icon">
        <CheckCircle2 size={18} />
      </span>
      {message}
    </div>
  );
}
