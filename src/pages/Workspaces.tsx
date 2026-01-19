import { Helmet } from 'react-helmet-async';
import { WorkspaceManager } from '@/components/workspace';

export default function WorkspacesPage() {
  return (
    <>
      <Helmet>
        <title>Workspaces | Swiss AI</title>
      </Helmet>
      <WorkspaceManager />
    </>
  );
}
