import { Send } from 'lucide-react';
import { FormEvent } from 'react';
import { Department } from '../api/requests';
import { DEPARTMENTS, EXAMPLE_BY_DEPARTMENT } from '../lib/constants';

interface RequestFormProps {
  title: string;
  description: string;
  department: Department;
  busy: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDepartmentChange: (value: Department) => void;
  onSubmit: (event: FormEvent) => void;
}

export function RequestForm({
  title,
  description,
  department,
  busy,
  onTitleChange,
  onDescriptionChange,
  onDepartmentChange,
  onSubmit,
}: RequestFormProps) {
  return (
    <>
      <form className="submit-form" onSubmit={onSubmit}>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={EXAMPLE_BY_DEPARTMENT[department].title}
          required
        />

        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={EXAMPLE_BY_DEPARTMENT[department].description}
          required
        />

        <label htmlFor="department">Department</label>
        <select
          id="department"
          className={`department-select department-select-${department.toLowerCase()}`}
          value={department}
          onChange={(event) => onDepartmentChange(event.target.value as Department)}
        >
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        <button type="submit" disabled={busy}>
          <Send size={16} />
          {busy ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </>
  );
}
