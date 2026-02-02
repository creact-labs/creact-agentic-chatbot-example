import { Tool } from './Tool';

export function DuckDuckGo() {
  return (
    <Tool
      name="web_search"
      description="Search the web using DuckDuckGo"
      parameters={{
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" }
        },
        required: ["query"]
      }}
      execute={async (args) => {
        const { query } = args as { query: string };
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
        const res = await fetch(url);
        const data = await res.json();

        const results: string[] = [];

        // Abstract (main answer)
        if (data.Abstract) {
          results.push(`${data.AbstractText}\nSource: ${data.AbstractURL}`);
        }

        // Related topics
        if (data.RelatedTopics?.length) {
          for (const topic of data.RelatedTopics.slice(0, 5)) {
            if (topic.Text && topic.FirstURL) {
              results.push(`${topic.Text}\n${topic.FirstURL}`);
            }
          }
        }

        if (!results.length) return `No results found for "${query}"`;

        return results.join('\n\n');
      }}
    />
  );
}
