import { Tool } from './Tool';
import { chromium } from 'playwright';

export function Browser() {
  return (
    <Tool
      name="browse_page"
      description="Visit a URL and extract its text content"
      parameters={{
        type: "object",
        properties: {
          url: { type: "string", description: "URL to visit" }
        },
        required: ["url"]
      }}
      execute={async (args) => {
        const { url } = args as { url: string };
        const browser = await chromium.launch({ headless: true });
        try {
          const page = await browser.newPage();
          await page.goto(url, { timeout: 30000 });
          const text = await page.innerText('body');
          // Truncate to avoid token limits
          return text.slice(0, 4000) || 'No content found';
        } catch (e) {
          return `Failed to load page: ${e instanceof Error ? e.message : String(e)}`;
        } finally {
          await browser.close();
        }
      }}
    />
  );
}
