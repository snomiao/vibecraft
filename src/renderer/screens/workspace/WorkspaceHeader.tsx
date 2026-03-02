interface WorkspaceHeaderProps {
  name: string;
  onBack: () => void;
}

export default function WorkspaceHeader({ name, onBack }: WorkspaceHeaderProps) {
  return (
    <div className="workspace-header">
      <button className="back-btn" onClick={onBack}>
        ← Back
      </button>
      <h2>{name}</h2>
    </div>
  );
}
