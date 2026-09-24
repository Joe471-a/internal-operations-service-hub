import { ArrowLeft, Lightbulb, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { FormEvent } from 'react';
import { Department } from '../api/requests';
import { RequestForm } from './RequestForm';

interface SubmitPageProps {
  title: string;
  description: string;
  department: Department;
  busy: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDepartmentChange: (value: Department) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}

const TIPS = [
  {
    icon: Target,
    title: 'Be specific',
    body: 'A precise title and description gets routed and picked up faster than a vague one.',
  },
  {
    icon: Sparkles,
    title: 'AI-checked on submit',
    body: 'Your text is automatically compared against the department you pick, so it lands in the right queue.',
  },
  {
    icon: ShieldCheck,
    title: 'Visible to your department',
    body: "Once submitted, the request is visible to your own history and to the department you're filing it under.",
  },
];

export function SubmitPage({
  title,
  description,
  department,
  busy,
  onTitleChange,
  onDescriptionChange,
  onDepartmentChange,
  onSubmit,
  onCancel,
}: SubmitPageProps) {
  return (
    <div className="submit-page">
      <div className="submit-page-header">
        <button type="button" className="back-button" onClick={onCancel}>
          <ArrowLeft size={16} />
          Back
        </button>
        <h1>Submit a Request</h1>
        <p>File a new request for a department to pick up.</p>
      </div>

      <div className="submit-page-body">
        <section className="panel submit-page-form">
          <RequestForm
            title={title}
            description={description}
            department={department}
            busy={busy}
            onTitleChange={onTitleChange}
            onDescriptionChange={onDescriptionChange}
            onDepartmentChange={onDepartmentChange}
            onSubmit={onSubmit}
          />
        </section>

        <aside className="submit-tips">
          <h2>
            <Lightbulb size={16} />
            Before you submit
          </h2>
          {TIPS.map(({ icon: Icon, title: tipTitle, body }) => (
            <div key={tipTitle} className="submit-tip">
              <span className="submit-tip-icon">
                <Icon size={16} />
              </span>
              <div>
                <strong>{tipTitle}</strong>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
