# Sync My Leet

**Automatically sync your accepted LeetCode solutions to GitHub.**

Sync My Leet is an open-source Chrome extension that captures accepted LeetCode submissions and synchronizes them with a GitHub repository.

It organizes solutions by difficulty, problem number, and programming language, maintains repository-wide metadata, and automatically generates a README with solution statistics.

The project was built to solve a simple problem: keeping LeetCode progress organized and backed up without manually maintaining a GitHub repository.

## Features

- **Automatic synchronization** – Automatically upload accepted LeetCode submissions.
- **Manual synchronization** – Choose when to upload individual submissions.
- **Flexible synchronization modes** – Automatic, Manual, or Both.
- **Organized solutions** – Store solutions by difficulty, problem number, and programming language.
- **Automatic README generation** – Maintain solution statistics and a linked solution index.
- **Submission history** – Search and filter captured submissions by problem, difficulty, and language.
- **Retry failed synchronizations** – Retry submissions that could not be uploaded.
- **Duplicate prevention** – Avoid unnecessary processing and repeated synchronization.
- **Persistent solution metadata** – Keep repository statistics independent of local browser storage.

## Screenshots

### Main Popup

![Sync My Leet main popup](docs/screenshots/main-popup.png)

### GitHub Settings

![Sync My Leet GitHub settings](docs/screenshots/github-settings.png)

## Tech Stack

| Technology                   | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| TypeScript                   | Application logic and type safety          |
| React 19                     | Popup user interface                       |
| WXT                          | Browser extension development framework    |
| Vite                         | Build tooling through WXT                  |
| Chrome Extension Manifest V3 | Browser extension platform                 |
| GitHub REST API              | Repository access and file synchronization |
| LeetCode GraphQL API         | Retrieving submission details              |
| Zod 4                        | Runtime data validation                    |
| Vitest                       | Unit testing                               |

## Architecture

The extension separates LeetCode integration, GitHub operations, synchronization logic, and user interface responsibilities.

```text
                         LeetCode
                            |
                            v
                     Content Script
                            |
                    Submission Detection
                            |
                     GraphQL Request
                            |
                     Data Validation
                            |
                            v
                   Background Worker
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
        Sync Service   Storage Layer   GitHub Service
             |              |              |
             v              |              v
       Solution File        |         GitHub REST API
             |              |
             v              |
     Manifest Service       |
             |              |
             v              |
      README Generator      |
             |              |
             +--------------+
                    |
                    v
               GitHub Repo
```

### Main Components

**Content Script**

- Monitors LeetCode submission pages.
- Detects accepted submissions.
- Retrieves submission details through LeetCode's GraphQL endpoint.
- Sends submission data to the background worker.

**Background Service Worker**

- Receives and validates extension messages.
- Handles GitHub authentication and repository operations.
- Coordinates automatic and manual synchronization.
- Keeps GitHub credentials out of the content script.

**GitHub Service**

- Validates personal access tokens.
- Checks repository access.
- Retrieves repository files and directory trees.
- Creates and updates files through the GitHub Contents API.

**Sync Service**

- Applies the selected synchronization mode.
- Prevents duplicate processing.
- Coordinates synchronization operations through a queue.
- Tracks synchronization status and failures.

**Solution Manifest Service**

- Maintains `leetcode-sync/manifest.json`.
- Discovers existing solution files.
- Preserves metadata for existing solutions.
- Removes entries for files that no longer exist.
- Avoids unnecessary manifest commits.

**README Generator**

- Generates repository statistics from the solution manifest.
- Calculates difficulty and language distributions.
- Creates links to individual solutions.
- Updates the README only when generated content changes.

## How It Works

### 1. Detect an Accepted Submission

When a user visits a LeetCode submission page, the content script detects the submission ID and retrieves its details.

The received data is validated before being passed to the background service worker.

Only accepted submissions are processed.

### 2. Synchronize with GitHub

The background worker retrieves the user's GitHub settings and checks the selected synchronization mode.

Solutions are uploaded using a consistent directory structure:

```text
Easy/
└── 0001-two-sum/
    └── solution.ts

Medium/
└── 0002-add-two-numbers/
    └── solution.py

Hard/
└── 0003-longest-substring/
    └── solution.java
```

Existing files are updated using their current GitHub SHA. New files are created when no matching file exists.

### 3. Maintain a Solution Manifest

The extension maintains a persistent manifest:

```text
leetcode-sync/
└── manifest.json
```

It stores metadata for repository solutions:

- Problem ID
- Problem title
- Difficulty
- Programming language
- File path
- Submission date, when available

The manifest provides a persistent metadata index independent of Chrome local storage.

### 4. Generate the README

The README is generated from the repository manifest rather than local submission history.

It includes:

- Total number of solutions
- Number of programming languages
- Last known submission date
- Difficulty distribution
- Language distribution
- Links to individual solutions

