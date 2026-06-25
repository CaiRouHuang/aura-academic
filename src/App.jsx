const projects = [
  {
    title: 'Learning Analytics Proposal',
    phase: 'Checkpoint 2',
    progress: 68,
    due: 'Jul 08',
    status: 'In review'
  },
  {
    title: 'AI-Assisted Research Log',
    phase: 'Checkpoint 1',
    progress: 34,
    due: 'Jul 15',
    status: 'Drafting'
  }
];

const activity = [
  'New project outline generated',
  'Teacher rubric synced',
  'Submission feedback ready'
];

export default function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-mark">N</div>
        <nav>
          <a href="#dashboard" className="active">Dashboard</a>
          <a href="#projects">Projects</a>
          <a href="#upload">Upload</a>
          <a href="#log">Log</a>
        </nav>
      </aside>

      <section className="workspace" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">Academic workspace</p>
            <h1>NAVI</h1>
          </div>
          <button className="avatar" aria-label="Open profile">Y</button>
        </header>

        <section className="summary-band">
          <div>
            <p className="eyebrow">Today</p>
            <h2>Keep the project moving with clear checkpoints.</h2>
          </div>
          <button className="primary-button">Create checkpoint</button>
        </section>

        <section className="grid">
          <div className="panel wide" id="projects">
            <div className="panel-header">
              <h3>Active projects</h3>
              <button className="text-button">View all</button>
            </div>
            <div className="project-list">
              {projects.map((project) => (
                <article className="project-card" key={project.title}>
                  <div>
                    <p className="status">{project.status}</p>
                    <h4>{project.title}</h4>
                    <p>{project.phase} due {project.due}</p>
                  </div>
                  <div className="meter" aria-label={`${project.progress}% complete`}>
                    <span style={{ width: `${project.progress}%` }} />
                  </div>
                  <strong>{project.progress}%</strong>
                </article>
              ))}
            </div>
          </div>

          <div className="panel" id="upload">
            <h3>Next upload</h3>
            <p className="muted">Attach drafts, notes, figures, or progress evidence for AI-assisted review.</p>
            <button className="secondary-button">Select files</button>
          </div>

          <div className="panel" id="log">
            <h3>Research log</h3>
            <ul className="activity-list">
              {activity.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      </section>
    </main>
  );
}
