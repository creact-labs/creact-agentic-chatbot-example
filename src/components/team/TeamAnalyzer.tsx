import { useInstance, type OutputAccessors } from '@creact-labs/creact';
import { Completion } from '../completion';
import type { TeamMember } from './Project.construct';

export interface TeamAnalyzerProps {
  projectId: string;
  description: string;
  children: (team: TeamMember[]) => any;
}

const TEAM_ANALYZER_PROMPT = `You are a project analyzer. Your task is to analyze a project description and determine what team members are needed to build it.

Output a JSON array of team members. Each team member should have:
- id: A unique identifier (e.g., "member-architect", "member-dev-1")
- role: The role (e.g., "architect", "backend-developer", "frontend-developer", "qa-engineer", "devops")
- name: A friendly name for the agent (e.g., "Alex the Architect")
- systemPrompt: A detailed system prompt that defines this agent's responsibilities and expertise
- capabilities: An array of capabilities this agent has (e.g., ["system design", "API design", "code review"])

Choose team members based on the project requirements. A small project might need 2-3 members, a larger one might need 4-6.

Respond ONLY with valid JSON, no additional text.`;

export function TeamAnalyzer({ projectId, description, children }: TeamAnalyzerProps) {
  const requestId = `team-analyze-${projectId}`;
  
  const messages = [
    { role: 'system', content: TEAM_ANALYZER_PROMPT },
    { role: 'user', content: `Analyze this project and create a team:\n\n${description}` }
  ];

  return (
    <Completion requestId={requestId} model="gpt-4o-mini" messages={messages}>
      {(response) => {
        try {
          // Try to parse the JSON response
          const jsonMatch = response.match(/\[[\s\S]*\]/);
          if (!jsonMatch) {
            console.error('[TeamAnalyzer] Could not find JSON array in response');
            return null;
          }
          
          const team: TeamMember[] = JSON.parse(jsonMatch[0]);
          return children(team);
        } catch (e) {
          console.error('[TeamAnalyzer] Failed to parse team:', e);
          console.error('[TeamAnalyzer] Response was:', response);
          return null;
        }
      }}
    </Completion>
  );
}