This ensures that repository statistics survive extension removal and reinstallation.

## Getting Started

### Requirements

- Node.js
- npm
- Google Chrome
- GitHub account
- GitHub Personal Access Token

### Clone the Repository

```bash
git clone https://github.com/Mustafa-Filiz/SyncMyLeet.git
cd SyncMyLeet
```

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

For Chrome:

```bash
npm run dev
```

For Firefox:

```bash
npm run dev:firefox
```

### Build

For Chrome:

```bash
npm run build
```

For Firefox:

```bash
npm run build:firefox
```

### Create Distribution Packages

For Chrome:

```bash
npm run zip
```

For Firefox:

```bash
npm run zip:firefox
```

### Load the Extension into Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated Chrome extension directory, usually `.output/chrome-mv3`.

## Configuration

### GitHub Personal Access Token

Sync My Leet uses a GitHub Fine-grained Personal Access Token to access the selected repository.

Create a token with access to the repository you want to use.

Required permissions:

| Permission | Access         |
| ---------- | -------------- |
| Contents   | Read and write |
| Metadata   | Read-only      |

These permissions allow the extension to inspect repository files and create or update solution files.

### Extension Settings

Open the extension popup and configure:

- **GitHub Personal Access Token**
- **Owner** – GitHub username or organization.
- **Repository** – Target repository name.
- **Synchronization Mode** – Automatic, Manual, or Both.

Select **Save & Validate** to verify your token and repository access.

## Synchronization Modes

| Mode      | Behavior                                             |
| --------- | ---------------------------------------------------- |
| Automatic | Accepted submissions are synchronized automatically. |
| Manual    | Submissions are synchronized only when requested.    |
| Both      | Supports automatic and manual synchronization.       |

## Development Journey

Sync My Leet was developed incrementally, with a focus on security, reliability, maintainability, and data consistency.

Development was organized into six milestones.

### Milestone 1 – GitHub Integration

The first milestone established communication with the GitHub REST API.

Implemented:

- Personal Access Token validation.
- Repository access validation.
- File creation and updates.
- Chrome local storage for settings.

**Challenge: Updating existing GitHub files**

The GitHub Contents API requires the current file SHA when updating an existing file.

The GitHub service was designed to retrieve the existing file first, obtain its SHA, and include it in the update request. If the file does not exist, the service creates it instead.

### Milestone 2 – LeetCode Integration

The second milestone focused on detecting accepted submissions.

Implemented:

- Submission page monitoring.
- LeetCode GraphQL requests.
- Submission data validation.
- Background message communication.
- Latest submission storage.

**Challenge: Retrieving submission details**

LeetCode does not provide a stable public API for all the submission details required by this extension.

The project uses LeetCode's internal GraphQL endpoint. To keep this dependency isolated, GraphQL communication is handled by a dedicated service.

Because this is not a stable public API, the integration may need updates if LeetCode changes its implementation.

### Milestone 3 – GitHub Synchronization

The third milestone connected submission detection with GitHub uploads.

Implemented:

- Automatic and manual synchronization.
- Synchronization modes.
- Solution file organization.
- Synchronization status tracking.
- Retry support.
- Synchronization queue.

**Challenge: Concurrent synchronization**

Multiple submission events or user actions can trigger synchronization operations close together.

A Promise-based queue and an in-flight request map were introduced to coordinate operations and prevent duplicate processing.

### Milestone 4 – Submission History

The fourth milestone added visibility and control over captured submissions.

Implemented:

- Submission history.
- Search functionality.
- Difficulty and language filters.
- Synchronization status indicators.
- Manual synchronization and retry actions.

Local submission history is limited to the latest 200 records. It is intended for the popup interface and synchronization management, not as the permanent source of repository statistics.

### Milestone 5 – README Generation

The fifth milestone introduced automatic repository documentation.

Implemented:

- Difficulty statistics.
- Language statistics.
- Solution index.
- Relative links to solution files.
- Automatic README updates.

**Challenge: README statistics depended on local storage**

Initially, README statistics were generated from submission history stored in Chrome local storage.

This created a serious persistence problem: uninstalling the extension removed its local history. After reinstalling, the extension no longer had the historical submissions needed to regenerate the README.

Previously accumulated statistics could therefore disappear.

This problem led to an architectural change in the next milestone.

### Milestone 6 – Reliability and Release Preparation

The final milestone focused on persistence, state management, testing, and release readiness.

Implemented:

- Persistent settings panel state.
- GitHub connection status validation.
- Repository-based solution discovery.
- Persistent solution manifest.
- README generation from repository metadata.
- Avoidance of unnecessary GitHub commits.

**Solution: Repository-based source of truth**

Instead of relying on local submission history, the extension now uses the GitHub repository as its source of truth.

During synchronization, it:

