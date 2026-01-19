import { Helmet } from 'react-helmet-async';
import { AgentBuilder as AgentBuilderComponent } from '@/components/agent-builder';

export default function AgentBuilderPage() {
  return (
    <>
      <Helmet>
        <title>Agent Builder | Swiss AI</title>
      </Helmet>
      <AgentBuilderComponent />
    </>
  );
}
