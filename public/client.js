// Set up marked with custom renderer for heading IDs
const renderer = new marked.Renderer();
renderer.heading = function(text, level) {
  text = String(text || '');
  const id = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
  return `<h${level} id="${id}">${text}</h${level}>`;
};
marked.setOptions({ renderer });

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
    // Clear content and nav
    document.getElementById('content').innerHTML = '';
    document.getElementById('nav').innerHTML = '';
  } catch (err) {
    console.error('Error loading docs:', err);
    document.getElementById('docList').innerHTML = '<li>Error loading docs</li>';
  }
}

// Parse headings from markdown
function parseHeadings(md) {
  const lines = md.split('\n');
  const headings = [];
  let currentH2 = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      const text = trimmed.substring(3).trim();
      const id = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
      currentH2 = { text, id, children: [] };
      headings.push(currentH2);
    } else if (trimmed.startsWith('### ') && currentH2) {
      const text = trimmed.substring(4).trim();
      const id = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
      currentH2.children.push({ text, id });
    }
  }
  return headings;
}

// Load and render markdown
async function loadDoc(project, path) {
  try {
    const res = await fetch(`/api/doc?project=${encodeURIComponent(project)}&path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Failed to load doc');
    const md = await res.text();

    // Parse headings and build navigation
    const headings = parseHeadings(md);
    const nav = document.getElementById('nav');
    nav.innerHTML = '';
    headings.forEach(h2 => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${h2.id}`;
      a.textContent = h2.text;
      li.appendChild(a);
      if (h2.children.length) {
        const ul = document.createElement('ul');
        h2.children.forEach(h3 => {
          const li3 = document.createElement('li');
          const a3 = document.createElement('a');
          a3.href = `#${h3.id}`;
          a3.textContent = h3.text;
          li3.appendChild(a3);
          ul.appendChild(li3);
        });
        li.appendChild(ul);
      }
      nav.appendChild(li);
    });

    // Render markdown
    const html = marked.parse(md);
    document.getElementById('content').innerHTML = html;

    // Set up scroll tracking for active navigation
    setupScrollTracking();
  } catch (err) {
    console.error('Error loading doc:', err);
    document.getElementById('content').innerHTML = '<p>Error loading document</p>';
  }
}

// Set up scroll tracking
function setupScrollTracking() {
  const content = document.getElementById('content');
  const navLinks = document.querySelectorAll('#nav a');

  function updateActive() {
    const scrollTop = content.scrollTop;
    let activeLink = null;
    navLinks.forEach(link => {
      const target = document.getElementById(link.getAttribute('href').substring(1));
      if (target) {
        const rect = target.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const top = rect.top - contentRect.top + scrollTop;
        if (top <= scrollTop + 100) { // 100px buffer
          activeLink = link;
        }
      }
    });
    navLinks.forEach(link => link.classList.remove('active'));
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }

  content.addEventListener('scroll', updateActive);
  updateActive(); // Initial call
}

// Initialize
loadProjects();