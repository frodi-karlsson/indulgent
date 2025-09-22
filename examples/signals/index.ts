import { createServer } from 'http';
import fs from 'node:fs';

// static route for node_modules script imports of indulgent/signal
const staticRoutes = new Set(['signal.js']);

const server = createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (staticRoutes.has(req.url.replace(/^\/scripts\//, ''))) {
    const filePath = `./node_modules/indulgent/dist/signal/${req.url.replace(/^\/scripts\//, '')}`;
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(fileContent);
      return;
    }
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    const htmlContent = fs.readFileSync('index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlContent);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
