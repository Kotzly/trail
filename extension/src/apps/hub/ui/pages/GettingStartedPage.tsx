import type { RouteParams } from "../router.js";

export default function GettingStartedPage(_props: RouteParams) {
  return (
    <div className="hub-page">
      <h1 className="hub-page__title">Getting Started</h1>

      <div className="getting-started">
        <div className="getting-started__section">
          <h2 className="getting-started__heading">Welcome to Trail</h2>
          <p className="getting-started__text">
            Trail maps your browsing into a visual tree. Every link you click grows the tree, giving
            you a bird's-eye view of how you explore the web.
          </p>
        </div>

        <div className="getting-started__section">
          <h2 className="getting-started__heading">Quick tips</h2>
          <ul className="getting-started__list">
            <li>Open the side panel to see your trail as you browse</li>
            <li>Click any node to jump back to that page</li>
            <li>Use the spotlight (Cmd/Ctrl + K) to search across all trails</li>
            <li>Archive trails to keep things organized</li>
            <li>Export trails as JSON to share or back up</li>
          </ul>
        </div>

        <div className="getting-started__section">
          <h2 className="getting-started__heading">Need help?</h2>
          <p className="getting-started__text">
            Visit{" "}
            <a
              href="https://gettrail.net/support"
              target="_blank"
              rel="noopener noreferrer"
              className="getting-started__link"
            >
              gettrail.net/support
            </a>{" "}
            for documentation and support.
          </p>
        </div>
      </div>
    </div>
  );
}