1. Retrieves the repository file tree.
2. Discovers existing solution files.
3. Reads the existing manifest.
4. Preserves metadata for files that still exist.
5. Adds metadata for newly discovered solutions.
6. Removes entries for files that no longer exist.
7. Updates the manifest only when its content changes.

The README is then generated from this manifest.

This makes repository statistics independent of the extension's local storage and preserves them across extension removal and reinstallation.

## Challenges & Solutions

The following architectural decisions were particularly important to the project's reliability.

### Keeping GitHub Credentials Out of the Content Script

**Challenge**

The content script runs on LeetCode pages. Passing a GitHub token into this context would unnecessarily expose sensitive credentials to the page-facing part of the extension.

**Solution**

GitHub operations are handled by the background service worker.

The content script sends submission data through extension messaging. The background worker retrieves credentials from Chrome storage and communicates with GitHub.

This separates GitHub authentication from the LeetCode integration.

### Handling GitHub File Updates

**Challenge**

The GitHub Contents API requires the current file SHA when updating an existing file.

**Solution**

The GitHub service checks whether the target file exists and retrieves its SHA before sending an update request. If the file does not exist, it creates a new file.

### Preventing Duplicate and Concurrent Synchronization

**Challenge**

Submission events and user actions can trigger overlapping synchronization requests.

**Solution**

The synchronization service uses:

- Processed submission IDs.
- Existing synchronization records.
- An in-flight request map.
- A Promise-based synchronization queue.

These mechanisms help prevent duplicate processing and coordinate synchronization operations.

### Preserving README Statistics After Reinstallation

**Challenge**

Chrome local storage is removed when the extension is uninstalled. Generating README statistics from local submission history therefore made repository documentation vulnerable to data loss.

**Solution**

The source of truth was moved to GitHub.

A persistent solution manifest stores metadata independently of local browser storage. README statistics are generated from this manifest, allowing the extension to reconstruct its repository overview after reinstallation.

### Keeping the Manifest Consistent with the Repository

**Challenge**

Solution files can be added or deleted manually outside the extension, making the manifest outdated.

**Solution**

The extension compares manifest entries with the actual repository tree during synchronization.

Existing files retain their metadata, newly discovered files are added, and entries for missing files are removed.

### Avoiding Unnecessary GitHub Commits

**Challenge**

Writing the manifest and README after every synchronization could create unnecessary commits even when their content had not changed.

**Solution**

Both generated files are compared with their existing repository contents before uploading.

Only files with changed generated content are updated.

### Runtime Data Validation

**Challenge**

TypeScript types alone cannot guarantee that data received from external APIs or extension messages has the expected structure.

**Solution**

Zod schemas validate incoming submission data and settings at runtime. Invalid data is rejected before it reaches synchronization logic.

## Testing

The project uses Vitest for unit testing.

The test suite covers:

- GitHub path encoding.
- Base64 encoding and decoding.
- Submission schema validation.
- LeetCode service behavior.
- Background message validation.
- Synchronization service behavior.
- Synchronization queue behavior.
- README generation.
- Solution manifest discovery and merging.
- Manifest validation and persistence.

### Run Type Checking

```bash
npm run typecheck
```

### Run Tests

```bash
npm run test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Manual Browser Testing

The extension has also been manually tested in Chrome, including:

- GitHub connection and validation.
- Test file upload.
- Automatic synchronization.
- Manual synchronization.
- Both synchronization modes.
- README generation and updates.
- Duplicate prevention.
- Submission history filters.
- Error handling and retry behavior.
- Disconnecting GitHub.
- Extension removal and reinstallation.
- Preserving repository statistics after reinstallation.

## Privacy & Security

Sync My Leet is designed to work without a dedicated backend.

- GitHub credentials and extension settings are stored in Chrome local storage.
- Submission data is retrieved from LeetCode when needed.
- Submission code and metadata are sent to GitHub when synchronization is performed.
- GitHub credentials are handled by the background service worker.
- The extension does not use analytics, advertising, or tracking services.

The extension communicates with LeetCode and GitHub as required for its functionality.

For more information, see [PRIVACY.md](PRIVACY.md).

## Limitations

- LeetCode's internal GraphQL endpoint is not a stable public API and may change.
- The extension currently depends on the user being logged in to LeetCode.
- Local submission history is limited to 200 records.
- Historical submission dates cannot be reconstructed for discovered solution files if their metadata was never stored.
- Repository tree retrieval may be limited by GitHub API response constraints for very large repositories.

## Future Improvements

Potential areas for future development:

- Support for additional coding platforms.
- More advanced repository statistics.
- Configurable solution directory structures.
- Improved handling of very large GitHub repositories.
- Additional synchronization diagnostics.
- More comprehensive end-to-end tests.

## Contributing

Contributions, bug reports, and feature requests are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Run type checking and tests.
5. Submit a pull request.

Please include relevant tests when introducing new functionality.

## License

This project is licensed under the [MIT License](LICENSE).
