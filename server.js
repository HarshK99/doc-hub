const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 9999;

// Configurable root directory, default to parent of this script's dir
const rootDir = process.env.DOC_ROOT || path.join(__dirname, '..');

// Serve static files from public/
app.use(express.static('public'));

// /api/projects: Scan root directory recursively for folders containing doc/ or docs/
app.get('/api/projects', (req, res) => {
  try {
    const projects = [];
    function scanDir(dir, relPath = '') {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          // Skip node_modules to avoid including package docs
          if (item.name === 'node_modules') continue;
          const fullPath = path.join(dir, item.name);
          const currentRel = relPath ? path.join(relPath, item.name) : item.name;
          if (fs.existsSync(path.join(fullPath, 'doc')) || fs.existsSync(path.join(fullPath, 'docs'))) {
            projects.push(currentRel.replace(/\\/g, '/')); // normalize to /
          } else {
            // Continue scanning deeper
            scanDir(fullPath, currentRel);
          }
        }
      }
    }
    scanDir(rootDir);
    res.json(projects);
  } catch (err) {
    console.error('Error scanning projects:', err);
    res.status(500).json({ error: 'Failed to scan projects' });
  }
});

// /api/docs?project=name: List markdown files under project/doc/ or docs/
app.get('/api/docs', (req, res) => {
  const project = req.query.project;
  if (!project) return res.status(400).json({ error: 'Project required' });

  // Validate project name: no path traversal
  if (project.includes('..')) {
    return res.status(400).json({ error: 'Invalid project name' });
  }

  // Build project path, normalizing separators
  const projectParts = project.split(/[/\\]/).filter(p => p);
  const projectPath = path.join(rootDir, ...projectParts);
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    return res.status(404).json({ error: 'Project not found' });
  }

  let docPath;
  if (fs.existsSync(path.join(projectPath, 'doc'))) {
    docPath = path.join(projectPath, 'doc');
  } else if (fs.existsSync(path.join(projectPath, 'docs'))) {
    docPath = path.join(projectPath, 'docs');
  } else {
    return res.status(404).json({ error: 'No docs folder' });
  }

  // Recursively list .md files under doc/
  function getMdFiles(dir, rel = '') {
    let files = [];
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          files = files.concat(getMdFiles(path.join(dir, item.name), path.join(rel, item.name)));
        } else if (item.name.endsWith('.md')) {
          files.push({
            path: path.join(rel, item.name).replace(/\\/g, '/'), // normalize to /
            displayName: getDisplayName(path.join(dir, item.name))
          });
        }
      }
    } catch (err) {
      console.error('Error reading dir:', err);
    }
    return files;
  }

  // Get display name: first # header or filename
  function getDisplayName(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('# ')) {
          return line.trim().substring(2).trim();
        }
      }
    } catch (err) {
      console.error('Error reading file for display name:', err);
    }
    return path.basename(filePath, '.md');
  }

  try {
    const docs = getMdFiles(docPath);
    res.json(docs);
  } catch (err) {
    console.error('Error listing docs:', err);
    res.status(500).json({ error: 'Failed to list docs' });
  }
});

// /api/doc?project=name&path=relative.md: Read markdown
app.get('/api/doc', (req, res) => {
  const project = req.query.project;
  const relPath = req.query.path;
  if (!project || !relPath) return res.status(400).json({ error: 'Project and path required' });

  // Validate inputs: no .. in project or path
  if (project.includes('..') || relPath.includes('..')) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // Build project path
  const projectParts = project.split(/[/\\]/).filter(p => p);
  const projectPath = path.join(rootDir, ...projectParts);
  let docDir;
  if (fs.existsSync(path.join(projectPath, 'doc'))) {
    docDir = path.join(projectPath, 'doc');
  } else if (fs.existsSync(path.join(projectPath, 'docs'))) {
    docDir = path.join(projectPath, 'docs');
  } else {
    return res.status(404).json({ error: 'No docs folder' });
  }

  const fullPath = path.join(docDir, relPath);

  // Ensure fullPath is under docDir (path traversal protection)
  const resolvedFull = path.resolve(fullPath);
  const resolvedDoc = path.resolve(docDir);
  if (!resolvedFull.startsWith(resolvedDoc + path.sep) && resolvedFull !== resolvedDoc) {
    return res.status(400).json({ error: 'Path traversal detected' });
  }

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return res.status(404).json({ error: 'Doc not found' });
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    res.type('text/plain').send(content);
  } catch (err) {
    console.error('Error reading doc:', err);
    res.status(500).json({ error: 'Failed to read doc' });
  }
});

app.listen(port, () => {
  console.log(`Doc Hub server running at http://localhost:${port}`);
  console.log(`Root directory: ${rootDir}`);
});