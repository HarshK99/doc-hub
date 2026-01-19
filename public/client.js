// Load projects on page load
async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error('Failed to load projects');
    const projects = await res.json();
    const select = document.getElementById('projectSelect');
    select.innerHTML = '<option>Select a project</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    });
    select.onchange = () => {
      if (select.value) loadDocs(select.value);
    };
  } catch (err) {
    console.error('Error loading projects:', err);
    document.getElementById('projectSelect').innerHTML = '<option>Error loading projects</option>';
  }
}

// Load docs for selected project
async function loadDocs(project) {
  try {
    const res = await fetch(`/api/docs?project=${encodeURIComponent(project)}`);
    if (!res.ok) throw new Error('Failed to load docs');
    const docs = await res.json();
    const ul = document.getElementById('docList');
    ul.innerHTML = '';
    docs.forEach(d => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = d.displayName;
      a.onclick = (e) => {
        e.preventDefault();
        loadDoc(project, d.path);
      };
      li.appendChild(a);
      ul.appendChild(li);
    });
    document.getElementById('content').innerHTML = ''; // Clear content
  } catch (err) {
    console.error('Error loading docs:', err);
    document.getElementById('docList').innerHTML = '<li>Error loading docs</li>';
  }
}

// Load and render markdown
async function loadDoc(project, path) {
  try {
    const res = await fetch(`/api/doc?project=${encodeURIComponent(project)}&path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Failed to load doc');
    const md = await res.text();
    const html = marked.parse(md);
    document.getElementById('content').innerHTML = html;
  } catch (err) {
    console.error('Error loading doc:', err);
    document.getElementById('content').innerHTML = '<p>Error loading document</p>';
  }
}

// Initialize
loadProjects();