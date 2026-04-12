import { BackButton } from "./back-button";

type Props = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="mb-6">
      <BackButton />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        {actions && <div className="flex gap-2 shrink-0 ml-4">{actions}</div>}
      </div>
    </div>
  );
}
